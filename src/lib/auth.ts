import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { emailOTP, lastLoginMethod, oneTap } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { config } from "../config/main.config.js";
import { sendEmail } from "../utils/email.utils.js";
import EmailTemplatesService from "../services/email/email-templates.service.js";
import { syncBetterAuthUser } from "./auth-sync.js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

let betterAuthClient: MongoClient | null = null;
let betterAuthDb: ReturnType<MongoClient["db"]> | null = null;

const client = new MongoClient(process.env.MONGODB_URI || "");
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    usePlural: true,
  }),
  baseURL: process.env.BETTER_AUTH_URL || "https://api.boundlessfi.xyz",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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
      console.log(`Password for user ${user.email} has been reset.`);

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
      }
    },
  },
  socialProviders: {
    google: {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      redirectUri: config.GOOGLE_REDIRECT_URI,
      accessType: "offline",
      prompt: "select_account consent",
    },
    github: {
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  plugins: [
    lastLoginMethod({
      storeInDatabase: true,
      maxAge: 60 * 60 * 24 * 30,
    }),
    oneTap(),
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
      const newSession = ctx.context.newSession;

      if (!newSession || !newSession.user) {
        return;
      }

      const user = newSession.user;

      if (ctx.path === "/sign-up/email") {
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
          }
        } else {
          await syncBetterAuthUser(user.id, user.email);
        }
      }

      if (ctx.path === "/sign-in/social" || ctx.path.startsWith("/callback/")) {
        const invitationToken =
          (ctx.body?.invitation as string | undefined) ||
          (ctx.query?.invitation as string | undefined);

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
          await syncBetterAuthUser(user.id, user.email, {
            firstName,
            lastName,
            avatar,
          });
        }
      }

      if (ctx.path === "/email-otp/verify-email") {
        await syncBetterAuthUser(user.id, user.email);
        const { updateUserVerificationStatus } = await import("./auth-sync.js");
        await updateUserVerificationStatus(user.email, true);
      }
    }),
  },
  trustedOrigins: [
    "https://boundlessfi.xyz",
    "https://www.boundlessfi.xyz",
    "https://staging.boundlessfi.xyz",
    "https://www.staging.boundlessfi.xyz",
    "https://staging-api.boundlessfi.xyz",
    "https://api.boundlessfi.xyz",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://192.168.1.187:3000",
  ],
});
