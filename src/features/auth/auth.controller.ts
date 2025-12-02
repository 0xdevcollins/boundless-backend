import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../../models/user.model.js";
import Account from "../../models/account.model.js";
import Session from "../../models/session.model.js";
import { generateTokens, verifyRefreshToken } from "../../utils/jwt.utils.js";
import { setAuthCookies, clearAuthCookies } from "../../utils/cookie.utils.js";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import { generateOTP } from "../../utils/otp.utils.js";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendUnauthorized,
  sendNotFound,
  sendConflict,
  sendInternalServerError,
  checkResource,
} from "../../utils/apiResponse.js";
import { sendEmail } from "../../utils/email.utils.js";
import EmailTemplatesService from "../../services/email/email-templates.service.js";
import { mongooseWithRetry } from "../../utils/db.utils.js";
import { TeamInvitationService } from "../../features/team-invitations/team-invitation.service.js";
import {
  createDefaultUserSettings,
  createDefaultUserProfile,
  createUserFromOAuth,
  extractRefreshToken,
} from "./auth.helpers.js";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, username, invitation } =
      req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { "profile.username": username }],
    });
    if (existingUser) {
      sendConflict(res, "User already exists");
      return;
    }

    const user = new User({
      email,
      password,
      profile: createDefaultUserProfile(firstName, lastName, username),
      settings: createDefaultUserSettings(),
      emailVerified: false,
    });

    const otp = generateOTP();
    user.otp = otp;
    await user.save();

    const emailTemplate = EmailTemplatesService.getTemplate(
      "otp-verification",
      {
        otpCode: otp,
        firstName: firstName,
        recipientName: firstName,
      },
    );

    await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      text: `Your verification code is: ${otp}`,
      html: emailTemplate.html,
    });

    let invitationResult = null;
    if (invitation) {
      try {
        const invitationData =
          await TeamInvitationService.getInvitationByToken(invitation);
        if (invitationData && (invitationData as any).isValid()) {
          user.invitationToken = invitation;
          await user.save();
          invitationResult = {
            hasInvitation: true,
            projectTitle:
              (invitationData.projectId as any)?.title || "Unknown Project",
            role: invitationData.role,
          };
        }
      } catch (invitationError) {
        console.error(
          "Error processing invitation during registration:",
          invitationError,
        );
      }
    }

    sendCreated(
      res,
      {
        message: "User registered successfully. Please verify your email.",
        ...(invitationResult && { invitation: invitationResult }),
      },
      invitationResult
        ? "User registered successfully. Please verify your email to join the team."
        : "User registered successfully. Please verify your email.",
    );
  } catch (error) {
    console.error("Registration error:", error);
    sendInternalServerError(res, "Error registering user");
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Use retry utility for database operations
    const user = await mongooseWithRetry(
      () => User.findOne({ email }).maxTimeMS(10000),
      { maxRetries: 3, timeout: 15000 },
    );

    if (!user) {
      sendUnauthorized(res, "Invalid credentials");
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      sendUnauthorized(res, "Invalid credentials");
      return;
    }

    if (!user.emailVerified) {
      sendUnauthorized(res, "Please verify your email first");
      return;
    }

    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles.map((role) => role.role),
    });

    setAuthCookies(res, tokens);

    try {
      await mongooseWithRetry(
        () => {
          user.lastLogin = new Date();
          return user.save();
        },
        { maxRetries: 2, timeout: 5000 },
      );
    } catch (saveError) {
      console.error("Failed to update lastLogin:", saveError);
    }

    sendSuccess(res, tokens, "Login successful");
  } catch (error) {
    console.error("Login error:", error);

    if (
      (error as any).name === "MongooseError" &&
      (error as any).message.includes("buffering timed out")
    ) {
      sendInternalServerError(
        res,
        "Database connection timeout. Please try again.",
      );
    } else if ((error as any).name === "MongoNetworkError") {
      sendInternalServerError(
        res,
        "Database connection error. Please try again.",
      );
    } else if ((error as any).message === "Operation timeout") {
      sendInternalServerError(res, "Request timeout. Please try again.");
    } else {
      sendInternalServerError(res, "Error logging in");
    }
  }
};

