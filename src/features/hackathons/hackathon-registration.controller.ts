import { Request, Response } from "express";
import mongoose from "mongoose";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import User from "../../models/user.model.js";
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

/**
 * Register for hackathon
 * POST /organizations/{orgId}/hackathons/{hackathonId}/register
 * POST /hackathons/{hackathonSlugOrId}/register
 */
export const registerForHackathon = async (
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
    const { participationType, teamName, teamMembers } = req.body;

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

    // Check if hackathon is open for registration based on policy
    const registrationStatus = isRegistrationOpen(hackathon);
    if (!registrationStatus.isOpen) {
      sendBadRequest(
        res,
        registrationStatus.errorMessage || "Hackathon registration has closed",
      );
      return;
    }

    // Check if already registered
    const existingParticipant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: user._id,
    });

    if (existingParticipant) {
      sendConflict(res, "You are already registered for this hackathon");
      return;
    }

    // Handle team registration
    let teamId: string | undefined;
    let teamMembersData: any[] = [];

    if (participationType === "team") {
      if (!teamName) {
        sendBadRequest(res, "Team name is required for team participation");
        return;
      }

      // Generate team ID
      teamId = `${(hackathon._id as mongoose.Types.ObjectId).toString()}-${Date.now()}`;

      // Add current user as team leader
      teamMembersData = [
        {
          userId: user._id,
          name:
            `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
            user.email,
          username: user.profile?.username || user.email.split("@")[0],
          role: "leader",
          avatar: user.profile?.avatar,
        },
      ];

      // If team members are provided, add them (but don't require all to be registered)
      if (teamMembers && teamMembers.length > 0) {
        // Find existing users by email
        const memberUsers = await User.find({
          email: { $in: teamMembers },
        }).select("email profile");

        // Add existing users to team
        memberUsers.forEach((member) => {
          // Don't add if already added as leader
          if (member._id.toString() !== user._id.toString()) {
            teamMembersData.push({
              userId: member._id,
              name:
                `${member.profile?.firstName || ""} ${member.profile?.lastName || ""}`.trim() ||
                member.email,
              username: member.profile?.username || member.email.split("@")[0],
              role: "member",
              avatar: member.profile?.avatar,
            });
          }
        });

        // For non-registered users, invitations will be sent (handled separately)
        // We don't fail if some users aren't registered
      }

      // Check team size limits (only count registered members)
      if (hackathon.teamMin && teamMembersData.length < hackathon.teamMin) {
        sendBadRequest(
          res,
          `Team must have at least ${hackathon.teamMin} registered members. You can invite more members after registration.`,
        );
        return;
      }

      if (hackathon.teamMax && teamMembersData.length > hackathon.teamMax) {
        sendBadRequest(
          res,
          `Team cannot have more than ${hackathon.teamMax} members`,
        );
        return;
      }
    }

    // Create participant
    const participant = await HackathonParticipant.create({
      userId: user._id,
      hackathonId: hackathon._id,
      organizationId: hackathon.organizationId,
      participationType,
      teamId,
      teamName: participationType === "team" ? teamName : undefined,
      teamMembers: teamMembersData,
      registeredAt: new Date(),
    });

    // Populate user data
    await participant.populate({
      path: "userId",
      select: "email profile",
    });

    // Format response
    const userData = participant.userId as any;
    const profile = userData?.profile || {};

    const responseData = {
      _id: (participant._id as mongoose.Types.ObjectId).toString(),
      userId: participant.userId._id.toString(),
      hackathonId: participant.hackathonId.toString(),
      organizationId: participant.organizationId.toString(),
      user: {
        _id: userData._id.toString(),
        profile: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          username: profile.username,
          avatar: profile.avatar,
        },
        email: userData.email,
      },
      participationType: participant.participationType,
      teamId: participant.teamId || null,
      teamName: participant.teamName || null,
      teamMembers: participant.teamMembers || null,
      submission: null,
      registeredAt: participant.registeredAt.toISOString(),
    };

    sendCreated(res, responseData, "Successfully registered for hackathon");
  } catch (error) {
    console.error("Register for hackathon error:", error);
    sendInternalServerError(
      res,
      "Failed to register for hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Check registration status
 * GET /organizations/{orgId}/hackathons/{hackathonId}/register/status
 * GET /hackathons/{hackathonSlugOrId}/register/status
 */
export const checkRegistrationStatus = async (
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
    })
      .populate({
        path: "userId",
        select: "email profile",
      })
      .lean();

    if (!participant) {
      sendSuccess(res, null, "Registration status retrieved successfully");
      return;
    }

    const userData = participant.userId as any;
    const profile = userData?.profile || {};

    // Format response
    const responseData = {
      _id: participant._id.toString(),
      userId: participant.userId._id.toString(),
      hackathonId: participant.hackathonId.toString(),
      organizationId: participant.organizationId.toString(),
      user: {
        _id: userData._id.toString(),
        profile: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          username: profile.username,
          avatar: profile.avatar,
        },
        email: userData.email,
      },
      participationType: participant.participationType,
      teamId: participant.teamId || null,
      teamName: participant.teamName || null,
      teamMembers: participant.teamMembers || null,
      submission: participant.submission
        ? {
            _id: participant._id.toString(),
            projectName: participant.submission.projectName,
            status: participant.submission.status,
          }
        : null,
      registeredAt: participant.registeredAt.toISOString(),
      submittedAt: participant.submittedAt
        ? participant.submittedAt.toISOString()
        : undefined,
    };

    sendSuccess(
      res,
      responseData,
      "Registration status retrieved successfully",
    );
  } catch (error) {
    console.error("Check registration status error:", error);
    sendInternalServerError(
      res,
      "Failed to check registration status",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
