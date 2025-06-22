import { Request, Response } from "express";
import User from "../models/user.model";
import { uploadToCloudinary } from "../utils/user.upload";
import { IUser } from "../models/user.model";
import mongoose from "mongoose";
import Activity from "../models/activity.model";
import {
  sendSuccess,
  sendNotFound,
  sendUnauthorized,
  sendBadRequest,
  sendInternalServerError,
  sendConflict,
  checkResource,
} from "../utils/apiResponse";

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
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const user = await User.findById(req.user._id).select(
      "-password -settings -badges -roles -status",
    );

    if (checkResource(res, !user, "User not found", 404)) {
      return;
    }

    sendSuccess(res, user, "User profile retrieved successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
export const updateUserProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

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
        sendConflict(res, "Username is already taken");
        return;
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

    sendSuccess(res, updatedUser, "Profile updated successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Update user avatar
 * @route   PUT /api/users/avatar
 * @access  Private
 */
export const updateUserAvatar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    if (!req.file) {
      sendBadRequest(res, "No file uploaded");
      return;
    }

    // Upload to Cloudinary or your preferred storage
    const result = await uploadToCloudinary(req.file);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { "profile.avatar": result.secure_url } },
      { new: true },
    ).select("-password");

    sendSuccess(res, updatedUser, "Avatar updated successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Get user activity
 * @route   GET /api/users/activity
 * @access  Private
 */
export const getUserActivity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const activities = await Activity.find({ "userId.type": req.user._id })
      .sort({ createdAt: -1 }) // Sort by most recent first
      .populate({
        path: "details.projectId",
        select: "title slug", // Only include title and slug from project
      })
      .lean();

    sendSuccess(res, activities, "User activity retrieved successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Get user settings
 * @route   GET /api/users/settings
 * @access  Private
 */
export const getUserSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const user = await User.findById(req.user._id).select("settings");

    if (checkResource(res, !user, "User not found", 404)) {
      return;
    }

    if (!user) return; // TypeScript guard

    sendSuccess(res, user.settings, "User settings retrieved successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Update user settings
 * @route   PUT /api/users/settings
 * @access  Private
 */
export const updateUserSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

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

    if (checkResource(res, !updatedUser, "User not found", 404)) {
      return;
    }

    sendSuccess(res, updatedUser?.settings, "Settings updated successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Update user security settings
 * @route   PUT /api/users/security
 * @access  Private
 */
export const updateUserSecurity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const { currentPassword, newPassword, twoFactorEnabled, twoFactorCode } =
      req.body;
    const user = await User.findById(req.user._id);

    if (checkResource(res, !user, "User not found", 404)) {
      return;
    }

    // At this point, user is guaranteed to be non-null
    if (!user) return; // TypeScript guard

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      sendBadRequest(res, "Current password is incorrect");
      return;
    }

    // Initialize security settings if they don't exist
    if (!user.settings) {
      user.settings = {
        notifications: {
          email: true,
          push: true,
          inApp: true,
        },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: false,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "UTC",
          theme: "LIGHT",
        },
      };
    }

    // Update password if new password is provided
    if (newPassword) {
      user.password = newPassword;
    }

    await user.save();
    sendSuccess(
      res,
      { message: "Security settings updated successfully" },
      "Security settings updated successfully",
    );
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};
