import mongoose from "mongoose";
import User from "../models/user.model";
import { TeamInvitationService } from "../features/team-invitations/team-invitation.service";
import {
  createDefaultUserSettings,
  createDefaultUserProfile,
} from "../features/auth/auth.helpers";
import { sendEmail } from "../utils/email.utils";
import EmailTemplatesService from "../services/email/email-templates.service";

interface SyncOptions {
  invitationToken?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  // Note: username is always derived from email to prevent issues
}

/**
 * Generate a unique username from email
 * Always derives username from email to prevent issues
 * Ensures the username is never empty and is unique
 */
async function generateUniqueUsername(email: string): Promise<string> {
  // Extract username from email prefix
  const emailPrefix = email.split("@")[0];
  // Remove all non-alphanumeric characters
  let baseUsername = emailPrefix.replace(/[^a-zA-Z0-9]/g, "");

  // If empty after cleaning, use email hash as fallback
  if (!baseUsername || baseUsername.trim() === "") {
    // Use a hash of the email as fallback
    const emailHash = Buffer.from(email)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 8);
    baseUsername = `user${emailHash}`;
  }

  // Ensure username is lowercase and trimmed
  baseUsername = baseUsername.toLowerCase().trim();

  // Check if username already exists, append number if needed
  let username = baseUsername;
  let counter = 1;
  while (await User.findOne({ "profile.username": username })) {
    username = `${baseUsername}${counter}`;
    counter++;
    // Safety check to prevent infinite loop
    if (counter > 10000) {
      username = `${baseUsername}${Date.now()}`;
      break;
    }
  }

  return username;
}

/**
 * Sync Better Auth user with existing User model
 * This ensures compatibility between Better Auth and the existing User schema
 */
export async function syncBetterAuthUser(
  betterAuthUserId: string,
  email: string,
  options: SyncOptions = {},
): Promise<any> {
  try {
    // Check if user already exists in our User model
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Extract name parts from email if not provided
      const firstName =
        options.firstName ||
        email.split("@")[0].split(".")[0] ||
        email.split("@")[0];
      const lastName =
        options.lastName ||
        email.split("@")[0].split(".").slice(1).join(" ") ||
        "";

      // Generate a unique username from email (always from email to prevent issues)
      const username = await generateUniqueUsername(email.toLowerCase());

      // Create new user in our User model
      user = new User({
        email: email.toLowerCase(),
        // Password is not stored in User model when using Better Auth
        // It's managed by Better Auth in the account table
        password: "", // Empty password since Better Auth handles it
        profile: createDefaultUserProfile(
          firstName,
          lastName,
          username,
          options.avatar || "",
        ),
        settings: createDefaultUserSettings(),
        // OAuth users are verified by default, email/password users need verification
        isVerified: options.avatar ? true : false,
        ...(options.invitationToken && {
          invitationToken: options.invitationToken,
        }),
      });

      try {
        await user.save();
      } catch (saveError: any) {
        // Handle duplicate key error for username
        if (
          saveError.code === 11000 &&
          saveError.keyPattern?.["profile.username"]
        ) {
          // Username conflict, generate a new one and retry
          user.profile.username = await generateUniqueUsername(
            email.toLowerCase(),
          );
          await user.save();
        } else {
          throw saveError;
        }
      }
    } else {
      // Update existing user if needed
      let needsSave = false;

      // Ensure username is set (fix for users with null/empty username)
      // Always derive from email to prevent issues
      if (!user.profile.username || user.profile.username.trim() === "") {
        user.profile.username = await generateUniqueUsername(user.email);
        needsSave = true;
      }

      if (options.avatar && !user.profile.avatar) {
        user.profile.avatar = options.avatar;
        needsSave = true;
      }
      // Update name if provided and not set
      if (options.firstName && !user.profile.firstName) {
        user.profile.firstName = options.firstName;
        needsSave = true;
      }
      if (options.lastName && !user.profile.lastName) {
        user.profile.lastName = options.lastName;
        needsSave = true;
      }

      if (needsSave) {
        try {
          await user.save();
        } catch (saveError: any) {
          // Handle duplicate key error for username
          if (
            saveError.code === 11000 &&
            saveError.keyPattern?.["profile.username"]
          ) {
            // Username conflict, generate a new one and retry
            user.profile.username = await generateUniqueUsername(user.email);
            await user.save();
          } else {
            throw saveError;
          }
        }
      }
    }

    // Handle team invitation if provided
    if (options.invitationToken) {
      try {
        const result = await TeamInvitationService.acceptInvitation(
          options.invitationToken,
          user._id.toString(),
        );

        // Clear invitation token from user
        user.invitationToken = undefined;
        await user.save();

        return {
          user,
          invitation: {
            projectTitle: result.project.title,
            role: result.invitation.role,
            projectId: result.project._id,
          },
        };
      } catch (invitationError) {
        console.error(
          "Error accepting invitation during user sync:",
          invitationError,
        );
        // Don't throw - invitation might be invalid or expired
      }
    }

    // Send welcome email if user was just created and verified
    if (user.isVerified) {
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
    }

    return { user };
  } catch (error) {
    console.error("Error syncing Better Auth user:", error);
    throw error;
  }
}

/**
 * Update user verification status after email verification
 */
export async function updateUserVerificationStatus(
  email: string,
  isVerified: boolean,
): Promise<void> {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.isVerified = isVerified;
      if (isVerified) {
        user.otp = undefined; // Clear OTP after verification
      }
      await user.save();
    }
  } catch (error) {
    console.error("Error updating user verification status:", error);
    throw error;
  }
}

/**
 * Update user last login
 */
export async function updateUserLastLogin(email: string): Promise<void> {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.lastLogin = new Date();
      await user.save();
    }
  } catch (error) {
    console.error("Error updating user last login:", error);
    // Don't throw - this is not critical
  }
}
