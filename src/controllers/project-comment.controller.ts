import { Request, Response } from "express";
import ProjectComment from "../models/project-comment.model";
import Project, { ProjectStatus } from "../models/project.model";
import User from "../models/user.model";
import mongoose from "mongoose";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendInternalServerError,
  sendUnauthorized,
  checkResource,
} from "../utils/apiResponse";
import { checkSpam } from "../utils/moderation.utils";

/**
 * @desc    Add a comment to a project
 * @route   POST /api/projects/:id/comments
 * @access  Private
 */
export const addProjectComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: projectId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user?._id;

    // Validate project ID format
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    // Validate user authentication
    if (!userId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      sendBadRequest(res, "Comment content is required");
      return;
    }

    if (content.trim().length > 2000) {
      sendBadRequest(res, "Comment content cannot exceed 2000 characters");
      return;
    }

    // Check if project exists and allows comments
    const project = await Project.findById(projectId).session(session);
    if (checkResource(res, !project, "Project not found", 404)) {
      await session.abortTransaction();
      return;
    }

    // Check if project status allows comments
    const commentableStatuses = [
      ProjectStatus.IDEA,
      ProjectStatus.REVIEWING,
      ProjectStatus.VALIDATED,
      ProjectStatus.CAMPAIGNING,
      ProjectStatus.LIVE,
    ];
    if (!commentableStatuses.includes(project!.status)) {
      sendBadRequest(res, "Project is not available for comments");
      await session.abortTransaction();
      return;
    }

    // Validate parent comment if provided
    let parentComment = null;
    if (parentCommentId) {
      if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
        sendBadRequest(res, "Invalid parent comment ID format");
        await session.abortTransaction();
        return;
      }

      parentComment =
        await ProjectComment.findById(parentCommentId).session(session);
      if (!parentComment) {
        sendBadRequest(res, "Parent comment not found");
        await session.abortTransaction();
        return;
      }

      // Ensure parent comment belongs to the same project
      if (parentComment.projectId.toString() !== projectId) {
        sendBadRequest(res, "Parent comment does not belong to this project");
        await session.abortTransaction();
        return;
      }

      // Don't allow nested replies (only one level deep)
      if (parentComment.parentCommentId) {
        sendBadRequest(
          res,
          "Cannot reply to a reply. Please reply to the original comment.",
        );
        await session.abortTransaction();
        return;
      }
    }

    // Moderate content for spam/inappropriate content
    const isSpam = await checkSpam(content.trim());

    // Create the comment
    const comment = new ProjectComment({
      userId,
      projectId,
      content: content.trim(),
      parentCommentId: parentCommentId || null,
      status: isSpam ? "flagged" : "active",
      isSpam,
    });

    await comment.save({ session });

    // Update user comment stats
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: { "stats.commentsPosted": 1 },
      },
      { session },
    );

    // Update project comment count (if you have this field)
    await Project.findByIdAndUpdate(
      projectId,
      {
        $inc: { "stats.commentsCount": 1 },
      },
      { session },
    );

    await session.commitTransaction();

    // Populate comment data for response
    await comment.populate([
      {
        path: "userId",
        select:
          "profile.firstName profile.lastName profile.username profile.avatar",
      },
    ]);

    const responseData = {
      comment: {
        _id: comment._id,
        content: comment.content,
        userId: comment.userId,
        projectId: comment.projectId,
        parentCommentId: comment.parentCommentId,
        status: comment.status,
        reactionCounts: comment.reactionCounts,
        totalReactions:
          (comment.reactionCounts?.LIKE || 0) +
          (comment.reactionCounts?.DISLIKE || 0) +
          (comment.reactionCounts?.HELPFUL || 0),
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        isSpam: comment.isSpam,
      },
      moderationResult: {
        flagged: isSpam,
        reason: isSpam ? "Content flagged for review" : null,
      },
    };

    sendCreated(
      res,
      responseData,
      isSpam ? "Comment submitted for review" : "Comment added successfully",
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Add project comment error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      sendBadRequest(res, "Validation failed", validationErrors.join(", "));
      return;
    }

    if (error instanceof mongoose.Error.CastError) {
      sendBadRequest(res, "Invalid data format");
      return;
    }

    sendInternalServerError(
      res,
      "Failed to add comment",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get comments for a project
 * @route   GET /api/projects/:id/comments
 * @access  Public
 */
export const getProjectComments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const {
      page = 1,
      limit = 10,
      parentCommentId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Validate project ID format
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    // Check if project exists
    const project = await Project.findById(projectId).select("_id");
    if (checkResource(res, !project, "Project not found", 404)) {
      return;
    }

    // Validate parent comment ID if provided
    if (
      parentCommentId &&
      !mongoose.Types.ObjectId.isValid(parentCommentId as string)
    ) {
      sendBadRequest(res, "Invalid parent comment ID format");
      return;
    }

    // Build filter
    const filter: any = {
      projectId,
      status: "active",
    };

    if (parentCommentId) {
      filter.parentCommentId = parentCommentId;
    } else {
      filter.parentCommentId = null; // Only top-level comments
    }

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOptions: any = {};
    const validSortFields = ["createdAt", "updatedAt", "totalReactions"];
    const sortField = validSortFields.includes(sortBy as string)
      ? sortBy
      : "createdAt";
    sortOptions[sortField as string] = sortOrder === "asc" ? 1 : -1;

    // Get comments and total count
    const [comments, totalCount] = await Promise.all([
      ProjectComment.find(filter)
        .populate(
          "userId",
          "profile.firstName profile.lastName profile.username profile.avatar",
        )
        .populate("replyCount")
        .select("-reports -editHistory")
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ProjectComment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    // Get reply counts for top-level comments
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        if (!comment.parentCommentId) {
          const replyCount = await ProjectComment.countDocuments({
            parentCommentId: comment._id,
            status: "active",
          });
          return {
            ...comment,
            replyCount,
            totalReactions:
              comment.reactionCounts.LIKE +
              comment.reactionCounts.DISLIKE +
              comment.reactionCounts.HELPFUL,
          };
        }
        return {
          ...comment,
          replyCount: 0,
          totalReactions:
            comment.reactionCounts.LIKE +
            comment.reactionCounts.DISLIKE +
            comment.reactionCounts.HELPFUL,
        };
      }),
    );

    const responseData = {
      comments: commentsWithReplies,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      filters: {
        parentCommentId: parentCommentId || null,
        sortBy,
        sortOrder,
      },
    };

    sendSuccess(res, responseData, "Project comments retrieved successfully");
  } catch (error) {
    console.error("Get project comments error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve project comments",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @desc    Update a comment
 * @route   PUT /api/projects/:id/comments/:commentId
 * @access  Private (Comment author only)
 */
export const updateProjectComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: projectId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user?._id;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(projectId) ||
      !mongoose.Types.ObjectId.isValid(commentId)
    ) {
      sendBadRequest(res, "Invalid ID format");
      return;
    }

    // Validate user authentication
    if (!userId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      sendBadRequest(res, "Comment content is required");
      return;
    }

    if (content.trim().length > 2000) {
      sendBadRequest(res, "Comment content cannot exceed 2000 characters");
      return;
    }

    // Find the comment
    const comment = await ProjectComment.findOne({
      _id: commentId,
      projectId,
      userId,
      status: { $in: ["active", "flagged"] },
    }).session(session);

    if (
      checkResource(
        res,
        !comment,
        "Comment not found or you don't have permission to edit it",
        404,
      )
    ) {
      await session.abortTransaction();
      return;
    }

    // Check if comment is too old to edit (24 hours)
    const editTimeLimit = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (Date.now() - comment!.createdAt.getTime() > editTimeLimit) {
      sendBadRequest(
        res,
        "Comment can only be edited within 24 hours of posting",
      );
      await session.abortTransaction();
      return;
    }

    // Store original content in edit history
    comment!.editHistory.push({
      content: comment!.content,
      editedAt: new Date(),
    });

    // Moderate new content
    const isSpam = await checkSpam(content.trim());

    // Update comment
    comment!.content = content.trim();
    comment!.status = isSpam ? "flagged" : "active";
    comment!.isSpam = isSpam;

    await comment!.save({ session });

    await session.commitTransaction();

    // Populate comment data for response
    await comment!.populate([
      {
        path: "userId",
        select:
          "profile.firstName profile.lastName profile.username profile.avatar",
      },
    ]);

    const responseData = {
      comment: {
        _id: comment!._id,
        content: comment!.content,
        userId: comment!.userId,
        status: comment!.status,
        reactionCounts: comment!.reactionCounts,
        createdAt: comment!.createdAt,
        updatedAt: comment!.updatedAt,
        editHistory: comment!.editHistory.length,
      },
      moderationResult: {
        flagged: isSpam,
        reason: isSpam ? "Content flagged for review" : null,
      },
    };

    sendSuccess(
      res,
      responseData,
      isSpam
        ? "Comment updated and submitted for review"
        : "Comment updated successfully",
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Update project comment error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      sendBadRequest(res, "Validation failed", validationErrors.join(", "));
      return;
    }

    sendInternalServerError(
      res,
      "Failed to update comment",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Delete a comment
 * @route   DELETE /api/projects/:id/comments/:commentId
 * @access  Private (Comment author only)
 */
export const deleteProjectComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: projectId, commentId } = req.params;
    const userId = req.user?._id;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(projectId) ||
      !mongoose.Types.ObjectId.isValid(commentId)
    ) {
      sendBadRequest(res, "Invalid ID format");
      return;
    }

    // Validate user authentication
    if (!userId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // Find the comment
    const comment = await ProjectComment.findOne({
      _id: commentId,
      projectId,
      userId,
      status: { $ne: "deleted" },
    }).session(session);

    if (
      checkResource(
        res,
        !comment,
        "Comment not found or you don't have permission to delete it",
        404,
      )
    ) {
      await session.abortTransaction();
      return;
    }

    // Soft delete the comment
    comment!.status = "deleted";
    comment!.content = "[Comment deleted by user]";
    await comment!.save({ session });

    // Update user comment stats
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: { "stats.commentsPosted": -1 },
      },
      { session },
    );

    // Update project comment count
    await Project.findByIdAndUpdate(
      projectId,
      {
        $inc: { "stats.commentsCount": -1 },
      },
      { session },
    );

    await session.commitTransaction();

    sendSuccess(res, null, "Comment deleted successfully");
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete project comment error:", error);
    sendInternalServerError(
      res,
      "Failed to delete comment",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Report a comment
 * @route   POST /api/projects/:id/comments/:commentId/report
 * @access  Private
 */
export const reportProjectComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id: projectId, commentId } = req.params;
    const { reason, description } = req.body;
    const userId = req.user?._id;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(projectId) ||
      !mongoose.Types.ObjectId.isValid(commentId)
    ) {
      sendBadRequest(res, "Invalid ID format");
      return;
    }

    // Validate user authentication
    if (!userId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // Validate reason
    const validReasons = [
      "spam",
      "inappropriate",
      "harassment",
      "misinformation",
      "other",
    ];
    if (!reason || !validReasons.includes(reason)) {
      sendBadRequest(res, `Reason must be one of: ${validReasons.join(", ")}`);
      return;
    }

    // Find the comment
    const comment = await ProjectComment.findOne({
      _id: commentId,
      projectId,
      status: "active",
    });

    if (checkResource(res, !comment, "Comment not found", 404)) {
      return;
    }

    // Check if user has already reported this comment
    const existingReport = comment!.reports.find(
      (report) => report.userId.toString() === userId.toString(),
    );
    if (existingReport) {
      sendBadRequest(res, "You have already reported this comment");
      return;
    }

    // Add the report
    comment!.reports.push({
      userId,
      reason,
      description: description?.trim(),
      createdAt: new Date(),
    });

    // Flag comment if it has multiple reports
    if (comment!.reports.length >= 3) {
      comment!.status = "flagged";
    }

    await comment!.save();

    sendSuccess(res, null, "Comment reported successfully");
  } catch (error) {
    console.error("Report project comment error:", error);
    sendInternalServerError(
      res,
      "Failed to report comment",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
