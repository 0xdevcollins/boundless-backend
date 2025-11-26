import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import HackathonTeamInvitation, {
  HackathonTeamInvitationStatus,
} from "../../models/hackathon-team-invitation.model.js";
import User from "../../models/user.model.js";
import Hackathon from "../../models/hackathon.model.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendConflict,
  sendInternalServerError,
} from "../../utils/apiResponse.js";
import {
  AuthenticatedRequest,
  resolveHackathonByIdOrSlug,
  isRegistrationOpen,
} from "./hackathon.helpers.js";
import { sendEmail } from "../../utils/email.utils.js";
import { config } from "../../config/main.config.js";

/**
 * Invite team member
 * POST /organizations/{orgId}/hackathons/{hackathonId}/team/invite
 * POST /hackathons/{hackathonSlugOrId}/team/invite
 */
export const inviteTeamMember = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, orgId, hackathonId } = req.params;
    const { email, role = "member" } = req.body;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Find participant (must be registered and part of a team)
    const participant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: user._id,
      participationType: "team",
    });

    if (!participant || !participant.teamId) {
      sendBadRequest(
        res,
        "You must be registered as a team member to invite others",
      );
      return;
    }

    // Check if user is team leader
    const isLeader =
      participant.teamMembers?.some(
        (m) =>
          m.userId.toString() === user._id.toString() && m.role === "leader",
      ) || participant.teamMembers?.length === 1; // If only one member, they're the leader

    if (!isLeader) {
      sendForbidden(res, "Only team leaders can invite members");
      return;
    }

    // Check if email is already a team member
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      const isAlreadyMember = participant.teamMembers?.some(
        (m) => m.userId.toString() === existingUser._id.toString(),
      );

      if (isAlreadyMember) {
        sendConflict(res, "User is already a team member");
        return;
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation = await HackathonTeamInvitation.findOne({
      hackathonId: hackathon._id,
      teamId: participant.teamId,
      email: email.toLowerCase(),
      status: HackathonTeamInvitationStatus.PENDING,
    });

    if (existingInvitation && (existingInvitation as any).isValid()) {
      sendConflict(res, "Invitation already sent to this email");
      return;
    }

    // Check team size limits
    const currentMemberCount = participant.teamMembers?.length || 0;
    if (hackathon.teamMax && currentMemberCount >= hackathon.teamMax) {
      sendBadRequest(
        res,
        `Team has reached maximum size of ${hackathon.teamMax}`,
      );
      return;
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString("hex");

    // Create invitation
    const invitation = await HackathonTeamInvitation.create({
      hackathonId: hackathon._id,
      teamId: participant.teamId,
      invitedBy: user._id,
      email: email.toLowerCase(),
      role,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        invitedAt: new Date(),
      },
      ...(existingUser && { invitedUser: existingUser._id }),
    });

    // Send invitation email
    try {
      const inviteLink = `${config.frontendUrl || "https://boundlessfi.xyz"}/hackathons/${hackathon.slug || hackathon._id}/team/accept?token=${token}`;
      const inviterName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;
      const hackathonName = hackathon.title || "Hackathon";
      const teamName = participant.teamName || "Team";

      await sendEmail({
        to: email,
        subject: `You've been invited to join ${teamName} for ${hackathonName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Team Invitation</h2>
            <p>Hello,</p>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> for the hackathon <strong>${hackathonName}</strong>.</p>
            ${!existingUser ? "<p>Create an account and accept the invitation to join the team!</p>" : "<p>Click the link below to accept the invitation:</p>"}
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #7f8c8d; word-break: break-all;">${inviteLink}</p>
            <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">This invitation will expire in 7 days.</p>
          </div>
        `,
        text: `${inviterName} has invited you to join ${teamName} for ${hackathonName}. Accept here: ${inviteLink}`,
      });
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      // Don't fail the request if email fails
    }

    sendCreated(
      res,
      {
        _id: invitation._id.toString(),
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        inviteLink: `${config.frontendUrl}/hackathons/${hackathon.slug || hackathon._id}/team/accept?token=${token}`,
      },
      "Team member invited successfully",
    );
  } catch (error) {
    console.error("Invite team member error:", error);
    sendInternalServerError(
      res,
      "Failed to invite team member",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Add team member (for registered users)
 * POST /organizations/{orgId}/hackathons/{hackathonId}/team/members
 * POST /hackathons/{hackathonSlugOrId}/team/members
 */
export const addTeamMember = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, orgId, hackathonId } = req.params;
    const { email } = req.body;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Find participant (must be registered and part of a team)
    const participant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: user._id,
      participationType: "team",
    });

    if (!participant || !participant.teamId) {
      sendBadRequest(
        res,
        "You must be registered as a team member to add others",
      );
      return;
    }

    // Check if user is team leader
    const isLeader =
      participant.teamMembers?.some(
        (m) =>
          m.userId.toString() === user._id.toString() && m.role === "leader",
      ) || participant.teamMembers?.length === 1;

    if (!isLeader) {
      sendForbidden(res, "Only team leaders can add members");
      return;
    }

    // Find user to add
    const userToAdd = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!userToAdd) {
      sendNotFound(
        res,
        "User not found. Use invite endpoint for non-registered users.",
      );
      return;
    }

    // Check if already a member
    const isAlreadyMember = participant.teamMembers?.some(
      (m) => m.userId.toString() === userToAdd._id.toString(),
    );

    if (isAlreadyMember) {
      sendConflict(res, "User is already a team member");
      return;
    }

    // Check if user is already registered for this hackathon (different team or individual)
    const existingParticipant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: userToAdd._id,
    });

    if (existingParticipant) {
      if (existingParticipant.participationType === "individual") {
        sendBadRequest(
          res,
          "User is registered as individual. They need to leave first before joining a team.",
        );
        return;
      }
      if (existingParticipant.teamId !== participant.teamId) {
        sendConflict(res, "User is already part of another team");
        return;
      }
    }

    // Check if hackathon is open for registration (only if user is not already registered)
    if (!existingParticipant) {
      const registrationStatus = isRegistrationOpen(hackathon);
      if (!registrationStatus.isOpen) {
        sendBadRequest(
          res,
          registrationStatus.errorMessage ||
            "Hackathon registration has closed",
        );
        return;
      }
    }

    // Check team size limits
    const currentMemberCount = participant.teamMembers?.length || 0;
    if (hackathon.teamMax && currentMemberCount >= hackathon.teamMax) {
      sendBadRequest(
        res,
        `Team has reached maximum size of ${hackathon.teamMax}`,
      );
      return;
    }

    // Add member to team
    participant.teamMembers = participant.teamMembers || [];
    participant.teamMembers.push({
      userId: userToAdd._id,
      name:
        `${userToAdd.profile?.firstName || ""} ${userToAdd.profile?.lastName || ""}`.trim() ||
        userToAdd.email,
      username: userToAdd.profile?.username || userToAdd.email.split("@")[0],
      role: "member",
      avatar: userToAdd.profile?.avatar,
    });

    await participant.save();

    // If user wasn't registered, create their participant record
    if (!existingParticipant) {
      await HackathonParticipant.create({
        userId: userToAdd._id,
        hackathonId: hackathon._id,
        organizationId: hackathon.organizationId,
        participationType: "team",
        teamId: participant.teamId,
        teamName: participant.teamName,
        teamMembers: participant.teamMembers,
        registeredAt: new Date(),
      });
    } else {
      // Update existing participant to join this team
      existingParticipant.participationType = "team";
      existingParticipant.teamId = participant.teamId;
      existingParticipant.teamName = participant.teamName;
      existingParticipant.teamMembers = participant.teamMembers;
      await existingParticipant.save();
    }

    // Update all team members' records to keep them in sync
    await HackathonParticipant.updateMany(
      {
        hackathonId: hackathon._id,
        teamId: participant.teamId,
      },
      {
        teamMembers: participant.teamMembers,
      },
    );

    sendSuccess(
      res,
      {
        message: "Team member added successfully",
      },
      "Team member added successfully",
    );
  } catch (error) {
    console.error("Add team member error:", error);
    sendInternalServerError(
      res,
      "Failed to add team member",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Remove team member
 * DELETE /organizations/{orgId}/hackathons/{hackathonId}/team/members/:memberId
 * DELETE /hackathons/{hackathonSlugOrId}/team/members/:memberId
 */
export const removeTeamMember = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, memberId, orgId, hackathonId } = req.params;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Find participant
    const participant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: user._id,
      participationType: "team",
    });

    if (!participant || !participant.teamId) {
      sendBadRequest(res, "You must be part of a team");
      return;
    }

    // Check if user is team leader or removing themselves
    const isLeader =
      participant.teamMembers?.some(
        (m) =>
          m.userId.toString() === user._id.toString() && m.role === "leader",
      ) || participant.teamMembers?.length === 1;

    const isRemovingSelf = memberId === user._id.toString();

    if (!isLeader && !isRemovingSelf) {
      sendForbidden(
        res,
        "Only team leaders can remove members, or you can remove yourself",
      );
      return;
    }

    // Check team size limits
    const currentMemberCount = participant.teamMembers?.length || 0;
    if (hackathon.teamMin && currentMemberCount <= hackathon.teamMin) {
      sendBadRequest(
        res,
        `Team must have at least ${hackathon.teamMin} members`,
      );
      return;
    }

    // Remove member from team
    participant.teamMembers = participant.teamMembers?.filter(
      (m) => m.userId.toString() !== memberId,
    );

    await participant.save();

    // Update all team members' records
    await HackathonParticipant.updateMany(
      {
        hackathonId: hackathon._id,
        teamId: participant.teamId,
      },
      {
        teamMembers: participant.teamMembers,
      },
    );

    // If member was removed, update their participant record
    const removedMember = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: memberId,
      teamId: participant.teamId,
    });

    if (removedMember) {
      // Convert to individual or remove registration
      if (isRemovingSelf) {
        // User left - remove their registration
        await HackathonParticipant.deleteOne({ _id: removedMember._id });
      } else {
        // Convert to individual
        removedMember.participationType = "individual";
        removedMember.teamId = undefined;
        removedMember.teamName = undefined;
        removedMember.teamMembers = undefined;
        await removedMember.save();
      }
    }

    sendSuccess(res, null, "Team member removed successfully");
  } catch (error) {
    console.error("Remove team member error:", error);
    sendInternalServerError(
      res,
      "Failed to remove team member",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Leave hackathon
 * DELETE /organizations/{orgId}/hackathons/{hackathonId}/register
 * DELETE /hackathons/{hackathonSlugOrId}/register
 */
export const leaveHackathon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, orgId, hackathonId } = req.params;

    const hackathonIdentifier = hackathonId || hackathonSlugOrId;
    const isOrgRoute = !!orgId;

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(
      hackathonIdentifier,
      isOrgRoute ? undefined : { includePublishedOnly: true },
    );

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Find participant
    const participant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: user._id,
    });

    if (!participant) {
      sendNotFound(res, "You are not registered for this hackathon");
      return;
    }

    // If part of a team, remove from team first
    if (participant.participationType === "team" && participant.teamId) {
      // Find all team members
      const teamMembers = await HackathonParticipant.find({
        hackathonId: hackathon._id,
        teamId: participant.teamId,
      });

      // Remove user from team members list
      for (const member of teamMembers) {
        if (member.teamMembers) {
          member.teamMembers = member.teamMembers.filter(
            (m) => m.userId.toString() !== user._id.toString(),
          );
          await member.save();
        }
      }
    }

    // Delete participant record
    await HackathonParticipant.deleteOne({ _id: participant._id });

    sendSuccess(res, null, "Successfully left hackathon");
  } catch (error) {
    console.error("Leave hackathon error:", error);
    sendInternalServerError(
      res,
      "Failed to leave hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Accept team invitation
 * POST /hackathons/{hackathonSlugOrId}/team/accept
 */
export const acceptTeamInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId } = req.params;
    const { token } = req.body;

    if (!token) {
      sendBadRequest(res, "Invitation token is required");
      return;
    }

    // Find invitation
    const invitation = await HackathonTeamInvitation.findOne({ token });

    if (!invitation) {
      sendNotFound(res, "Invalid invitation token");
      return;
    }

    if (!(invitation as any).isValid()) {
      sendBadRequest(res, "Invitation has expired or is no longer valid");
      return;
    }

    // Verify email matches
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      sendForbidden(
        res,
        "This invitation was sent to a different email address",
      );
      return;
    }

    // Resolve hackathon
    const hackathon = await resolveHackathonByIdOrSlug(hackathonSlugOrId, {
      includePublishedOnly: true,
    });

    if (
      !hackathon ||
      hackathon._id.toString() !== invitation.hackathonId.toString()
    ) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Find team participant
    const teamParticipant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      teamId: invitation.teamId,
    });

    if (!teamParticipant) {
      sendNotFound(res, "Team not found");
      return;
    }

    // Check if already registered
    const existingParticipant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: user._id,
    });

    if (existingParticipant) {
      if (existingParticipant.teamId === invitation.teamId) {
        sendConflict(res, "You are already a member of this team");
        return;
      }
      sendBadRequest(
        res,
        "You are already registered for this hackathon. Please leave your current registration first.",
      );
      return;
    }

    // Check if hackathon is open for registration based on policy
    const registrationStatus = isRegistrationOpen(hackathon);
    if (!registrationStatus.isOpen) {
      sendBadRequest(
        res,
        registrationStatus.errorMessage || "Hackathon registration has closed",
      );
      return;
    }

    // Check team size limits
    const currentMemberCount = teamParticipant.teamMembers?.length || 0;
    if (hackathon.teamMax && currentMemberCount >= hackathon.teamMax) {
      sendBadRequest(
        res,
        `Team has reached maximum size of ${hackathon.teamMax}`,
      );
      return;
    }

    // Add user to team
    const newMember = {
      userId: user._id,
      name:
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email,
      username: user.profile?.username || user.email.split("@")[0],
      role: invitation.role,
      avatar: user.profile?.avatar,
    };

    teamParticipant.teamMembers = teamParticipant.teamMembers || [];
    teamParticipant.teamMembers.push(newMember);

    await teamParticipant.save();

    // Create participant record for new member
    await HackathonParticipant.create({
      userId: user._id,
      hackathonId: hackathon._id,
      organizationId: hackathon.organizationId,
      participationType: "team",
      teamId: invitation.teamId,
      teamName: teamParticipant.teamName,
      teamMembers: teamParticipant.teamMembers,
      registeredAt: new Date(),
    });

    // Update all team members' records
    await HackathonParticipant.updateMany(
      {
        hackathonId: hackathon._id,
        teamId: invitation.teamId,
      },
      {
        teamMembers: teamParticipant.teamMembers,
      },
    );

    // Accept invitation
    await (invitation as any).accept(user._id);

    sendSuccess(
      res,
      {
        message: "Successfully joined team",
        teamName: teamParticipant.teamName,
      },
      "Successfully joined team",
    );
  } catch (error) {
    console.error("Accept team invitation error:", error);
    sendInternalServerError(
      res,
      "Failed to accept invitation",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
