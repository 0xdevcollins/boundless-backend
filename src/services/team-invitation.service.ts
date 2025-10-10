import crypto from "crypto";
import mongoose from "mongoose";
import TeamInvitation, {
  TeamInvitationStatus,
  ITeamInvitation,
} from "../models/team-invitation.model";
import User from "../models/user.model";
import Project from "../models/project.model";
import { sendEmail } from "../utils/email.utils";
import EmailTemplatesService from "./email-templates.service";

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
