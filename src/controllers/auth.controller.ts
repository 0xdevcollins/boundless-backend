import { Request, Response } from "express";

import User, { IUser } from "../models/user.model";
import Account from "../models/account.model";
import Session from "../models/session.model";
import { generateTokens } from "../utils/jwt.utils";
import { setAuthCookies, clearAuthCookies } from "../utils/cookie.utils";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";

import { generateOTP } from "../utils/otp.utils";
import sendEmail from "../utils/sendMail.utils";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendUnauthorized,
  sendNotFound,
  sendConflict,
  sendInternalServerError,
  checkResource,
} from "../utils/apiResponse";

// Register user with email and password
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, username } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { "profile.username": username }],
    });
    if (existingUser) {
      sendConflict(res, "User already exists");
      return;
    }

    // Create new user
    const user = new User({
      email,
      password,
      profile: {
        firstName,
        lastName,
        username,
        avatar: "",
        bio: "",
        location: "",
        website: "",
        socialLinks: {},
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: false,
          showContributions: true,
        },
        preferences: { language: "en", timezone: "UTC", theme: "SYSTEM" },
      },
      isVerified: false,
    });

    await user.save();

    const otp = generateOTP();
    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `Your verification code is: ${otp}`,
    });

    sendCreated(
      res,
      { message: "User registered successfully. Please verify your email." },
      "User registered successfully. Please verify your email.",
    );
  } catch (error) {
    console.error("Registration error:", error);
    sendInternalServerError(res, "Error registering user");
  }
};

// Login user with email/username and password
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      sendUnauthorized(res, "Invalid credentials");
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      sendUnauthorized(res, "Invalid credentials");
      return;
    }

    // Check if user is verified
    if (!user.isVerified) {
      sendUnauthorized(res, "Please verify your email first");
      return;
    }

    // Generate tokens
    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles.map((role) => role.role),
    });

    // Set cookies
    setAuthCookies(res, tokens);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    sendSuccess(res, tokens, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    sendInternalServerError(res, "Error logging in");
  }
};

// GitHub OAuth
export const githubAuth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { code } = req.body;

    // Exchange code for access token
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

    // Get user data from GitHub
    const { data: userData } = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const { email, id, name, avatar_url } = userData;

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        profile: {
          firstName: name?.split(" ")[0] || "",
          lastName: name?.split(" ")[1] || "",
          username: email.split("@")[0],
          avatar: avatar_url || "",
          bio: "",
          location: "",
          website: "",
          socialLinks: {},
        },
        settings: {
          notifications: { email: true, push: true, inApp: true },
          privacy: {
            profileVisibility: "PUBLIC",
            showWalletAddress: false,
            showContributions: true,
          },
          preferences: { language: "en", timezone: "UTC", theme: "SYSTEM" },
        },
        isVerified: true,
      });
      await user.save();
    }

    // Create or update GitHub account
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

    // Generate tokens
    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles.map((role) => role.role),
    });

    // Set cookies
    setAuthCookies(res, tokens);

    sendSuccess(res, tokens, "GitHub authentication successful");
  } catch (error) {
    console.error("GitHub auth error:", error);
    sendInternalServerError(res, "Error with GitHub authentication");
  }
};

// Google OAuth
export const googleAuth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token } = req.body;
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

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        profile: {
          firstName: name?.split(" ")[0] || "",
          lastName: name?.split(" ")[1] || "",
          username: email?.split("@")[0] || "",
          avatar: picture || "",
          bio: "",
          location: "",
          website: "",
          socialLinks: {},
        },
        settings: {
          notifications: { email: true, push: true, inApp: true },
          privacy: {
            profileVisibility: "PUBLIC",
            showWalletAddress: false,
            showContributions: true,
          },
          preferences: { language: "en", timezone: "UTC", theme: "SYSTEM" },
        },
        isVerified: true,
      });
      await user.save();
    }

    // Create or update Google account
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

    // Generate tokens
    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles.map((role) => role.role),
    });

    // Set cookies
    setAuthCookies(res, tokens);

    sendSuccess(res, tokens, "Google authentication successful");
  } catch (error) {
    console.error("Google auth error:", error);
    sendInternalServerError(res, "Error with Google authentication");
  }
};

// Get current user profile
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

// Logout
export const logout = async (req: Request, res: Response) => {
  try {
    if (req.user) {
      await Session.deleteMany({ userId: req.user._id });
    }

    // Clear cookies
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

    if (!user) return; // TypeScript guard

    // Generate reset token
    const resetToken = generateOTP();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Construct reset password link
    // Use config.cors.origin as the frontend base URL
    const { config } = await import("../config/index");
    const resetLink = `${config.cors.origin}/auth/reset-password?token=${resetToken}`;

    // Send reset email with link
    await sendEmail({
      to: email,
      subject: "Password Reset",
      html: `
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you did not request this, please ignore this email.</p>
      `,
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

    if (!user) return; // TypeScript guard

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

// Verify OTP for email verification
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

    // For demo: assume OTP is stored in user.otp (in real app, use a separate OTP model)
    if (user.otp !== otp) {
      sendBadRequest(res, "Invalid OTP");
      return;
    }

    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    sendSuccess(
      res,
      { message: "Email verified successfully" },
      "Email verified successfully",
    );
  } catch (error) {
    console.error("Verify OTP error:", error);
    sendInternalServerError(res, "Error verifying OTP");
  }
};

// Resend OTP for email verification
export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      sendBadRequest(res, "Email is required");
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      sendNotFound(res, "User not found");
      return;
    }

    if (user.isVerified) {
      sendBadRequest(res, "User already verified");
      return;
    }

    const otp = generateOTP();
    user.otp = otp;
    await user.save();

    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `Your verification code is: ${otp}`,
    });

    sendSuccess(
      res,
      { message: "OTP resent successfully" },
      "OTP resent successfully",
    );
  } catch (error) {
    console.error("Resend OTP error:", error);
    sendInternalServerError(res, "Error resending OTP");
  }
};
