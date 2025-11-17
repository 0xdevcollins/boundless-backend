import { Request, Response } from "express";
import mongoose from "mongoose";
import Hackathon from "../../models/hackathon.model.js";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendInternalServerError,
} from "../../utils/apiResponse.js";
import {
  AuthenticatedRequest,
  canManageHackathons,
} from "./hackathon.helpers.js";

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/participants/{participantId}/shortlist:
 *   post:
 *     summary: Shortlist a submission
 *     description: Shortlist a submission for judging or reverse shortlisting back to submitted
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const shortlistSubmission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId, participantId } = req.params;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can review submissions for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      sendBadRequest(res, "Invalid participant ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    });

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    const participant = await HackathonParticipant.findOne({
      _id: participantId,
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!participant) {
      sendNotFound(res, "Participant not found");
      return;
    }

    if (!participant.submission) {
      sendBadRequest(res, "Participant has no submission to review");
      return;
    }

    const currentStatus = participant.submission.status;
    const reviewerId = new mongoose.Types.ObjectId(user._id);
    const reviewDate = new Date();

    // Toggle: if already shortlisted, reverse to submitted; otherwise shortlist
    if (currentStatus === "shortlisted") {
      participant.submission.status = "submitted";
      participant.submission.reviewedBy = undefined;
      participant.submission.reviewedAt = undefined;
    } else {
      participant.submission.status = "shortlisted";
      participant.submission.reviewedBy = reviewerId;
      participant.submission.reviewedAt = reviewDate;
      // Clear disqualification reason if it exists
      participant.submission.disqualificationReason = undefined;
    }

    await participant.save();

    // Populate user data for response
    await participant.populate({
      path: "userId",
      select: "email profile",
    });

    if (participant.submission.reviewedBy) {
      await participant.populate({
        path: "submission.reviewedBy",
        select: "email profile",
      });
    }

    // Transform to match frontend interface
    const transformedParticipant = {
      _id: (participant._id as mongoose.Types.ObjectId).toString(),
      userId: participant.userId._id.toString(),
      hackathonId: participant.hackathonId.toString(),
      organizationId: participant.organizationId.toString(),
      user: {
        _id: (participant.userId as any)._id.toString(),
        profile: {
          firstName: (participant.userId as any).profile?.firstName || "",
          lastName: (participant.userId as any).profile?.lastName || "",
          username: (participant.userId as any).profile?.username || "",
          avatar: (participant.userId as any).profile?.avatar || "",
        },
        email: (participant.userId as any).email || "",
      },
      socialLinks: participant.socialLinks || undefined,
      participationType: participant.participationType,
      teamId: participant.teamId || undefined,
      teamName: participant.teamName || undefined,
      teamMembers:
        participant.teamMembers?.map((member: any) => ({
          userId: member.userId.toString(),
          name: member.name,
          username: member.username,
          role: member.role,
          avatar: member.avatar || undefined,
        })) || undefined,
      submission: {
        _id: (participant._id as mongoose.Types.ObjectId).toString(),
        projectName: participant.submission.projectName,
        category: participant.submission.category,
        description: participant.submission.description,
        logo: participant.submission.logo || undefined,
        videoUrl: participant.submission.videoUrl || undefined,
        introduction: participant.submission.introduction || undefined,
        links: participant.submission.links || undefined,
        votes: [], // Will be populated if needed
        comments: [], // Will be populated if needed
        submissionDate: participant.submission.submissionDate.toISOString(),
        status: participant.submission.status,
        disqualificationReason:
          participant.submission.disqualificationReason || undefined,
        reviewedBy: participant.submission.reviewedBy
          ? {
              _id: (participant.submission.reviewedBy as any)._id.toString(),
              profile: {
                firstName:
                  (participant.submission.reviewedBy as any).profile
                    ?.firstName || "",
                lastName:
                  (participant.submission.reviewedBy as any).profile
                    ?.lastName || "",
                username:
                  (participant.submission.reviewedBy as any).profile
                    ?.username || "",
                avatar:
                  (participant.submission.reviewedBy as any).profile?.avatar ||
                  "",
              },
              email: (participant.submission.reviewedBy as any).email || "",
            }
          : undefined,
        reviewedAt:
          participant.submission.reviewedAt?.toISOString() || undefined,
      },
      registeredAt: participant.registeredAt.toISOString(),
      submittedAt: participant.submittedAt?.toISOString() || undefined,
    };

    sendSuccess(
      res,
      transformedParticipant,
      currentStatus === "shortlisted"
        ? "Submission un-shortlisted successfully"
        : "Submission shortlisted successfully",
    );
  } catch (error) {
    console.error("Shortlist submission error:", error);
    sendInternalServerError(
      res,
      "Failed to shortlist submission",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/participants/{participantId}/disqualify:
 *   post:
 *     summary: Disqualify a submission
 *     description: Disqualify a submission with optional comment or reverse disqualification back to submitted
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const disqualifySubmission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId, participantId } = req.params;
    const { comment } = req.body;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can review submissions for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      sendBadRequest(res, "Invalid participant ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    });

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    const participant = await HackathonParticipant.findOne({
      _id: participantId,
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!participant) {
      sendNotFound(res, "Participant not found");
      return;
    }

    if (!participant.submission) {
      sendBadRequest(res, "Participant has no submission to review");
      return;
    }

    const currentStatus = participant.submission.status;
    const reviewerId = new mongoose.Types.ObjectId(user._id);
    const reviewDate = new Date();

    // Toggle: if already disqualified, reverse to submitted; otherwise disqualify
    if (currentStatus === "disqualified") {
      participant.submission.status = "submitted";
      participant.submission.disqualificationReason = undefined;
      participant.submission.reviewedBy = undefined;
      participant.submission.reviewedAt = undefined;
    } else {
      participant.submission.status = "disqualified";
      participant.submission.disqualificationReason = comment || undefined;
      participant.submission.reviewedBy = reviewerId;
      participant.submission.reviewedAt = reviewDate;
    }

    await participant.save();

    // Populate user data for response
    await participant.populate({
      path: "userId",
      select: "email profile",
    });

    if (participant.submission.reviewedBy) {
      await participant.populate({
        path: "submission.reviewedBy",
        select: "email profile",
      });
    }

    // Transform to match frontend interface
    const transformedParticipant = {
      _id: (participant._id as mongoose.Types.ObjectId).toString(),
      userId: participant.userId._id.toString(),
      hackathonId: participant.hackathonId.toString(),
      organizationId: participant.organizationId.toString(),
      user: {
        _id: (participant.userId as any)._id.toString(),
        profile: {
          firstName: (participant.userId as any).profile?.firstName || "",
          lastName: (participant.userId as any).profile?.lastName || "",
          username: (participant.userId as any).profile?.username || "",
          avatar: (participant.userId as any).profile?.avatar || "",
        },
        email: (participant.userId as any).email || "",
      },
      socialLinks: participant.socialLinks || undefined,
      participationType: participant.participationType,
      teamId: participant.teamId || undefined,
      teamName: participant.teamName || undefined,
      teamMembers:
        participant.teamMembers?.map((member: any) => ({
          userId: member.userId.toString(),
          name: member.name,
          username: member.username,
          role: member.role,
          avatar: member.avatar || undefined,
        })) || undefined,
      submission: {
        _id: (participant._id as mongoose.Types.ObjectId).toString(),
        projectName: participant.submission.projectName,
        category: participant.submission.category,
        description: participant.submission.description,
        logo: participant.submission.logo || undefined,
        videoUrl: participant.submission.videoUrl || undefined,
        introduction: participant.submission.introduction || undefined,
        links: participant.submission.links || undefined,
        votes: [], // Will be populated if needed
        comments: [], // Will be populated if needed
        submissionDate: participant.submission.submissionDate.toISOString(),
        status: participant.submission.status,
        disqualificationReason:
          participant.submission.disqualificationReason || undefined,
        reviewedBy: participant.submission.reviewedBy
          ? {
              _id: (participant.submission.reviewedBy as any)._id.toString(),
              profile: {
                firstName:
                  (participant.submission.reviewedBy as any).profile
                    ?.firstName || "",
                lastName:
                  (participant.submission.reviewedBy as any).profile
                    ?.lastName || "",
                username:
                  (participant.submission.reviewedBy as any).profile
                    ?.username || "",
                avatar:
                  (participant.submission.reviewedBy as any).profile?.avatar ||
                  "",
              },
              email: (participant.submission.reviewedBy as any).email || "",
            }
          : undefined,
        reviewedAt:
          participant.submission.reviewedAt?.toISOString() || undefined,
      },
      registeredAt: participant.registeredAt.toISOString(),
      submittedAt: participant.submittedAt?.toISOString() || undefined,
    };

    sendSuccess(
      res,
      transformedParticipant,
      currentStatus === "disqualified"
        ? "Submission un-disqualified successfully"
        : "Submission disqualified successfully",
    );
  } catch (error) {
    console.error("Disqualify submission error:", error);
    sendInternalServerError(
      res,
      "Failed to disqualify submission",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
