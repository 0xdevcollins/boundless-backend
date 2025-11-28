import { Request, Response } from "express";
import mongoose from "mongoose";
import HackathonDiscussion from "../../models/hackathon-discussion.model.js";
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
  sendForbidden,
  sendInternalServerError,
  sendPaginatedResponse,
} from "../../utils/apiResponse.js";
import {
  AuthenticatedRequest,
  resolveHackathonByIdOrSlug,
} from "./hackathon.helpers.js";
import {
  formatDiscussionResponse,
  canModifyDiscussion,
  isUserRegisteredInHackathon,
} from "./hackathon-discussion.helpers.js";

/**
 * Get discussions
 * GET /organizations/{orgId}/hackathons/{hackathonId}/discussions
 * GET /hackathons/{hackathonSlugOrId}/discussions
 */
export const getDiscussions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { hackathonSlugOrId, orgId, hackathonId } = req.params;
    const {
      page = "1",
      limit = "20",
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

    // Build filter - only top-level discussions
    const filter: any = {
      hackathonId: hackathon._id,
      parentCommentId: null,
      status: "active",
    };

    // Build sort options
    let sortOptions: any = {};
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    switch (sortBy) {
      case "createdAt":
        sortOptions = { createdAt: sortDirection };
        break;
      case "updatedAt":
        sortOptions = { updatedAt: sortDirection };
        break;
      case "totalReactions":
        // Sort by total reactions (calculated)
        sortOptions = { createdAt: sortDirection }; // Will sort after fetching
        break;
      default:
        sortOptions = { createdAt: sortDirection };
    }

    // Fetch discussions
    const discussions = await HackathonDiscussion.find(filter)
      .populate({
        path: "userId",
        select: "email profile",
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Fetch replies for each discussion
    const discussionIds = discussions.map((d: any) => d._id);
    const replies = await HackathonDiscussion.find({
      parentCommentId: { $in: discussionIds },
      status: "active",
    })
      .populate({
        path: "userId",
        select: "email profile",
      })
      .sort({ createdAt: 1 })
      .lean();

    // Build nested structure
    const discussionsWithReplies = discussions.map((discussion: any) => {
      const discussionReplies = replies.filter(
        (reply: any) =>
          reply.parentCommentId?.toString() === discussion._id.toString(),
      );

      // Calculate reply count
      const replyCount = discussionReplies.length;

      // Format discussion
      const formatted = formatDiscussionResponse({
        ...discussion,
        replyCount,
        replies: discussionReplies.map(formatDiscussionResponse),
      });

      return formatted;
    });

    // Sort by totalReactions if needed
    if (sortBy === "totalReactions") {
      discussionsWithReplies.sort((a: any, b: any) => {
        const aTotal = a.totalReactions || 0;
        const bTotal = b.totalReactions || 0;
        return sortOrder === "asc" ? aTotal - bTotal : bTotal - aTotal;
      });
    }

    // Get total count
    const totalCount = await HackathonDiscussion.countDocuments(filter);

    const totalPages = Math.ceil(totalCount / limitNum);

    sendPaginatedResponse(
      res,
      discussionsWithReplies,
      {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      "Discussions retrieved successfully",
    );
  } catch (error) {
    console.error("Get discussions error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve discussions",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Create discussion
 * POST /organizations/{orgId}/hackathons/{hackathonId}/discussions
 * POST /hackathons/{hackathonSlugOrId}/discussions
 */
export const createDiscussion = async (
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
    const { content, parentCommentId } = req.body;

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

    // Check if user is registered in the hackathon
    const isRegistered = await isUserRegisteredInHackathon(
      user._id,
      hackathon._id as mongoose.Types.ObjectId,
    );
    if (!isRegistered) {
      sendForbidden(
        res,
        "You must be registered in this hackathon to participate in discussions",
      );
      return;
    }

    // Validate parent comment if provided
    let parentComment = null;
    if (parentCommentId) {
      if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
        sendBadRequest(res, "Invalid parent comment ID");
        return;
      }

      parentComment = await HackathonDiscussion.findOne({
        _id: parentCommentId,
        hackathonId: hackathon._id,
        status: "active",
      });

      if (!parentComment) {
        sendNotFound(res, "Parent comment not found");
        return;
      }

      // Don't allow nested replies (only one level deep)
      if (parentComment.parentCommentId) {
        sendBadRequest(
          res,
          "Cannot reply to a reply. Please reply to the original discussion.",
        );
        return;
      }
    }

    // Create discussion
    const discussion = await HackathonDiscussion.create({
      hackathonId: hackathon._id,
      userId: user._id,
      content,
      parentCommentId: parentCommentId || null,
      status: "active",
      editHistory: [],
      reactionCounts: {
        LIKE: 0,
        DISLIKE: 0,
        HELPFUL: 0,
      },
      replyCount: 0,
      isSpam: false,
      reports: [],
    });

    // Update parent's reply count if this is a reply
    if (parentComment) {
      await HackathonDiscussion.findByIdAndUpdate(parentComment._id, {
        $inc: { replyCount: 1 },
      });
    }

    // Populate user data
    await discussion.populate({
      path: "userId",
      select: "email profile",
    });

    const formatted = formatDiscussionResponse(discussion.toObject());

    sendCreated(res, formatted, "Discussion created successfully");
  } catch (error) {
    console.error("Create discussion error:", error);
    sendInternalServerError(
      res,
      "Failed to create discussion",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Update discussion
 * PUT /organizations/{orgId}/hackathons/{hackathonId}/discussions/{discussionId}
 * PUT /hackathons/{hackathonSlugOrId}/discussions/{discussionId}
 */
export const updateDiscussion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, discussionId, orgId, hackathonId } = req.params;
    const { content } = req.body;

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

    // Check if user is registered in the hackathon
    const isRegistered = await isUserRegisteredInHackathon(
      user._id,
      hackathon._id as mongoose.Types.ObjectId,
    );
    if (!isRegistered) {
      sendForbidden(
        res,
        "You must be registered in this hackathon to participate in discussions",
      );
      return;
    }

    // Find discussion
    const discussion = await HackathonDiscussion.findOne({
      _id: discussionId,
      hackathonId: hackathon._id,
    });

    if (!discussion) {
      sendNotFound(res, "Discussion not found");
      return;
    }

    // Check permissions
    const canModify = await canModifyDiscussion(
      discussion,
      user._id,
      hackathon.organizationId,
      user.email,
    );

    if (!canModify) {
      sendForbidden(res, "You don't have permission to edit this discussion");
      return;
    }

    // Add current content to edit history
    discussion.editHistory.push({
      content: discussion.content,
      editedAt: new Date(),
    });

    // Update content
    discussion.content = content;
    await discussion.save();

    // Populate user data
    await discussion.populate({
      path: "userId",
      select: "email profile",
    });

    const formatted = formatDiscussionResponse(discussion.toObject());

    sendSuccess(res, formatted, "Discussion updated successfully");
  } catch (error) {
    console.error("Update discussion error:", error);
    sendInternalServerError(
      res,
      "Failed to update discussion",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Delete discussion
 * DELETE /organizations/{orgId}/hackathons/{hackathonId}/discussions/{discussionId}
 * DELETE /hackathons/{hackathonSlugOrId}/discussions/{discussionId}
 */
export const deleteDiscussion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, discussionId, orgId, hackathonId } = req.params;

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

    // Check if user is registered in the hackathon
    const isRegistered = await isUserRegisteredInHackathon(
      user._id,
      hackathon._id as mongoose.Types.ObjectId,
    );
    if (!isRegistered) {
      sendForbidden(
        res,
        "You must be registered in this hackathon to participate in discussions",
      );
      return;
    }

    // Find discussion
    const discussion = await HackathonDiscussion.findOne({
      _id: discussionId,
      hackathonId: hackathon._id,
    });

    if (!discussion) {
      sendNotFound(res, "Discussion not found");
      return;
    }

    // Check permissions
    const canModify = await canModifyDiscussion(
      discussion,
      user._id,
      hackathon.organizationId,
      user.email,
    );

    if (!canModify) {
      sendForbidden(res, "You don't have permission to delete this discussion");
      return;
    }

    // Soft delete
    discussion.status = "deleted";
    await discussion.save();

    // If this is a reply, decrement parent's reply count
    if (discussion.parentCommentId) {
      await HackathonDiscussion.findByIdAndUpdate(discussion.parentCommentId, {
        $inc: { replyCount: -1 },
      });
    }

    sendSuccess(res, null, "Discussion deleted successfully");
  } catch (error) {
    console.error("Delete discussion error:", error);
    sendInternalServerError(
      res,
      "Failed to delete discussion",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Reply to discussion
 * POST /organizations/{orgId}/hackathons/{hackathonId}/discussions/{parentCommentId}/replies
 * POST /hackathons/{hackathonSlugOrId}/discussions/{parentCommentId}/replies
 */
export const replyToDiscussion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, parentCommentId, orgId, hackathonId } =
      req.params;
    const { content } = req.body;

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

    // Check if user is registered in the hackathon
    const isRegistered = await isUserRegisteredInHackathon(
      user._id,
      hackathon._id as mongoose.Types.ObjectId,
    );
    if (!isRegistered) {
      sendForbidden(
        res,
        "You must be registered in this hackathon to participate in discussions",
      );
      return;
    }

    // Find parent discussion
    const parentDiscussion = await HackathonDiscussion.findOne({
      _id: parentCommentId,
      hackathonId: hackathon._id,
      status: "active",
    });

    if (!parentDiscussion) {
      sendNotFound(res, "Parent discussion not found");
      return;
    }

    // Don't allow nested replies
    if (parentDiscussion.parentCommentId) {
      sendBadRequest(
        res,
        "Cannot reply to a reply. Please reply to the original discussion.",
      );
      return;
    }

    // Create reply
    const reply = await HackathonDiscussion.create({
      hackathonId: hackathon._id,
      userId: user._id,
      content,
      parentCommentId: parentCommentId,
      status: "active",
      editHistory: [],
      reactionCounts: {
        LIKE: 0,
        DISLIKE: 0,
        HELPFUL: 0,
      },
      replyCount: 0,
      isSpam: false,
      reports: [],
    });

    // Update parent's reply count
    await HackathonDiscussion.findByIdAndUpdate(parentCommentId, {
      $inc: { replyCount: 1 },
    });

    // Populate user data
    await reply.populate({
      path: "userId",
      select: "email profile",
    });

    const formatted = formatDiscussionResponse(reply.toObject());

    sendCreated(res, formatted, "Reply created successfully");
  } catch (error) {
    console.error("Reply to discussion error:", error);
    sendInternalServerError(
      res,
      "Failed to create reply",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * Report discussion
 * POST /organizations/{orgId}/hackathons/{hackathonId}/discussions/{discussionId}/report
 * POST /hackathons/{hackathonSlugOrId}/discussions/{discussionId}/report
 */
export const reportDiscussion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendForbidden(res, "Authentication required");
      return;
    }

    const { hackathonSlugOrId, discussionId, orgId, hackathonId } = req.params;
    const { reason, description } = req.body;

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

    // Check if user is registered in the hackathon
    const isRegistered = await isUserRegisteredInHackathon(
      user._id,
      hackathon._id as mongoose.Types.ObjectId,
    );
    if (!isRegistered) {
      sendForbidden(
        res,
        "You must be registered in this hackathon to participate in discussions",
      );
      return;
    }

    // Find discussion
    const discussion = await HackathonDiscussion.findOne({
      _id: discussionId,
      hackathonId: hackathon._id,
    });

    if (!discussion) {
      sendNotFound(res, "Discussion not found");
      return;
    }

    // Check if user already reported
    const existingReport = discussion.reports.find(
      (r) => r.userId.toString() === user._id.toString(),
    );

    if (existingReport) {
      sendBadRequest(res, "You have already reported this discussion");
      return;
    }

    // Add report
    discussion.reports.push({
      userId: user._id,
      reason,
      description,
      createdAt: new Date(),
    });

    await discussion.save();

    sendSuccess(res, null, "Discussion reported successfully");
  } catch (error) {
    console.error("Report discussion error:", error);
    sendInternalServerError(
      res,
      "Failed to report discussion",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
