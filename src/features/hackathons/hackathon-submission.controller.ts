import { Request, Response } from "express";
import mongoose from "mongoose";
// Hackathon is used in error message strings
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import Hackathon from "../../models/hackathon.model.js";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import HackathonSubmissionVote from "../../models/hackathon-submission-vote.model.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendConflict,
  sendInternalServerError,
  sendPaginatedResponse,
} from "../../utils/apiResponse.js";
import {
  AuthenticatedRequest,
  resolveHackathonByIdOrSlug,
} from "./hackathon.helpers.js";

/**
 * Create submission
 * POST /organizations/{orgId}/hackathons/{hackathonId}/submissions
 * POST /hackathons/{hackathonSlugOrId}/submissions
 */
export const createSubmission = async (
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

    // Check if user is registered
    const participant = await HackathonParticipant.findOne({
      hackathonId: hackathon._id,
      userId: user._id,
    });

    if (!participant) {
      sendBadRequest(
        res,
        "You must be registered for this hackathon to submit",
      );
      return;
    }

    // Check if already submitted
    if (participant.submission) {
      sendConflict(
        res,
        "You have already submitted a project for this hackathon",
      );
      return;
    }

    // Check submission deadline
    if (
      hackathon.submissionDeadline &&
      new Date() > hackathon.submissionDeadline
    ) {
      sendBadRequest(res, "Submission deadline has passed");
      return;
    }

    const {
      projectName,
      category,
      description,
      logo,
      videoUrl,
      introduction,
      links,
    } = req.body;

    // Create submission
    participant.submission = {
      projectName,
      category,
      description,
      logo,
      videoUrl,
      introduction,
      links: links || [],
      votes: 0,
      comments: 0,
      submissionDate: new Date(),
      status: "submitted",
    };
    participant.submittedAt = new Date();

    await participant.save();

    // Format response
    const submissionData = {
      _id: String(participant._id),
      projectName: participant.submission.projectName,
      category: participant.submission.category,
      description: participant.submission.description,
      logo: participant.submission.logo,
      videoUrl: participant.submission.videoUrl,
      introduction: participant.submission.introduction,
      links: participant.submission.links,
      votes: participant.submission.votes,
      comments: participant.submission.comments,
      submissionDate: participant.submission.submissionDate.toISOString(),
      status: participant.submission.status,
    };

    sendCreated(res, submissionData, "Submission created successfully");
  } catch (error) {
    console.error("Create submission error:", error);
    sendInternalServerError(
      res,
      "Failed to create submission",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Update submission
 * PUT /organizations/{orgId}/hackathons/{hackathonId}/submissions/{submissionId}
 * PUT /hackathons/{hackathonSlugOrId}/submissions/{submissionId}
 */
export const updateSubmission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, submissionId, orgId, hackathonId } = req.params;
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

    // Find participant with submission
    const participant = await HackathonParticipant.findOne({
      _id: submissionId,
      hackathonId: hackathon._id,
      userId: user._id,
    });

    if (!participant || !participant.submission) {
      sendNotFound(res, "Submission not found");
      return;
    }

    // Check submission deadline
    if (
      hackathon.submissionDeadline &&
      new Date() > hackathon.submissionDeadline
    ) {
      sendBadRequest(res, "Submission deadline has passed");
      return;
    }

    const { category, description, logo, videoUrl, introduction, links } =
      req.body;

    // Update submission (projectName cannot be changed)
    if (category) participant.submission.category = category;
    if (description) participant.submission.description = description;
    if (logo !== undefined) participant.submission.logo = logo;
    if (videoUrl !== undefined) participant.submission.videoUrl = videoUrl;
    if (introduction !== undefined)
      participant.submission.introduction = introduction;
    if (links !== undefined) participant.submission.links = links;

    await participant.save();

    // Format response
    const submissionData = {
      _id: String(participant._id),
      projectName: participant.submission.projectName,
      category: participant.submission.category,
      description: participant.submission.description,
      logo: participant.submission.logo,
      videoUrl: participant.submission.videoUrl,
      introduction: participant.submission.introduction,
      links: participant.submission.links,
      votes: participant.submission.votes,
      comments: participant.submission.comments,
      submissionDate: participant.submission.submissionDate.toISOString(),
      status: participant.submission.status,
    };

    sendSuccess(res, submissionData, "Submission updated successfully");
  } catch (error) {
    console.error("Update submission error:", error);
    sendInternalServerError(
      res,
      "Failed to update submission",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Get my submission
 * GET /organizations/{orgId}/hackathons/{hackathonId}/submissions/me
 * GET /hackathons/{hackathonSlugOrId}/submissions/me
 */
export const getMySubmission = async (
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

    if (!participant || !participant.submission) {
      sendSuccess(res, null, "Submission retrieved successfully");
      return;
    }

    // Format response
    const submissionData = {
      _id: String(participant._id),
      projectName: participant.submission.projectName,
      category: participant.submission.category,
      description: participant.submission.description,
      logo: participant.submission.logo,
      videoUrl: participant.submission.videoUrl,
      introduction: participant.submission.introduction,
      links: participant.submission.links,
      votes: participant.submission.votes,
      comments: participant.submission.comments,
      submissionDate: participant.submission.submissionDate.toISOString(),
      status: participant.submission.status,
    };

    sendSuccess(res, submissionData, "Submission retrieved successfully");
  } catch (error) {
    console.error("Get my submission error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve submission",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Get submission details
 * GET /organizations/{orgId}/hackathons/{hackathonId}/submissions/{submissionId}
 * GET /hackathons/{hackathonSlugOrId}/submissions/{submissionId}
 */
export const getSubmissionDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { hackathonSlugOrId, submissionId, orgId, hackathonId } = req.params;
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

    // Find participant with submission
    const participant = await HackathonParticipant.findOne({
      _id: submissionId,
      hackathonId: hackathon._id,
    })
      .populate({
        path: "userId",
        select: "email profile",
      })
      .populate({
        path: "submission.reviewedBy",
        select: "email profile",
      })
      .lean();

    if (!participant || !participant.submission) {
      sendNotFound(res, "Submission not found");
      return;
    }

    const user = participant.userId as any;
    const profile = user?.profile || {};

    // Format response
    const submissionData = {
      _id: String(participant._id),
      projectName: participant.submission.projectName,
      category: participant.submission.category,
      description: participant.submission.description,
      logo: participant.submission.logo,
      videoUrl: participant.submission.videoUrl,
      introduction: participant.submission.introduction,
      links: participant.submission.links,
      votes: participant.submission.votes,
      comments: participant.submission.comments,
      submissionDate: participant.submission.submissionDate.toISOString(),
      status: participant.submission.status,
      disqualificationReason: participant.submission.disqualificationReason,
      reviewedBy: participant.submission.reviewedBy
        ? {
            _id: (participant.submission.reviewedBy as any)._id.toString(),
            profile: {
              firstName: (participant.submission.reviewedBy as any).profile
                ?.firstName,
              lastName: (participant.submission.reviewedBy as any).profile
                ?.lastName,
              username: (participant.submission.reviewedBy as any).profile
                ?.username,
              avatar: (participant.submission.reviewedBy as any).profile
                ?.avatar,
            },
            email: (participant.submission.reviewedBy as any).email || "",
          }
        : null,
      reviewedAt: participant.submission.reviewedAt
        ? participant.submission.reviewedAt.toISOString()
        : null,
      submitterName:
        participant.teamName ||
        `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
        user?.name ||
        "",
      submitterAvatar:
        participant.teamMembers?.[0]?.avatar ||
        profile.avatar ||
        user?.avatar ||
        undefined,
    };

    sendSuccess(res, submissionData, "Submission retrieved successfully");
  } catch (error) {
    console.error("Get submission details error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve submission",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Get all submissions
 * GET /organizations/{orgId}/hackathons/{hackathonId}/submissions
 * GET /hackathons/{hackathonSlugOrId}/submissions
 */
export const getAllSubmissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { hackathonSlugOrId, orgId, hackathonId } = req.params;
    const {
      page = "1",
      limit = "20",
      status,
      category,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

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

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: any = {
      hackathonId: hackathon._id,
      submission: { $exists: true },
    };

    // Filter by status
    if (status) {
      filter["submission.status"] = status;
    }

    // Filter by category
    if (category) {
      filter["submission.category"] = category;
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      filter.$or = [
        { "submission.projectName": searchRegex },
        { "submission.description": searchRegex },
      ];
    }

    // Build sort options
    let sortOptions: any = {};
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    switch (sortBy) {
      case "createdAt":
        sortOptions = { "submission.submissionDate": sortDirection };
        break;
      case "votes":
        sortOptions = { "submission.votes": sortDirection };
        break;
      case "comments":
        sortOptions = { "submission.comments": sortDirection };
        break;
      default:
        sortOptions = { "submission.submissionDate": sortDirection };
    }

    // Execute query
    const [participants, totalCount] = await Promise.all([
      HackathonParticipant.find(filter)
        .populate({
          path: "userId",
          select: "email profile",
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      HackathonParticipant.countDocuments(filter),
    ]);

    // Transform submissions
    const submissions = participants.map((participant: any) => {
      const user = participant.userId as any;
      const profile = user?.profile || {};

      return {
        _id: participant._id.toString(),
        projectName: participant.submission.projectName,
        description: participant.submission.description,
        category: participant.submission.category,
        logo: participant.submission.logo,
        votes: participant.submission.votes,
        comments: participant.submission.comments,
        submissionDate: participant.submission.submissionDate.toISOString(),
        status: participant.submission.status,
        submitterName:
          participant.teamName ||
          `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
          user?.name ||
          "",
        submitterAvatar:
          participant.teamMembers?.[0]?.avatar ||
          profile.avatar ||
          user?.avatar ||
          undefined,
      };
    });

    const totalPages = Math.ceil(totalCount / limitNum);

    sendPaginatedResponse(
      res,
      submissions,
      {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      "Submissions retrieved successfully",
    );
  } catch (error) {
    console.error("Get all submissions error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve submissions",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Vote on submission
 * POST /organizations/{orgId}/hackathons/{hackathonId}/submissions/{submissionId}/vote
 * POST /hackathons/{hackathonSlugOrId}/submissions/{submissionId}/vote
 */
export const voteOnSubmission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, submissionId, orgId, hackathonId } = req.params;
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

    // Find participant with submission
    const participant = await HackathonParticipant.findOne({
      _id: submissionId,
      hackathonId: hackathon._id,
      submission: { $exists: true },
    });

    if (!participant || !participant.submission) {
      sendNotFound(res, "Submission not found");
      return;
    }

    // Check if user already voted
    const existingVote = await HackathonSubmissionVote.findOne({
      submissionId: participant._id as mongoose.Types.ObjectId,
      userId: user._id,
    });

    if (existingVote) {
      sendConflict(res, "You have already voted on this submission");
      return;
    }

    // Create vote
    await HackathonSubmissionVote.create({
      submissionId: participant._id as mongoose.Types.ObjectId,
      userId: user._id,
      value: 1, // upvote
    });

    // Update vote count
    participant.submission.votes = (participant.submission.votes || 0) + 1;
    await participant.save();

    sendSuccess(
      res,
      {
        _id: String(participant._id),
        votes: participant.submission.votes,
        hasUserVoted: true,
      },
      "Vote added successfully",
    );
  } catch (error) {
    console.error("Vote on submission error:", error);
    sendInternalServerError(
      res,
      "Failed to vote on submission",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Remove vote
 * DELETE /organizations/{orgId}/hackathons/{hackathonId}/submissions/{submissionId}/vote
 * DELETE /hackathons/{hackathonSlugOrId}/submissions/{submissionId}/vote
 */
export const removeVote = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, submissionId, orgId, hackathonId } = req.params;
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

    // Find participant with submission
    const participant = await HackathonParticipant.findOne({
      _id: submissionId,
      hackathonId: hackathon._id,
      submission: { $exists: true },
    });

    if (!participant || !participant.submission) {
      sendNotFound(res, "Submission not found");
      return;
    }

    // Find and delete vote
    const vote = await HackathonSubmissionVote.findOneAndDelete({
      submissionId: participant._id as mongoose.Types.ObjectId,
      userId: user._id,
    });

    if (!vote) {
      sendNotFound(res, "Vote not found");
      return;
    }

    // Update vote count
    participant.submission.votes = Math.max(
      0,
      (participant.submission.votes || 0) - 1,
    );
    await participant.save();

    sendSuccess(
      res,
      {
        _id: String(participant._id),
        votes: participant.submission.votes,
        hasUserVoted: false,
      },
      "Vote removed successfully",
    );
  } catch (error) {
    console.error("Remove vote error:", error);
    sendInternalServerError(
      res,
      "Failed to remove vote",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
