import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import {
  customSession,
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
import { checkProfileCompleteness } from "../utils/profile.utils.js";
import Organization from "../models/organization.model.js";
import NotificationService from "../features/notifications/notification.service.js";
import { NotificationType } from "../models/notification.model.js";
import User from "../models/user.model.js";
import Project from "../models/project.model.js";
import Activity from "../models/activity.model.js";
import Follow from "../models/follow.model.js";
import Comment from "../models/comment.model.js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new MongoClient(process.env.MONGODB_URI || "");
const db = client.db();
const production = process.env.NODE_ENV === "production";
export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    usePlural: true,
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  baseURL: config.BETTER_AUTH_URL,
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
    cookiePrefix: "boundless_auth",
    ...(production
      ? {
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: true,
          },
          useSecureCookies: true,
          crossSubDomainCookies: {
            enabled: true,
            domain: ".boundlessfi.xyz",
          },
        }
      : {
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: false,
          },
          useSecureCookies: false,
        }),
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        },
        ...(production
          ? {
              secure: true,
              domain: ".boundlessfi.xyz",
            }
          : {}),
      },
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
    customSession(async ({ user, session }) => {
      // Get the user from our custom User model to match /users/me structure
      const customUser = await User.findOne({
        email: user.email.toLowerCase(),
        deleted: { $ne: true },
      }).select("-password");

      if (!customUser) {
        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          },
        };
      }

      const userId = customUser._id;

      // Get user's projects
      const projects = await Project.find({ "owner.type": userId })
        .select(
          "title description media tags category type funding voting milestones createdAt updatedAt",
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      // Get user's activities
      const activities = await Activity.find({ userId: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate({
          path: "details.projectId",
          select: "title media",
        })
        .lean();

      // Get user's organizations (exclude archived)
      const userOrganizations = await Organization.find({
        $or: [{ members: customUser?.email }, { owner: customUser?.email }],
        archived: { $ne: true },
      })
        .select(
          "_id name logo tagline about isProfileComplete owner members hackathons grants createdAt",
        )
        .lean();

      // Get following users (exclude deleted)
      const following = await Follow.find({
        follower: userId,
        status: "ACTIVE",
      })
        .populate({
          path: "following",
          select: "profile firstName lastName username avatar bio",
          match: { deleted: { $ne: true } },
        })
        .sort({ followedAt: -1 })
        .limit(10)
        .lean();

      // Get followers (exclude deleted)
      const followers = await Follow.find({
        following: userId,
        status: "ACTIVE",
      })
        .populate({
          path: "follower",
          select: "profile firstName lastName username avatar bio",
          match: { deleted: { $ne: true } },
        })
        .sort({ followedAt: -1 })
        .limit(10)
        .lean();

      // Calculate additional stats
      const [
        totalProjectsCreated,
        totalProjectsFunded,
        totalComments,
        totalVotes,
        totalGrants,
        totalHackathons,
        totalDonations,
      ] = await Promise.all([
        Project.countDocuments({ "owner.type": userId }),
        Project.countDocuments({ "funding.contributors.user": userId }),
        Comment.countDocuments({ author: userId }),
        Project.aggregate([
          { $match: { "voting.voters.userId": userId } },
          { $count: "total" },
        ]).then((result) => result[0]?.total || 0),
        Project.countDocuments({ "owner.type": userId, "grant.isGrant": true }),
        Project.countDocuments({ "owner.type": userId, category: "hackathon" }),
        Project.aggregate([
          { $match: { "funding.contributors.user": userId } },
          { $unwind: "$funding.contributors" },
          { $match: { "funding.contributors.user": userId } },
          {
            $group: {
              _id: null,
              total: { $sum: "$funding.contributors.amount" },
            },
          },
        ]).then((result) => result[0]?.total || 0),
      ]);

      // Check if profile is complete
      const profileCompleteness = checkProfileCompleteness(customUser);
      const isProfileComplete = profileCompleteness.isComplete;

      // Format projects data
      const formattedProjects = projects.map((project) => {
        const progress =
          project.funding.goal > 0
            ? Math.round((project.funding.raised / project.funding.goal) * 100)
            : 0;

        const daysLeft = project.funding.endDate
          ? Math.max(
              0,
              Math.ceil(
                (new Date(project.funding.endDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0;

        return {
          id: project._id.toString(),
          name: project.title,
          description: project.description,
          image: project.media?.banner || project.media?.logo,
          link: project.projectWebsite || `#`,
          tags: project.tags || [],
          category: project.category,
          type: project.type,
          amount: project.funding.goal,
          status: project.status,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          owner: customUser?.profile.username,
          ownerName: `${customUser?.profile.firstName} ${customUser?.profile.lastName}`,
          ownerUsername: customUser?.profile.username,
          ownerAvatar: customUser?.profile.avatar,
          votes: {
            current: project.voting?.positiveVotes || 0,
            total: project.voting?.totalVotes || 0,
          },
          daysLeft,
          progress,
        };
      });

      // Format activities data
      const formattedActivities = activities.map((activity) => {
        const project = activity.details.projectId as any;
        return {
          id: activity._id.toString(),
          type: activity.type.toLowerCase(),
          description: `${activity.type.replace(/_/g, " ").toLowerCase()} ${project?.title || "project"}`,
          projectName: project?.title || "Unknown Project",
          projectId: project?._id?.toString(),
          amount: activity.details.amount || null,
          timestamp: activity.createdAt,
          image: project?.media?.banner || project?.media?.logo,
          emoji: getActivityEmoji(activity.type),
        };
      });

      // Format organizations data
      const formattedOrganizations = userOrganizations.map((org) => ({
        id: org._id.toString(),
        name: org.name,
        avatar: org.logo,
        joinedAt: new Date().toISOString(), // This would need to be from the membership
        description: org.about,
        tagline: org.tagline,
        isProfileComplete: org.isProfileComplete || false,
        role:
          org.owner === (customUser?.email || "")
            ? ("owner" as const)
            : ("member" as const),
        memberCount: org.members?.length || 0,
        hackathonCount: org.hackathons?.length || 0,
        grantCount: org.grants?.length || 0,
        createdAt: org.createdAt
          ? new Date(org.createdAt).toISOString()
          : new Date().toISOString(),
      }));

      // Format following data
      const formattedFollowing = following.map((follow) => {
        const followedUser = follow.following as any;
        return {
          id: followedUser._id.toString(),
          profile: {
            firstName: followedUser.profile.firstName,
            lastName: followedUser.profile.lastName,
            username: followedUser.profile.username,
            avatar: followedUser.profile.avatar,
            bio: followedUser.profile.bio,
          },
          followedAt: follow.followedAt,
        };
      });

      // Format followers data
      const formattedFollowers = followers.map((follow) => {
        const followerUser = follow.follower as any;
        return {
          id: followerUser._id.toString(),
          profile: {
            firstName: followerUser.profile.firstName,
            lastName: followerUser.profile.lastName,
            username: followerUser.profile.username,
            avatar: followerUser.profile.avatar,
            bio: followerUser.profile.bio,
          },
          followedAt: follow.followedAt,
        };
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          profile: {
            firstName: customUser?.profile.firstName,
            lastName: customUser?.profile.lastName,
            username: customUser?.profile.username,
            avatar: customUser?.profile.avatar,
            bio: customUser?.profile.bio,
            location: customUser?.profile.location,
            website: customUser?.profile.website,
            socialLinks: customUser?.profile.socialLinks,
          },
          stats: {
            projectsCreated: totalProjectsCreated,
            projectsFunded: totalProjectsFunded,
            totalContributed: customUser?.stats.totalContributed || 0,
            reputation: customUser?.stats.reputation || 0,
            communityScore: customUser?.stats.communityScore || 0,
            commentsPosted: totalComments,
            organizations: userOrganizations.length,
            following: following.length,
            followers: followers.length,
            votes: totalVotes,
            grants: totalGrants,
            hackathons: totalHackathons,
            donations: totalDonations,
          },
          organizations: formattedOrganizations,
          following: formattedFollowing,
          followers: formattedFollowers,
          projects: formattedProjects,
          activities: formattedActivities,
          _id: customUser?._id,
          isVerified: customUser?.emailVerified,
          contributedProjects: [], // This would need to be populated with actual contributed projects
          createdAt: (customUser as any)?.createdAt,
          updatedAt: (customUser as any)?.updatedAt,
          __v: customUser?.__v,
          lastLogin: customUser?.lastLogin,
          isProfileComplete,
          missingProfileFields: profileCompleteness.missingFields,
          profileCompletionPercentage: profileCompleteness.completionPercentage,
        },
      };
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
    "https://api.boundlessfi.xyz",
    "https://staging.api.boundlessfi.xyz",
    "https://admin.boundlessfi.xyz",
    "https://www.admin.boundlessfi.xyz",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://192.168.1.187:3000",
  ],
});

// Helper function to get emoji for activity type
const getActivityEmoji = (activityType: string): string => {
  const emojiMap: { [key: string]: string } = {
    LOGIN: "🔐",
    LOGOUT: "🚪",
    PASSWORD_CHANGED: "🔑",
    PROJECT_CREATED: "🚀",
    PROJECT_UPDATED: "📝",
    PROJECT_FUNDED: "💰",
    PROJECT_VOTED: "🗳️",
    CONTRIBUTION_MADE: "💸",
    REFUND_RECEIVED: "↩️",
    PROFILE_UPDATED: "👤",
    AVATAR_CHANGED: "🖼️",
    TEAM_JOINED: "👥",
    TEAM_LEFT: "👋",
    MILESTONE_CREATED: "🎯",
    MILESTONE_COMPLETED: "✅",
    MILESTONE_FUNDS_RELEASED: "💳",
    COMMENT_POSTED: "💬",
    COMMENT_LIKED: "👍",
    COMMENT_DISLIKED: "👎",
    USER_FOLLOWED: "👤",
    USER_UNFOLLOWED: "👤",
    ORGANIZATION_JOINED: "🏢",
    ORGANIZATION_LEFT: "🏢",
  };
  return emojiMap[activityType] || "📝";
};
