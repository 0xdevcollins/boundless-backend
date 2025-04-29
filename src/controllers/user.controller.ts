import { Request, Response } from "express";
import User from "../models/user.model";
import { uploadToCloudinary } from "../utils/user.upload";
import { IUser } from "../models/user.model";
import mongoose from "mongoose";

// Extend the Express Request type to include our custom properties
interface AuthenticatedRequest extends Request {
  user: IUser;
  file?: Express.Multer.File;
}

// Define the SecuritySettings interface
interface SecuritySettings {
  twoFactorEnabled: boolean;
  lastPasswordChange: Date;
  loginAlerts: boolean;
}

// Extend the IUser interface to include security settings
declare module "../models/user.model" {
  interface IUser {
    setting: {
      notifications: any;
      privacy: any;
      preferences: any;
      security?: SecuritySettings;
    };
  }
}

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getUserProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -settings -badges -roles -status",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
export const updateUserProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const {
      firstName,
      lastName,
      username,
      bio,
      location,
      website,
      socialLinks,
    } = req.body;

    // Check if username is being updated and if it's already taken
    if (username) {
      const existingUser = await User.findOne({
        "profile.username": username,
        _id: { $ne: req.user._id },
      });
      if (existingUser) {
        return res.status(400).json({ message: "Username is already taken" });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "profile.firstName": firstName,
          "profile.lastName": lastName,
          "profile.username": username,
          "profile.bio": bio,
          "profile.location": location,
          "profile.website": website,
          "profile.socialLinks": socialLinks,
        },
      },
      { new: true },
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc    Update user avatar
 * @route   PUT /api/users/avatar
 * @access  Private
 */
export const updateUserAvatar = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload to Cloudinary or your preferred storage
    const result = await uploadToCloudinary(req.file);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { "profile.avatar": result.secure_url } },
      { new: true },
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc    Get user activity
 * @route   GET /api/users/activity
 * @access  Private
 */
export const getUserActivity = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    // In a real implementation, you would fetch user activity from an Activity model
    // This is a placeholder implementation
    const activity = [
      { type: "LOGIN", timestamp: new Date(), details: "Logged in from web" },
      {
        type: "PROJECT_CREATED",
        timestamp: new Date(),
        details: "Created project XYZ",
      },
    ];

    res.status(200).json(activity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc    Get user settings
 * @route   GET /api/users/settings
 * @access  Private
 */
export const getUserSettings = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const user = await User.findById(req.user._id).select("settings");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc    Update user settings
 * @route   PUT /api/users/settings
 * @access  Private
 */
export const updateUserSettings = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { notifications, privacy, preferences } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "settings.notifications": notifications,
          "settings.privacy": privacy,
          "settings.preferences": preferences,
        },
      },
      { new: true },
    ).select("settings");

    res.status(200).json(updatedUser?.settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc    Update user security settings
 * @route   PUT /api/users/security
 * @access  Private
 */
export const updateUserSecurity = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { currentPassword, newPassword, twoFactorEnabled, twoFactorCode } =
      req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Initialize security settings if they don't exist
    if (!user.settings) {
    }

    // Update password if new password is provided
    if (newPassword) {
      user.password = newPassword;
    }

    await user.save();
    res.status(200).json({ message: "Security settings updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