export const githubAuth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { code, invitation } = req.body;

    const { data: tokenData } = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const { data: userData } = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const { email, id, name, avatar_url } = userData;

    let user = await User.findOne({ email });
    let invitationResult = null;

    if (!user) {
      user = createUserFromOAuth(
        email,
        name?.split(" ")[0] || "",
        name?.split(" ")[1] || "",
        email.split("@")[0],
        avatar_url || "",
        invitation,
      );
      await user.save();

      if (invitation) {
        try {
          const result = await TeamInvitationService.acceptInvitation(
            invitation,
            user._id.toString(),
          );
          invitationResult = {
            projectTitle: result.project.title,
            role: result.invitation.role,
            projectId: result.project._id,
          };
          user.invitationToken = undefined;
          await user.save();
        } catch (invitationError) {
          console.error(
            "Error accepting invitation during GitHub auth:",
            invitationError,
          );
        }
      }
    }

    await Account.findOneAndUpdate(
      { provider: "github", providerAccountId: id.toString() },
      {
        userId: user._id,
        type: "oauth",
        provider: "github",
        providerAccountId: id.toString(),
      },
      { upsert: true },
    );

    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles.map((role) => role.role),
    });

    setAuthCookies(res, tokens);

    sendSuccess(
      res,
      {
        ...tokens,
        ...(invitationResult && { invitation: invitationResult }),
      },
      invitationResult
        ? "GitHub authentication successful. You have been added to the project team!"
        : "GitHub authentication successful",
    );
  } catch (error) {
    console.error("GitHub auth error:", error);
    sendInternalServerError(res, "Error with GitHub authentication");
  }
};

