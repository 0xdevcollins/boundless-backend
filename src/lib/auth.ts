import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { emailOTP } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { config } from "../config/main.config";
import { sendEmail } from "../utils/email.utils";
import EmailTemplatesService from "../services/email/email-templates.service";
import { syncBetterAuthUser } from "./auth-sync";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
// Create a separate MongoClient for Better Auth
// This ensures type compatibility with Better Auth's MongoDB adapter
let betterAuthClient: MongoClient | null = null;
let betterAuthDb: ReturnType<MongoClient["db"]> | null = null;

const client = new MongoClient(process.env.MONGODB_URI || "");
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    usePlural: true, // Use plural collection names (users) to match backend Mongoose model
  }),
  // baseURL should be the backend server URL, not frontend
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.BASE_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://boundlessfi.xyz"
      : "http://localhost:8000"),
  // basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // We'll use OTP for verification
    sendResetPassword: async ({ user, url, token }, request) => {
      const emailTemplate = EmailTemplatesService.getTemplate(
        "password-reset",
        {
          resetToken: token,
          firstName: user.name?.split(" ")[0] || "User",
          recipientName: user.name?.split(" ")[0] || "User",
        },
      );

      await sendEmail({
        to: user.email,
        subject: emailTemplate.subject,
        text: `Click the link to reset your password: ${url}`,
        html: emailTemplate.html,
      });
    },
    onPasswordReset: async ({ user }, request) => {
      // Execute logic after password has been successfully reset
      console.log(`Password for user ${user.email} has been reset.`);

      // Optionally send a confirmation email
      try {
        const emailTemplate = EmailTemplatesService.getTemplate(
          "password-reset",
          {
            resetToken: "completed",
            firstName: user.name?.split(" ")[0] || "User",
            recipientName: user.name?.split(" ")[0] || "User",
          },
        );

        await sendEmail({
          to: user.email,
          subject: "Password Reset Successful",
          text: `Your password has been successfully reset. If you did not request this change, please contact support immediately.`,
          html: `<p>Your password has been successfully reset. If you did not request this change, please contact support immediately.</p>`,
        });
      } catch (error) {
        console.error(
          "Failed to send password reset confirmation email:",
          error,
        );
        // Don't throw - email sending failure shouldn't break password reset
      }
    },
  },
  socialProviders: {
    google: {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
    },
  },
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        let emailTemplate;
        let subject = "Your verification code";
        let text = `Your verification code is: ${otp}`;

        if (type === "email-verification") {
          emailTemplate = EmailTemplatesService.getTemplate(
            "otp-verification",
            {
              otpCode: otp,
              firstName: "User",
              recipientName: "User",
            },
          );
          subject = emailTemplate.subject;
          text = `Your email verification code is: ${otp}`;
        } else if (type === "sign-in") {
          emailTemplate = EmailTemplatesService.getTemplate(
            "otp-verification",
            {
              otpCode: otp,
              firstName: "User",
              recipientName: "User",
            },
          );
          subject = emailTemplate.subject;
          text = `Your sign-in code is: ${otp}`;
        } else if (type === "forget-password") {
          emailTemplate = EmailTemplatesService.getTemplate("password-reset", {
            resetToken: otp,
            firstName: "User",
            recipientName: "User",
          });
          subject = emailTemplate.subject;
          text = `Your password reset code is: ${otp}`;
        }

        await sendEmail({
          to: email,
          subject: subject,
          text: text,
          html:
            emailTemplate?.html ||
            `<p>Your code is: <strong>${otp}</strong></p>`,
        });
      },
    }),
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Access the new session from context (created after sign-up/sign-in)
      const newSession = ctx.context.newSession;

      if (!newSession || !newSession.user) {
        return; // No user created, skip sync
      }

      const user = newSession.user;

      // Handle team invitations after sign-up
      if (ctx.path === "/sign-up/email") {
        // Check both body and query for invitation token
        const invitationToken =
          (ctx.body?.invitation as string | undefined) ||
          (ctx.query?.invitation as string | undefined);

        if (invitationToken) {
          try {
            await syncBetterAuthUser(user.id, user.email, {
              invitationToken,
            });
          } catch (error) {
            console.error("Error handling invitation during sign-up:", error);
            // Don't fail the sign-up if invitation handling fails
          }
        } else {
          // Sync user even without invitation
          await syncBetterAuthUser(user.id, user.email);
        }
      }

      // Handle team invitations after OAuth sign-in
      if (ctx.path === "/sign-in/social" || ctx.path.startsWith("/callback/")) {
        // Check both body and query for invitation token
        const invitationToken =
          (ctx.body?.invitation as string | undefined) ||
          (ctx.query?.invitation as string | undefined);

        // Extract user info from Better Auth user
        const firstName = user.name?.split(" ")[0] || "";
        const lastName = user.name?.split(" ").slice(1).join(" ") || "";
        const avatar = user.image || "";

        if (invitationToken) {
          try {
            await syncBetterAuthUser(user.id, user.email, {
              invitationToken,
              firstName,
              lastName,
              avatar,
            });
          } catch (error) {
            console.error("Error handling invitation during OAuth:", error);
          }
        } else {
          // Sync user even without invitation
          await syncBetterAuthUser(user.id, user.email, {
            firstName,
            lastName,
            avatar,
          });
        }
      }

      // Sync user after email verification and update verification status
      if (ctx.path === "/email-otp/verify-email") {
        await syncBetterAuthUser(user.id, user.email);
        // Update user verification status
        const { updateUserVerificationStatus } = await import("./auth-sync");
        await updateUserVerificationStatus(user.email, true);
      }
    }),
  },
  // trustedOrigins must be at the top level (not inside advanced)
  // Must include exactly the origins your browser uses (protocol, hostname, and port must all match)
  trustedOrigins: [
    "https://boundlessfi.xyz",
    "https://www.boundlessfi.xyz",
    "https://staging.boundlessfi.xyz",
    "https://www.staging.boundlessfi.xyz",
    "http://localhost:3000",
    "http://localhost:8000", // For local development
  ],
});
