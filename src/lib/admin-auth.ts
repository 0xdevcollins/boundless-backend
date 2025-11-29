import { betterAuth, DBFieldType } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { passkey } from "@better-auth/passkey";
import { admin, emailOTP } from "better-auth/plugins";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { ac, adminRoles } from "./admin-permissions.js";

dotenv.config({ path: ".env.local" });

const client = new MongoClient(process.env.MONGODB_URI || "");
const db = client.db();

/**
 * Admin Authentication Configuration
 *
 * This is a separate Better Auth instance specifically for admin users.
 * Key differences from the main auth:
 * - Uses separate database tables (adminUsers, adminSessions, adminAccounts, adminPasskeys)
 * - Only supports passkey authentication (no email/password, no social providers)
 * - Has its own base path (/api/admin-auth)
 *
 * Admin users must be pre-registered in the system and can only authenticate
 * via passkeys for enhanced security.
 */
export const adminAuth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    usePlural: true,
  }),
  basePath: "/api/admin-auth",
  baseURL: process.env.BETTER_AUTH_URL || "https://api.boundlessfi.xyz",

  // Use custom table names for admin users
  user: {
    modelName: "adminUser",
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "admin",
        input: false,
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "pending",
        input: false,
      },
      permissions: {
        type: "string[]",
        required: false,
        defaultValue: [],
        input: false,
      },
      lastLogin: {
        type: "date",
        required: false,
        input: false,
      },
      needsInitialSetup: {
        type: "boolean" as DBFieldType,
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },

  session: {
    modelName: "adminSession",
    expiresIn: 60 * 60 * 8, // 8 hours for admin sessions (shorter for security)
    updateAge: 60 * 60, // Update session every hour
  },

  account: {
    modelName: "adminAccount",
  },

  // Disable email/password authentication for admins
  emailAndPassword: {
    enabled: false,
  },

  // No social providers for admin authentication
  socialProviders: {},

  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
    // Use a different cookie name to avoid conflicts with regular auth
    cookiePrefix: "admin_auth",
  },

  plugins: [
    passkey({
      rpID:
        process.env.NODE_ENV === "production" ? "boundlessfi.xyz" : "localhost",
      rpName: "Boundless Admin",
      origin:
        process.env.NODE_ENV === "production"
          ? "https://admin.boundlessfi.xyz"
          : "http://localhost:3000",
      authenticatorSelection: {
        // Require platform authenticators (built-in biometrics) for admin security
        authenticatorAttachment: "platform",
        // Require resident key (discoverable credential)
        residentKey: "required",
        // Require user verification (biometric/PIN)
        userVerification: "required",
      },
      advanced: {
        webAuthnChallengeCookie: "admin-passkey-challenge",
      },
    }),
    // Email OTP for temporary authentication during initial setup
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        // Send OTP email for admin setup
        console.log(`[ADMIN SETUP] Sending ${type} OTP ${otp} to ${email}`);

        // TODO: Implement actual email sending
        // For now, just log the OTP (replace with actual email service)
        console.log(`📧 ADMIN OTP: ${otp} (send this to ${email})`);
      },
      // Shorter OTP for better UX during setup
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      // Allow sign up for new admins during initial setup
      disableSignUp: false,
    }),
    // Admin plugin for user management capabilities
    // Allows authenticated admins to manage regular users
    admin({
      // Custom access control with fine-grained permissions
      ac,
      roles: adminRoles,
      // Default role for new users created by admins
      defaultRole: "user",
      // Ban message shown to banned users
      bannedUserMessage:
        "Your account has been suspended. Please contact support for assistance.",
      // Impersonation session duration (1 hour)
      impersonationSessionDuration: 60 * 60,
    }),
  ],

  trustedOrigins: [
    "https://admin.boundlessfi.xyz",
    "https://boundlessfi.xyz",
    "https://www.boundlessfi.xyz",
    "https://staging.boundlessfi.xyz",
    "http://localhost:3000",
    "http://localhost:8000",
  ],
});

/**
 * Type exports for admin auth
 */
export type AdminSession = typeof adminAuth.$Infer.Session;
export type AdminUser = (typeof adminAuth.$Infer.Session)["user"];