export const googleAuth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, invitation } = req.body;
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      sendBadRequest(res, "Invalid Google token");
      return;
    }

    const { email, sub, name, picture } = payload;

    if (!email) {
      sendBadRequest(res, "Email not provided by Google");
      return;
    }

    let user = await User.findOne({ email });
    let invitationResult = null;

    if (!user) {
      user = createUserFromOAuth(
        email,
        name?.split(" ")[0] || "",
        name?.split(" ")[1] || "",
        email.split("@")[0],
        picture || "",
        invitation,
      );
      await user.save();

      if (invitation) {
        try {
          const result = await TeamInvitationService.acceptInvitation(
            invitation,
            user._id.toString(),
          );
          invitationResult = {
            projectTitle: result.project.title,
            role: result.invitation.role,
            projectId: result.project._id,
          };
          user.invitationToken = undefined;
          await user.save();
        } catch (invitationError) {
          console.error(
            "Error accepting invitation during Google auth:",
            invitationError,
          );
        }
      }
    }

    await Account.findOneAndUpdate(
      { provider: "google", providerAccountId: sub },
      {
        userId: user._id,
        type: "oauth",
        provider: "google",
        providerAccountId: sub,
      },
      { upsert: true },
    );

    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles.map((role) => role.role),
    });

    setAuthCookies(res, tokens);

    sendSuccess(
      res,
      {
        ...tokens,
        ...(invitationResult && { invitation: invitationResult }),
      },
      invitationResult
        ? "Google authentication successful. You have been added to the project team!"
        : "Google authentication successful",
    );
  } catch (error) {
    console.error("Google auth error:", error);
    sendInternalServerError(res, "Error with Google authentication");
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select("-password");

    if (checkResource(res, !user, "User not found", 404)) {
      return;
    }

    sendSuccess(res, user, "User profile retrieved successfully");
  } catch (error) {
    console.error("Get me error:", error);
    sendInternalServerError(res, "Server error");
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    if (req.user) {
      await Session.deleteMany({ userId: req.user._id });
    }

    clearAuthCookies(res);

    sendSuccess(
      res,
      { message: "Logged out successfully" },
      "Logged out successfully",
    );
  } catch (error) {
    console.error("Logout error:", error);
    sendInternalServerError(res, "Server error");
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (checkResource(res, !user, "User not found", 404)) {
      return;
    }

    if (!user) return;

    const resetToken = generateOTP();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    const emailTemplate = EmailTemplatesService.getTemplate("password-reset", {
      resetToken: resetToken,
      firstName: user.profile.firstName,
      recipientName: user.profile.firstName,
    });

    await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      text: `You requested a password reset. Please use the link in the email to reset your password.`,
      html: emailTemplate.html,
    });

    sendSuccess(
      res,
      { message: "Password reset email sent" },
      "Password reset email sent",
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    sendInternalServerError(res, "Error processing forgot password request");
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (checkResource(res, !user, "Invalid or expired reset token", 400)) {
      return;
    }

    if (!user) return;

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    sendSuccess(
      res,
      { message: "Password reset successfully" },
      "Password reset successfully",
    );
  } catch (error) {
    console.error("Reset password error:", error);
    sendInternalServerError(res, "Error resetting password");
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      sendBadRequest(res, "Email and OTP are required");
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      sendNotFound(res, "User not found");
      return;
    }

    if (user.otp !== otp) {
      sendBadRequest(res, "Invalid OTP");
      return;
    }

    user.emailVerified = true;
    user.otp = undefined;

    let invitationResult = null;
    if (user.invitationToken) {
      try {
        const result = await TeamInvitationService.acceptInvitation(
          user.invitationToken,
          user._id.toString(),
        );
        invitationResult = {
          projectTitle: result.project.title,
          role: result.invitation.role,
          projectId: result.project._id,
        };
        user.invitationToken = undefined;
      } catch (invitationError) {
        console.error(
          "Error accepting invitation during verification:",
          invitationError,
        );
      }
    }

    await user.save();

    try {
      const welcomeTemplate = EmailTemplatesService.getTemplate("welcome", {
        firstName: user.profile.firstName,
        recipientName: user.profile.firstName,
      });

      await sendEmail({
        to: user.email,
        subject: welcomeTemplate.subject,
        text: `Welcome to Boundless, ${user.profile.firstName}! Your account has been verified and is ready to use.`,
        html: welcomeTemplate.html,
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    sendSuccess(
      res,
      {
        message: invitationResult
          ? "Email verified successfully. You have been added to the project team!"
          : "Email verified successfully",
        ...(invitationResult && { invitation: invitationResult }),
      },
      invitationResult
        ? "Email verified successfully. You have been added to the project team!"
        : "Email verified successfully",
    );
  } catch (error) {
    console.error("Verify OTP error:", error);
    sendInternalServerError(res, "Error verifying OTP");
  }
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      sendBadRequest(res, "User not found");
      return;
    }

    const otp = generateOTP();
    user.otp = otp;
    await user.save();

    const emailTemplate = EmailTemplatesService.getTemplate(
      "otp-verification",
      {
        otpCode: otp,
        firstName: user.profile.firstName,
        recipientName: user.profile.firstName,
      },
    );

    await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      text: `Your verification code is: ${otp}`,
      html: emailTemplate.html,
    });

    sendSuccess(
      res,
      { message: "OTP sent successfully" },
      "OTP sent successfully",
    );
  } catch (error) {
    console.error("Resend OTP error:", error);
    sendInternalServerError(res, "Error sending OTP");
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const refreshTokenValue = extractRefreshToken(req);

    if (!refreshTokenValue) {
      sendUnauthorized(res, "Refresh token not found");
      return;
    }

    const decoded = verifyRefreshToken(refreshTokenValue) as any;

    if (!decoded || !decoded.userId) {
      sendUnauthorized(res, "Invalid refresh token");
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      sendUnauthorized(res, "User not found");
      return;
    }

    if (!user.emailVerified) {
      sendUnauthorized(res, "User not verified");
      return;
    }

    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles.map((role) => role.role),
    });

    setAuthCookies(res, tokens);

    sendSuccess(res, tokens, "Token refreshed successfully");
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendUnauthorized(res, "Refresh token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      sendUnauthorized(res, "Invalid refresh token");
    } else {
      console.error("Refresh token error:", error);
      sendInternalServerError(res, "Error refreshing token");
    }
  }
};
