import { Request, Response } from "express";
import mongoose from "mongoose";
import Hackathon from "../../models/hackathon.model.js";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import HackathonSubmissionComment from "../../models/hackathon-submission-comment.model.js";
import HackathonSubmissionVote from "../../models/hackathon-submission-vote.model.js";
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendInternalServerError,
  sendPaginatedResponse,
} from "../../utils/apiResponse.js";
import {
  AuthenticatedRequest,
  canManageHackathons,
} from "./hackathon.helpers.js";

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/participants:
 *   get:
 *     summary: Get hackathon participants
 *     description: Retrieve paginated list of participants for a hackathon with optional filters
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [submitted, not_submitted]
 *         description: Filter by submission status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [individual, team]
 *         description: Filter by participation type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, username, or project name
 */
export const getParticipants = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;
    const { page = "1", limit = "10", status, type, search } = req.query;

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
        "Only owners and admins can view hackathon participants for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
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

    // Build query
    const query: any = {
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
    };

    // Filter by participation type
    if (type === "individual" || type === "team") {
      query.participationType = type;
    }

    // Filter by submission status
    if (status === "submitted") {
      query.submission = { $exists: true, $ne: null };
    } else if (status === "not_submitted") {
      query.$or = [{ submission: { $exists: false } }, { submission: null }];
    }

    // Search filter
    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i");
      const searchConditions: any[] = [
        { teamName: searchRegex },
        { "submission.projectName": searchRegex },
      ];

      // If we already have $or for status, merge it
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const totalItems = await HackathonParticipant.countDocuments(query);

    // Get participants with user population
    const participants = await HackathonParticipant.find(query)
      .populate({
        path: "userId",
        select: "email profile",
      })
      .populate({
        path: "submission.reviewedBy",
        select: "email profile",
      })
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get all submission IDs to fetch comments and votes
    const submissionIds = participants
      .filter((p: any) => p.submission)
      .map((p: any) => p._id);

    // Fetch comments and votes for all submissions
    const [commentsData, votesData] = await Promise.all([
      HackathonSubmissionComment.find({
        submissionId: { $in: submissionIds },
        status: "active",
      })
        .populate({
          path: "userId",
          select: "profile email",
        })
        .sort({ createdAt: -1 })
        .lean(),
      HackathonSubmissionVote.find({
        submissionId: { $in: submissionIds },
      })
        .populate({
          path: "userId",
          select: "profile email",
        })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Group comments and votes by submissionId
    const commentsBySubmission = new Map<string, any[]>();
    const votesBySubmission = new Map<string, any[]>();

    commentsData.forEach((comment: any) => {
      const subId = comment.submissionId.toString();
      if (!commentsBySubmission.has(subId)) {
        commentsBySubmission.set(subId, []);
      }
      const user = comment.userId;
      commentsBySubmission.get(subId)!.push({
        _id: comment._id.toString(),
        userId: user._id.toString(),
        user: {
          _id: user._id.toString(),
          profile: {
            firstName: user.profile?.firstName || "",
            lastName: user.profile?.lastName || "",
            username: user.profile?.username || "",
            avatar: user.profile?.avatar || "",
          },
          email: user.email || "",
        },
        content: comment.content,
        parentCommentId: comment.parentCommentId?.toString() || undefined,
        reactionCounts: comment.reactionCounts || {
          LIKE: 0,
          DISLIKE: 0,
          HELPFUL: 0,
        },
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      });
    });

    votesData.forEach((vote: any) => {
      const subId = vote.submissionId.toString();
      if (!votesBySubmission.has(subId)) {
        votesBySubmission.set(subId, []);
      }
      const user = vote.userId;
      votesBySubmission.get(subId)!.push({
        _id: vote._id.toString(),
        userId: user._id.toString(),
        user: {
          _id: user._id.toString(),
          profile: {
            firstName: user.profile?.firstName || "",
            lastName: user.profile?.lastName || "",
            username: user.profile?.username || "",
            avatar: user.profile?.avatar || "",
          },
          email: user.email || "",
        },
        value: vote.value,
        createdAt: vote.createdAt.toISOString(),
      });
    });

    // Transform participants to match frontend interface
    const transformedParticipants = participants.map((participant: any) => {
      const user = participant.userId;
      const submissionId = participant._id.toString();
      const comments = commentsBySubmission.get(submissionId) || [];
      const votes = votesBySubmission.get(submissionId) || [];

      return {
        _id: participant._id.toString(),
        userId: participant.userId._id.toString(),
        hackathonId: participant.hackathonId.toString(),
        organizationId: participant.organizationId.toString(),
        user: {
          _id: user._id.toString(),
          profile: {
            firstName: user.profile?.firstName || "",
            lastName: user.profile?.lastName || "",
            username: user.profile?.username || "",
            avatar: user.profile?.avatar || "",
          },
          email: user.email || "",
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
        submission: participant.submission
          ? {
              _id: participant._id.toString(),
              projectName: participant.submission.projectName,
              category: participant.submission.category,
              description: participant.submission.description,
              logo: participant.submission.logo || undefined,
              videoUrl: participant.submission.videoUrl || undefined,
              introduction: participant.submission.introduction || undefined,
              links: participant.submission.links || undefined,
              votes: votes, // Array of vote objects with content
              comments: comments, // Array of comment objects with content
              submissionDate:
                participant.submission.submissionDate.toISOString(),
              status: participant.submission.status,
              disqualificationReason:
                participant.submission.disqualificationReason || undefined,
              reviewedBy: participant.submission.reviewedBy
                ? {
                    _id: (
                      participant.submission.reviewedBy as any
                    )._id.toString(),
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
                        (participant.submission.reviewedBy as any).profile
                          ?.avatar || "",
                    },
                    email:
                      (participant.submission.reviewedBy as any).email || "",
                  }
                : undefined,
              reviewedAt:
                participant.submission.reviewedAt?.toISOString() || undefined,
            }
          : undefined,
        registeredAt: participant.registeredAt.toISOString(),
        submittedAt: participant.submittedAt?.toISOString() || undefined,
      };
    });

    const totalPages = Math.ceil(totalItems / limitNum);

    // Ensure transformedParticipants is always an array
    const participantsArray = Array.isArray(transformedParticipants)
      ? transformedParticipants
      : [];

    sendPaginatedResponse(
      res,
      participantsArray,
      {
        currentPage: pageNum,
        totalPages,
        totalItems,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      "Participants retrieved successfully",
    );
  } catch (error) {
    console.error("Get participants error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve participants",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
