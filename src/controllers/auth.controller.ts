import { Request, Response } from "express";
import crypto from "crypto";
import User, { IUser } from "../models/user.model";
import Account from "../models/account.model";
import Session from "../models/session.model";
import { generateTokens } from "../utils/jwt.utils";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import { generateOTP } from "../utils/otp.utils";
import sendEmail from "../utils/sendMail.utils";

// Register user with email and password
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, username } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { "profile.username": username }],
    });
    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      profile: {
        firstName,
        lastName,
        username,
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

    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
    });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error });
  }
};

// Login user with email/username and password
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    // Check if user is verified
    if (!user.isVerified) {
      res.status(401).json({ message: "Please verify your email first" });
      return;
    }

    // Generate tokens
    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      roles: user.roles.map((role) => role.role),
    });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json(tokens);
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
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
          avatar: avatar_url,
        },
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

    res.json(tokens);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error with GitHub authentication", error });
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
      res.status(400).json({ message: "Invalid Google token" });
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
          avatar: picture,
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

    res.json(tokens);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error with Google authentication", error });
  }
};

// Get current user profile
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Logout
export const logout = async (req: Request, res: Response) => {
  try {
    if (req.user) {
      await Session.deleteMany({ userId: req.user._id });
    }
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Generate reset token
    const resetToken = generateOTP();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Send reset email
    await sendEmail({
      to: email,
      subject: "Password Reset",
      html: `Your password reset code is: ${resetToken}`,
    });

    res.json({ message: "Password reset email sent" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error processing forgot password request", error });
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

    if (!user) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error resetting password", error });
  }
};
