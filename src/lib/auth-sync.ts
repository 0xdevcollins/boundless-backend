import mongoose from "mongoose";
import crypto from "crypto";
import User from "../models/user.model.js";
import { TeamInvitationService } from "../features/team-invitations/team-invitation.service.js";
import {
  createDefaultUserSettings,
  createDefaultUserProfile,
} from "../features/auth/auth.helpers.js";
import { sendEmail } from "../utils/email.utils.js";
import EmailTemplatesService from "../services/email/email-templates.service.js";

interface SyncOptions {
  invitationToken?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  // Note: username is always derived from email to prevent issues
}

/**
 * Generate a secure placeholder password for OAuth users
 * This password is never used for authentication (Better Auth handles OAuth)
 * It's only required to satisfy the User model schema requirements
 */
function generateOAuthPlaceholderPassword(): string {
  // Generate a secure random password that will never be used
  // Using crypto for cryptographically secure random generation
  const randomBytes = crypto.randomBytes(32);
  const timestamp = Date.now();
  const randomString = randomBytes.toString("hex");
  return `OAUTH_PLACEHOLDER_${timestamp}_${randomString}`;
}

/**
 * Extract and normalize name parts from OAuth provider data
 * Handles edge cases like single names, multiple spaces, etc.
 */
function extractNameParts(
  providedName: string | undefined,
  email: string,
): { firstName: string; lastName: string } {
  // If name is provided, try to split it intelligently
  if (providedName && providedName.trim()) {
    const nameParts = providedName
      .trim()
      .split(/\s+/)
      .filter((part) => part);

    if (nameParts.length === 0) {
      // Empty after trimming, fall back to email
      return extractNameFromEmail(email);
    } else if (nameParts.length === 1) {
      // Single name provided
      return {
        firstName: nameParts[0],
        lastName: "User", // Default for single names
      };
    } else {
      // Multiple parts: first part is firstName, rest is lastName
      return {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" "),
      };
    }
  }

  // No name provided, extract from email
  return extractNameFromEmail(email);
}

/**
 * Extract name parts from email address as fallback
 */
