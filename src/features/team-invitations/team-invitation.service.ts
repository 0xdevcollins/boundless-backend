import crypto from "crypto";
import mongoose from "mongoose";
import TeamInvitation, {
  TeamInvitationStatus,
  ITeamInvitation,
} from "../../models/team-invitation.model.js";
import User from "../../models/user.model.js";
import Project from "../../models/project.model.js";
import { sendEmail } from "../../utils/email.utils.js";
import EmailTemplatesService from "../../services/email/email-templates.service.js";

export interface CreateTeamInvitationData {
  projectId: string;
  invitedBy: string;
  email: string;
  role?: string; // Optional - defaults to "Team Member"
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface TeamInvitationResult {
  invitation: ITeamInvitation;
  isNewUser: boolean;
  user?: any;
}

export class TeamInvitationService {
  /**
   * Create team invitation for a project
   */
  static async createInvitation(
    data: CreateTeamInvitationData,
  ): Promise<TeamInvitationResult> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        email: data.email.toLowerCase(),
      });

      // Check if there's already a pending invitation for this email and project
      const existingInvitation = await TeamInvitation.findOne({
        email: data.email.toLowerCase(),
        projectId: data.projectId,
        status: TeamInvitationStatus.PENDING,
      });

      if (existingInvitation && !(existingInvitation as any).isExpired) {
        throw new Error(
          "Invitation already sent to this email for this project",
        );
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString("hex");

      // Create invitation
      const invitation = new TeamInvitation({
        projectId: data.projectId,
        invitedBy: data.invitedBy,
        email: data.email.toLowerCase(),
        role: data.role || "Team Member", // Default role if not provided
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: {
          ...data.metadata,
          invitedAt: new Date(),
        },
        ...(existingUser && { invitedUser: existingUser._id }),
      });

      await invitation.save();

      // Send invitation email
      await this.sendInvitationEmail(invitation, existingUser);

      // Send notifications
      try {
        const NotificationService = (
          await import("../notifications/notification.service.js")
        ).default;
        const EmailTemplatesService = (
          await import("../../services/email/email-templates.service.js")
        ).default;
        const { NotificationType } = await import(
          "../../models/notification.model.js"
        );
        const { config } = await import("../../config/main.config.js");
        const frontendUrl =
          process.env.FRONTEND_URL ||
          config.cors.origin ||
          "https://boundlessfi.xyz";
        const baseUrl = Array.isArray(frontendUrl)
          ? frontendUrl[0]
          : frontendUrl;

        // Get project details
        const Project = (await import("../../models/project.model.js")).default;
        const project = await Project.findById(data.projectId).select(
          "title creator",
        );
        const projectName = (project as any)?.title || "a project";

        // Get inviter details
        const User = (await import("../../models/user.model.js")).default;
        const inviter = await User.findById(data.invitedBy).select(
          "email profile.firstName profile.lastName",
        );
        const inviterName = inviter
          ? `${inviter.profile?.firstName || ""} ${inviter.profile?.lastName || ""}`.trim() ||
            inviter.email
          : "Someone";

        // Notify invited user (if registered)
        if (existingUser) {
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
              type: NotificationType.TEAM_INVITATION_SENT,
              title: `Invited to join ${projectName}`,
              message: `${inviterName} has invited you to join the team for "${projectName}"`,
              data: {
                teamInvitationId: invitation._id,
                projectId: new (
                  await import("mongoose")
                ).default.Types.ObjectId(data.projectId),
                projectName,
                role: invitation.role,
              },
              emailTemplate: EmailTemplatesService.getTemplate(
                "team-invitation-sent",
                {
                  projectId: data.projectId,
                  projectName,
                  inviterName,
                  role: invitation.role,
                  token: invitation.token,
                  acceptUrl: `${baseUrl}/team-invitations/${invitation.token}/accept`,
                  unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(existingUser.email)}`,
                },
              ),
              sendEmail: false, // Email already sent above
              sendInApp: true,
            },
          );
        }

        // Notify project creator (if not the inviter)
        if (project && (project as any).creator) {
          const creatorId = (project as any).creator.toString();
          const inviterId = data.invitedBy.toString();
          if (creatorId !== inviterId) {
            const creator = await User.findById(creatorId).select(
              "email profile.firstName profile.lastName settings.notifications",
            );
            if (creator) {
              await NotificationService.sendSingleNotification(
                {
                  userId: creator._id,
                  email: creator.email,
                  name:
                    `${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""}`.trim() ||
                    creator.email,
                  preferences: creator.settings?.notifications,
                },
                {
                  type: NotificationType.TEAM_INVITATION_SENT,
                  title: `Team invitation sent for ${projectName}`,
                  message: `${inviterName} has invited ${data.email} to join the team for "${projectName}"`,
                  data: {
                    teamInvitationId: invitation._id,
                    projectId: new (
                      await import("mongoose")
                    ).default.Types.ObjectId(data.projectId),
                    projectName,
                    memberEmail: data.email,
                  },
                  sendEmail: false,
                  sendInApp: true,
                },
              );
            }
          }
        }
      } catch (notificationError) {
        console.error(
          "Error sending team invitation notifications:",
          notificationError,
        );
        // Don't fail the whole operation if notification fails
      }

      return {
        invitation,
        isNewUser: !existingUser,
        user: existingUser,
      };
    } catch (error) {
      console.error("Error creating team invitation:", error);
      throw error;
    }
  }

  /**
   * Send invitation email
   */
  private static async sendInvitationEmail(
    invitation: ITeamInvitation,
    existingUser?: any,
  ): Promise<void> {
    try {
      // Get project details
      const project = await Project.findById(invitation.projectId).populate(
        "creator",
        "profile.firstName profile.lastName profile.username",
      );

      if (!project) {
        throw new Error("Project not found");
      }

      const invitationUrl = `${process.env.FRONTEND_URL}/team-invitation/${invitation.token}`;
      const projectUrl = `${process.env.FRONTEND_URL}/projects/${project._id}`;

      if (existingUser) {
        // Send invitation to existing user
        const emailTemplate = EmailTemplatesService.getTemplate(
          "team-invitation-existing-user",
          {
            recipientName: existingUser.profile?.firstName || "Team Member",
            projectTitle: project.title,
            projectId: project._id,
            role: invitation.role,
            inviterName:
              `${(project.creator as any)?.profile?.firstName || ""} ${(project.creator as any)?.profile?.lastName || ""}`.trim() ||
              "Project Creator",
            invitationUrl,
            projectUrl,
            expiresAt: invitation.expiresAt,
          },
        );

        await sendEmail({
          to: invitation.email,
          subject: emailTemplate.subject,
          text: `You've been invited to join the team for "${project.title}" as ${invitation.role}. Click here to accept: ${invitationUrl}`,
          html: emailTemplate.html,
        });
      } else {
        // Send invitation to new user with registration link
        const registrationUrl = `${process.env.FRONTEND_URL}/register?invitation=${invitation.token}`;

        const emailTemplate = EmailTemplatesService.getTemplate(
          "team-invitation-new-user",
          {
            recipientName: "New Team Member",
            projectTitle: project.title,
            projectId: project._id,
            role: invitation.role,
            inviterName:
              `${(project.creator as any)?.profile?.firstName || ""} ${(project.creator as any)?.profile?.lastName || ""}`.trim() ||
              "Project Creator",
            registrationUrl,
            invitationUrl,
            projectUrl,
            expiresAt: invitation.expiresAt,
          },
        );

        await sendEmail({
          to: invitation.email,
          subject: emailTemplate.subject,
          text: `You've been invited to join the team for "${project.title}" as ${invitation.role}. Register here: ${registrationUrl}`,
          html: emailTemplate.html,
        });
      }
    } catch (error) {
      console.error("Error sending team invitation email:", error);
      throw error;
    }
  }

  /**
   * Accept team invitation
   */
  static async acceptInvitation(
    token: string,
    userId?: string,
    role?: string,
  ): Promise<{ invitation: ITeamInvitation; project: any }> {
    try {
      const invitation = await TeamInvitation.findOne({ token });

      if (!invitation) {
        throw new Error("Invalid invitation token");
      }

      if (!(invitation as any).isValid()) {
        throw new Error("Invitation has expired or is no longer valid");
      }

      // Update role if provided
      if (role && role.trim()) {
        invitation.role = role.trim();
        await invitation.save();
      }

      // Accept the invitation
      await (invitation as any).accept(
        userId ? new mongoose.Types.ObjectId(userId) : undefined,
      );

      // Get project details
      const project = await Project.findById(invitation.projectId).populate(
        "creator",
        "profile.firstName profile.lastName profile.username",
      );

      if (!project) {
        throw new Error("Project not found");
      }

      // Add user to project team if they have an account
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          // Check if user is already in the team
          const existingTeamMember = project.team.find(
            (member: any) => member.userId.toString() === userId,
          );

          if (!existingTeamMember) {
            project.team.push({
              userId: new mongoose.Types.ObjectId(userId) as any,
              role: invitation.role,
              joinedAt: new Date(),
            });

            await project.save();
          }
        }
      }

      // Send notifications
      try {
        const NotificationService = (
          await import("../notifications/notification.service.js")
        ).default;
        const EmailTemplatesService = (
          await import("../../services/email/email-templates.service.js")
        ).default;
        const { NotificationType } = await import(
          "../../models/notification.model.js"
        );
        const { config } = await import("../../config/main.config.js");
        const frontendUrl =
          process.env.FRONTEND_URL ||
          config.cors.origin ||
          "https://boundlessfi.xyz";
        const baseUrl = Array.isArray(frontendUrl)
          ? frontendUrl[0]
          : frontendUrl;

        const projectName = (project as any)?.title || "a project";
        const User = (await import("../../models/user.model.js")).default;

        // Get accepted user details
        let acceptedUser = null;
        let memberName = invitation.email;
        let memberEmail = invitation.email;
        if (userId) {
          acceptedUser = await User.findById(userId).select(
            "email profile.firstName profile.lastName settings.notifications",
          );
          if (acceptedUser) {
            memberName =
              `${acceptedUser.profile?.firstName || ""} ${acceptedUser.profile?.lastName || ""}`.trim() ||
              acceptedUser.email;
            memberEmail = acceptedUser.email;
          }
        }

        // Notify the accepted user
        if (acceptedUser) {
          await NotificationService.sendSingleNotification(
            {
              userId: acceptedUser._id,
              email: acceptedUser.email,
              name: memberName,
              preferences: acceptedUser.settings?.notifications,
            },
            {
              type: NotificationType.TEAM_INVITATION_ACCEPTED,
              title: `You've joined ${projectName}`,
              message: `You have successfully joined the team for "${projectName}"`,
              data: {
                teamInvitationId: invitation._id,
                projectId: new mongoose.Types.ObjectId(
                  invitation.projectId.toString(),
                ),
                projectName,
                role: invitation.role,
              },
              emailTemplate: EmailTemplatesService.getTemplate(
                "team-invitation-accepted",
                {
                  projectId: invitation.projectId.toString(),
                  projectName,
                  memberName,
                  memberEmail,
                  unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(acceptedUser.email)}`,
                },
              ),
            },
          );
        }

        // Notify project creator and team members
        if (project && (project as any).creator) {
          const creator = await User.findById((project as any).creator).select(
            "email profile.firstName profile.lastName settings.notifications",
          );

          if (creator) {
            await NotificationService.sendSingleNotification(
              {
                userId: creator._id,
                email: creator.email,
                name:
                  `${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""}`.trim() ||
                  creator.email,
                preferences: creator.settings?.notifications,
              },
              {
                type: NotificationType.TEAM_INVITATION_ACCEPTED,
                title: `New team member joined ${projectName}`,
                message: `${memberName} (${memberEmail}) has accepted the invitation and joined the team for "${projectName}"`,
                data: {
                  teamInvitationId: invitation._id,
                  projectId: new mongoose.Types.ObjectId(
                    invitation.projectId.toString(),
                  ),
                  projectName,
                  memberEmail,
                  memberName,
                },
                emailTemplate: EmailTemplatesService.getTemplate(
                  "team-invitation-accepted",
                  {
                    projectId: invitation.projectId.toString(),
                    projectName,
                    memberName,
                    memberEmail,
                    unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(creator.email)}`,
                  },
                ),
              },
            );
          }

          // Notify other team members
          if (project.team && Array.isArray(project.team)) {
            const teamMemberIds = project.team
              .map((member: any) => member.userId?.toString())
              .filter(
                (id: string) =>
                  id &&
                  id !== userId &&
                  id !== (project as any).creator?.toString(),
              );

            if (teamMemberIds.length > 0) {
              const teamMembers = await User.find({
                _id: { $in: teamMemberIds },
              }).select(
                "email profile.firstName profile.lastName settings.notifications",
              );

              await NotificationService.notifyTeamMembers(
                teamMembers.map((member) => ({
                  userId: member._id,
                  email: member.email,
                  name:
                    `${member.profile?.firstName || ""} ${member.profile?.lastName || ""}`.trim() ||
                    member.email,
                })),
                {
                  type: NotificationType.TEAM_INVITATION_ACCEPTED,
                  title: `New team member joined ${projectName}`,
                  message: `${memberName} has joined the team for "${projectName}"`,
                  data: {
                    teamInvitationId: invitation._id,
                    projectId: new mongoose.Types.ObjectId(
                      invitation.projectId.toString(),
                    ),
                    projectName,
                    memberEmail,
                    memberName,
                  },
                  sendEmail: false,
                  sendInApp: true,
                },
              );
            }
          }
        }
      } catch (notificationError) {
        console.error(
          "Error sending team invitation accepted notifications:",
          notificationError,
        );
        // Don't fail the whole operation if notification fails
      }

      return { invitation, project };
    } catch (error) {
      console.error("Error accepting team invitation:", error);
      throw error;
    }
  }

  /**
   * Decline team invitation
   */
  static async declineInvitation(token: string): Promise<ITeamInvitation> {
    try {
      const invitation = await TeamInvitation.findOne({ token });

      if (!invitation) {
        throw new Error("Invalid invitation token");
      }

      if (!(invitation as any).isValid()) {
        throw new Error("Invitation has expired or is no longer valid");
      }

      await (invitation as any).decline();

      // Send notifications
      try {
        const NotificationService = (
          await import("../notifications/notification.service.js")
        ).default;
        const EmailTemplatesService = (
          await import("../../services/email/email-templates.service.js")
        ).default;
        const { NotificationType } = await import(
          "../../models/notification.model.js"
        );
        const { config } = await import("../../config/main.config.js");
        const frontendUrl =
          process.env.FRONTEND_URL ||
          config.cors.origin ||
          "https://boundlessfi.xyz";
        const baseUrl = Array.isArray(frontendUrl)
          ? frontendUrl[0]
          : frontendUrl;

        const Project = (await import("../../models/project.model.js")).default;
        const project = await Project.findById(invitation.projectId).select(
          "title creator",
        );
        const projectName = (project as any)?.title || "a project";

        // Notify project creator
        if (project && (project as any).creator) {
          const User = (await import("../../models/user.model.js")).default;
          const creator = await User.findById((project as any).creator).select(
            "email profile.firstName profile.lastName settings.notifications",
          );

          if (creator) {
            await NotificationService.sendSingleNotification(
              {
                userId: creator._id,
                email: creator.email,
                name:
                  `${creator.profile?.firstName || ""} ${creator.profile?.lastName || ""}`.trim() ||
                  creator.email,
                preferences: creator.settings?.notifications,
              },
              {
                type: NotificationType.TEAM_INVITATION_DECLINED,
                title: `Team invitation declined for ${projectName}`,
                message: `${invitation.email} has declined the invitation to join the team for "${projectName}"`,
                data: {
                  teamInvitationId: invitation._id,
                  projectId: new mongoose.Types.ObjectId(
                    invitation.projectId.toString(),
                  ),
                  projectName,
                  memberEmail: invitation.email,
                },
                emailTemplate: EmailTemplatesService.getTemplate(
                  "team-invitation-declined",
                  {
                    projectId: invitation.projectId.toString(),
                    projectName,
                    memberEmail: invitation.email,
                    unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(creator.email)}`,
                  },
                ),
              },
            );
          }
        }
      } catch (notificationError) {
        console.error(
          "Error sending team invitation declined notifications:",
          notificationError,
        );
        // Don't fail the whole operation if notification fails
      }

      return invitation;
    } catch (error) {
      console.error("Error declining team invitation:", error);
      throw error;
    }
  }

  /**
   * Get invitation by token
   */
  static async getInvitationByToken(
    token: string,
  ): Promise<ITeamInvitation | null> {
    try {
      return await TeamInvitation.findOne({ token })
        .populate("projectId", "title description")
        .populate("invitedBy", "profile.firstName profile.lastName");
    } catch (error) {
      console.error("Error getting invitation by token:", error);
      throw error;
    }
  }

  /**
   * Get invitations for a project
   */
  static async getProjectInvitations(
    projectId: string,
  ): Promise<ITeamInvitation[]> {
    try {
      return await TeamInvitation.find({ projectId })
        .populate("invitedBy", "profile.firstName profile.lastName")
        .populate(
          "invitedUser",
          "profile.firstName profile.lastName profile.username",
        )
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error("Error getting project invitations:", error);
      throw error;
    }
  }

  /**
   * Get invitations for a user
   */
  static async getUserInvitations(email: string): Promise<ITeamInvitation[]> {
    try {
      return await TeamInvitation.find({ email: email.toLowerCase() })
        .populate("projectId", "title description")
        .populate("invitedBy", "profile.firstName profile.lastName")
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error("Error getting user invitations:", error);
      throw error;
    }
  }

  /**
   * Cancel invitation
   */
  static async cancelInvitation(
    invitationId: string,
    _cancelledBy: string,
  ): Promise<ITeamInvitation> {
    try {
      const invitation = await TeamInvitation.findById(invitationId);

      if (!invitation) {
        throw new Error("Invitation not found");
      }

      if (invitation.status !== TeamInvitationStatus.PENDING) {
        throw new Error("Invitation cannot be cancelled");
      }

      invitation.status = TeamInvitationStatus.DECLINED;
      invitation.declinedAt = new Date();
      await invitation.save();

      // Send notifications
      try {
        const NotificationService = (
          await import("../notifications/notification.service.js")
        ).default;
        const EmailTemplatesService = (
          await import("../../services/email/email-templates.service.js")
        ).default;
        const { NotificationType } = await import(
          "../../models/notification.model.js"
        );
        const { config } = await import("../../config/main.config.js");
        const frontendUrl =
          process.env.FRONTEND_URL ||
          config.cors.origin ||
          "https://boundlessfi.xyz";
        const baseUrl = Array.isArray(frontendUrl)
          ? frontendUrl[0]
          : frontendUrl;

        const Project = (await import("../../models/project.model.js")).default;
        const project = await Project.findById(invitation.projectId).select(
          "title",
        );
        const projectName = (project as any)?.title || "a project";

        // Notify invited user (if registered)
        if (invitation.invitedUser) {
          const User = (await import("../../models/user.model.js")).default;
          const invitedUser = await User.findById(
            invitation.invitedUser,
          ).select(
            "email profile.firstName profile.lastName settings.notifications",
          );

          if (invitedUser) {
            await NotificationService.sendSingleNotification(
              {
                userId: invitedUser._id,
                email: invitedUser.email,
                name:
                  `${invitedUser.profile?.firstName || ""} ${invitedUser.profile?.lastName || ""}`.trim() ||
                  invitedUser.email,
                preferences: invitedUser.settings?.notifications,
              },
              {
                type: NotificationType.TEAM_INVITATION_CANCELLED,
                title: `Team invitation cancelled for ${projectName}`,
                message: `The team invitation for "${projectName}" has been cancelled.`,
                data: {
                  teamInvitationId: invitation._id,
                  projectId: new mongoose.Types.ObjectId(
                    invitation.projectId.toString(),
                  ),
                  projectName,
                },
                emailTemplate: EmailTemplatesService.getTemplate(
                  "team-invitation-cancelled",
                  {
                    projectId: invitation.projectId.toString(),
                    projectName,
                    unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(invitedUser.email)}`,
                  },
                ),
              },
            );
          }
        }
      } catch (notificationError) {
        console.error(
          "Error sending team invitation cancelled notifications:",
          notificationError,
        );
        // Don't fail the whole operation if notification fails
      }

      return invitation;
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      throw error;
    }
  }

  /**
   * Clean up expired invitations
   */
  static async cleanupExpiredInvitations(): Promise<number> {
    try {
      const result = await (TeamInvitation as any).cleanupExpired();
      return result.modifiedCount;
    } catch (error) {
      console.error("Error cleaning up expired invitations:", error);
      throw error;
    }
  }
}
