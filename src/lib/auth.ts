import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import {
  emailOTP,
  lastLoginMethod,
  oneTap,
  organization,
} from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { MongoClient } from "mongodb";
import { config } from "../config/main.config.js";
import { sendEmail } from "../utils/email.utils.js";
import sendMail from "../utils/sendMail.utils.js";
import EmailTemplatesService from "../services/email/email-templates.service.js";
import { syncBetterAuthUser } from "./auth-sync.js";
import Organization from "../models/organization.model.js";
import NotificationService from "../features/notifications/notification.service.js";
import { NotificationType } from "../models/notification.model.js";
import User from "../models/user.model.js";
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
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
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
    organization({
      async sendInvitationEmail(data) {
        const originCfg = config.cors.origin;
        const baseUrl = Array.isArray(originCfg) ? originCfg[0] : originCfg;
        const acceptUrl = `${baseUrl}/accept-invitation/${data.id}`;

        // Check if user is registered
        const existingUser = await User.findOne({
          email: data.email.toLowerCase(),
        });

        if (existingUser) {
          // Registered user - send invitation email
          const emailTemplate = EmailTemplatesService.getTemplate(
            "organization-invite-sent",
            {
              organizationId: data.organization.id,
              organizationName: data.organization.name,
              inviterName:
                data.inviter.user.name || `${data.inviter.user.email}`,
              acceptUrl,
              unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(data.email)}`,
            },
          );

          await sendMail({
            to: data.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          });

          // Send in-app notification
          try {
            await NotificationService.sendSingleNotification(
              {
                userId: existingUser._id,
                email: existingUser.email,
                name:
                  `${existingUser.profile?.firstName || ""} ${existingUser.profile?.lastName || ""}`.trim() ||
                  existingUser.email,
                preferences: existingUser.settings?.notifications,
              },
              {
                type: NotificationType.ORGANIZATION_INVITE_SENT,
                title: `Invited to join ${data.organization.name}`,
                message: `${data.inviter.user.name || data.inviter.user.email} has invited you to join "${data.organization.name}"`,
                data: {
                  organizationId: data.organization.id,
                  organizationName: data.organization.name,
                  inviterName:
                    data.inviter.user.name || data.inviter.user.email,
                  acceptUrl,
                },
                emailTemplate,
                sendEmail: false, // Email already sent above
                sendInApp: true,
              },
            );
          } catch (notificationError) {
            console.error(
              `Error sending notification to ${data.email}:`,
              notificationError,
            );
          }
        } else {
          // Unregistered user - send signup invitation
          const signupUrl = `${baseUrl}/signup?invitationId=${encodeURIComponent(data.id)}&email=${encodeURIComponent(data.email)}`;
          await sendMail({
            to: data.email,
            subject: `Join ${data.organization.name} on Boundless`,
            html: `
              <p>Hello,</p>
              <p>You have been invited to join <strong>${data.organization.name}</strong> on Boundless.</p>
              <p><a href="${signupUrl}">Create your account and join</a></p>
              <p>If you did not expect this, you can ignore this email.</p>
            `.trim(),
          });
        }
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization, member, user }) => {
          // Link existing custom Organization to Better Auth org if it exists
          // NOTE: Actual creation is handled by the createOrganization controller
          // This hook only handles linking existing orgs (e.g., from migration)
          try {
            // Use findOneAndUpdate to avoid full validation on legacy data
            const result = await Organization.findOneAndUpdate(
              {
                name: {
                  $regex: new RegExp(
                    `^${organization.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                    "i",
                  ),
                },
                betterAuthOrgId: { $exists: false },
              },
              { $set: { betterAuthOrgId: organization.id } },
              { new: true },
            );

            if (result) {
              console.log(
                `Linked existing custom organization "${organization.name}" to Better Auth org ${organization.id}`,
              );
            }
            // Custom org creation is handled by the controller, not the hook
          } catch (error) {
            console.error("Error in afterCreateOrganization hook:", error);
          }
        },
        afterAcceptInvitation: async ({
          invitation,
          member,
          user,
          organization,
        }) => {
          // Sync member to custom Organization model
          try {
            const customOrg = await Organization.findOne({
              betterAuthOrgId: organization.id,
            });

            if (customOrg) {
              const userEmail = user.email.toLowerCase();
              if (!customOrg.members.includes(userEmail)) {
                customOrg.members.push(userEmail);
                await customOrg.save();
              }
            }
          } catch (error) {
            console.error(
              "Error syncing member to custom organization:",
              error,
            );
          }
        },
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
    "https://staging.api.boundlessfi.xyz",
    "https://admin.boundlessfi.xyz",
    "https://www.admin.boundlessfi.xyz",
  ],
});