function extractNameFromEmail(email: string): {
  firstName: string;
  lastName: string;
} {
  const emailPrefix = email.split("@")[0];
  const parts = emailPrefix.split(".").filter((part) => part);

  if (parts.length === 0) {
    return {
      firstName: "User",
      lastName: "User",
    };
  } else if (parts.length === 1) {
    return {
      firstName: parts[0] || "User",
      lastName: "User",
    };
  } else {
    return {
      firstName: parts[0] || "User",
      lastName: parts.slice(1).join(" ") || "User",
    };
  }
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
      // Extract name parts intelligently from OAuth data or email
      let firstName: string;
      let lastName: string;

      // If both firstName and lastName are provided separately, use them directly
      if (options.firstName?.trim() && options.lastName?.trim()) {
        firstName = options.firstName.trim();
        lastName = options.lastName.trim();
      } else if (options.firstName?.trim() || options.lastName?.trim()) {
        // If only one is provided, try to extract the other from the provided name or email
        const combinedName =
          `${options.firstName || ""} ${options.lastName || ""}`.trim();
        const extracted = extractNameParts(combinedName, email);
        firstName = options.firstName?.trim() || extracted.firstName;
        lastName = options.lastName?.trim() || extracted.lastName;
      } else {
        // No name provided, extract from email
        const extracted = extractNameParts(undefined, email);
        firstName = extracted.firstName;
        lastName = extracted.lastName;
      }

      // Ensure both names are non-empty (User model requires them)
      const safeFirstName = (firstName || "User").trim() || "User";
      const safeLastName = (lastName || "User").trim() || "User";

      // Generate a unique username from email (always from email to prevent issues)
      const username = await generateUniqueUsername(email.toLowerCase());

      // Generate secure placeholder password for OAuth users
      // This password will never be used for authentication (Better Auth handles OAuth)
      // It's only required to satisfy the User model schema
      const oauthPlaceholderPassword = generateOAuthPlaceholderPassword();

      // Ensure password is a valid non-empty string
      const finalPassword =
        oauthPlaceholderPassword || generateOAuthPlaceholderPassword();

      // Create new user in our User model
      user = new User({
        email: email.toLowerCase(),
        // OAuth users don't use password for authentication (Better Auth handles it)
        // But User model requires a non-empty password, so we use a secure placeholder
        password: finalPassword,
        profile: createDefaultUserProfile(
          safeFirstName,
          safeLastName,
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

      // Defensive check: ensure password is set and valid before saving
      // This is critical - the password must be a non-empty string
      if (
        !user.password ||
        typeof user.password !== "string" ||
        user.password.trim() === ""
      ) {
        const newPassword = generateOAuthPlaceholderPassword();
        user.set("password", newPassword); // Use set() to ensure it's properly set
        user.markModified("password"); // Explicitly mark as modified
      }

      // Final validation: ensure password exists before save
      if (!user.password) {
        throw new Error("Password is required but was not set for OAuth user");
      }

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

      // Ensure password is set (OAuth users created by Better Auth might not have one)
      if (
        !user.password ||
        typeof user.password !== "string" ||
        user.password.trim() === ""
      ) {
        const newPassword = generateOAuthPlaceholderPassword();
        user.set("password", newPassword); // Use set() to ensure it's properly set
        user.markModified("password"); // Explicitly mark as modified
        needsSave = true;
      }

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
      // Ensure firstName is never empty
      if (options.firstName?.trim() && !user.profile.firstName?.trim()) {
        user.profile.firstName = options.firstName.trim();
        needsSave = true;
      }

      // Ensure lastName is never empty - set it if missing or empty
      if (options.lastName?.trim()) {
        // Update if provided
        if (!user.profile.lastName?.trim()) {
          user.profile.lastName = options.lastName.trim();
          needsSave = true;
        }
      } else if (
        !user.profile.lastName ||
        user.profile.lastName.trim() === ""
      ) {
        // If lastName is missing or empty, set a default
        // Try to extract from email or use "User" as fallback
        const emailPrefix = user.email.split("@")[0];
        const emailParts = emailPrefix.split(".").filter((part) => part);
        user.profile.lastName =
          emailParts.length > 1 ? emailParts.slice(1).join(" ") : "User";
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

        // Ensure password is set before saving (defensive check)
        if (
          !user.password ||
          typeof user.password !== "string" ||
          user.password.trim() === ""
        ) {
          const newPassword = generateOAuthPlaceholderPassword();
          user.set("password", newPassword); // Use set() to ensure it's properly set
          user.markModified("password"); // Explicitly mark as modified
        }

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
 * Uses updateOne to avoid validation errors if user document is missing required fields
 */
export async function updateUserVerificationStatus(
  email: string,
  isVerified: boolean,
): Promise<void> {
  try {
    // Use updateOne instead of save() to avoid validation errors
    // This is safer when Better Auth may have created users directly in MongoDB
    const updateQuery: any = { $set: { isVerified } };
    if (isVerified) {
      // Clear OTP after verification using $unset
      updateQuery.$unset = { otp: "" };
    }

    await User.updateOne({ email: email.toLowerCase() }, updateQuery);
  } catch (error) {
    console.error("Error updating user verification status:", error);
    throw error;
  }
}

/**
 * Update user last login
 * Uses updateOne to avoid validation errors if user document is missing required fields
 */
export async function updateUserLastLogin(email: string): Promise<void> {
  try {
    // Use updateOne instead of save() to avoid validation errors
    // This is safer when Better Auth may have created users directly in MongoDB
    await User.updateOne(
      { email: email.toLowerCase() },
      { $set: { lastLogin: new Date() } },
    );
  } catch (error) {
    console.error("Error updating user last login:", error);
    // Don't throw - this is not critical
  }
}
