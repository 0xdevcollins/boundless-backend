import { Request, Response } from "express";
import { TeamInvitationService } from "../../features/team-invitations/team-invitation.service.js";
import {
  sendSuccess,
  sendBadRequest,
  sendInternalServerError,
  sendUnauthorized,
  sendNotFound,
} from "../../utils/apiResponse.js";
import mongoose from "mongoose";

/**
 * @desc    Get team invitation by token
 * @route   GET /api/team-invitations/:token
 * @access  Public
 */
export const getTeamInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      sendBadRequest(res, "Invitation token is required");
      return;
    }

    const invitation = await TeamInvitationService.getInvitationByToken(token);

    if (!invitation) {
      sendNotFound(res, "Invitation not found");
      return;
    }

    sendSuccess(
      res,
      {
        invitation: {
          _id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          isExpired: (invitation as any).isExpired,
          isValid: (invitation as any).isValid(),
          project: invitation.projectId,
          invitedBy: invitation.invitedBy,
          invitedAt: invitation.metadata.invitedAt,
        },
      },
      "Team invitation retrieved successfully",
    );
  } catch (error) {
    console.error("Error getting team invitation:", error);
    sendInternalServerError(res, "Failed to get team invitation");
  }
};

/**
 * @desc    Accept team invitation
 * @route   POST /api/team-invitations/:token/accept
 * @access  Private
 */
export const acceptTeamInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token } = req.params;
    const { role } = req.body; // Optional role specification
    const userId = req.user?._id;

    if (!token) {
      sendBadRequest(res, "Invitation token is required");
      return;
    }

    if (!userId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    const result = await TeamInvitationService.acceptInvitation(
      token,
      userId.toString(),
      role, // Pass the role if provided
    );

    sendSuccess(
      res,
      {
        invitation: result.invitation,
        project: result.project,
        message: "Team invitation accepted successfully",
      },
      "You have successfully joined the project team!",
    );
  } catch (error) {
    console.error("Error accepting team invitation:", error);
    if (error instanceof Error) {
      sendBadRequest(res, error.message);
    } else {
      sendInternalServerError(res, "Failed to accept team invitation");
    }
  }
};

/**
 * @desc    Decline team invitation
 * @route   POST /api/team-invitations/:token/decline
 * @access  Public
 */
export const declineTeamInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      sendBadRequest(res, "Invitation token is required");
      return;
    }

    const invitation = await TeamInvitationService.declineInvitation(token);

    sendSuccess(
      res,
      {
        invitation,
        message: "Team invitation declined",
      },
      "Team invitation has been declined",
    );
  } catch (error) {
    console.error("Error declining team invitation:", error);
    if (error instanceof Error) {
      sendBadRequest(res, error.message);
    } else {
      sendInternalServerError(res, "Failed to decline team invitation");
    }
  }
};

/**
 * @desc    Get project team invitations
 * @route   GET /api/projects/:projectId/team-invitations
 * @access  Private (Project Owner)
 */
export const getProjectTeamInvitations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      sendBadRequest(res, "Invalid project ID");
      return;
    }

    if (!userId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // TODO: Add authorization check to ensure user is project owner

    const invitations =
      await TeamInvitationService.getProjectInvitations(projectId);

    sendSuccess(
      res,
      {
        invitations,
        total: invitations.length,
      },
      "Project team invitations retrieved successfully",
    );
  } catch (error) {
    console.error("Error getting project team invitations:", error);
    sendInternalServerError(res, "Failed to get project team invitations");
  }
};

/**
 * @desc    Get user team invitations
 * @route   GET /api/team-invitations
 * @access  Private
 */
export const getUserTeamInvitations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const email = req.user?.email;

    if (!userId || !email) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    const invitations = await TeamInvitationService.getUserInvitations(email);

    sendSuccess(
      res,
      {
        invitations,
        total: invitations.length,
      },
      "Your team invitations retrieved successfully",
    );
  } catch (error) {
    console.error("Error getting user team invitations:", error);
    sendInternalServerError(res, "Failed to get user team invitations");
  }
};

/**
 * @desc    Cancel team invitation
 * @route   DELETE /api/team-invitations/:invitationId
 * @access  Private (Project Owner)
 */
export const cancelTeamInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { invitationId } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(invitationId)) {
      sendBadRequest(res, "Invalid invitation ID");
      return;
    }

    if (!userId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // TODO: Add authorization check to ensure user is project owner

    const invitation = await TeamInvitationService.cancelInvitation(
      invitationId,
      userId.toString(),
    );

    sendSuccess(
      res,
      {
        invitation,
        message: "Team invitation cancelled",
      },
      "Team invitation has been cancelled",
    );
  } catch (error) {
    console.error("Error cancelling team invitation:", error);
    if (error instanceof Error) {
      sendBadRequest(res, error.message);
    } else {
      sendInternalServerError(res, "Failed to cancel team invitation");
    }
  }
};
