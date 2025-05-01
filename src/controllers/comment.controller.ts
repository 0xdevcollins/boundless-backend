import { Request, Response } from "express";
import Comment, { IComment } from "../models/comment.model";
import { extractMentions, validateContent } from "../utils/comment.utils";
import mongoose, { SortOrder } from "mongoose";
import { checkSpam } from "../utils/moderation.utils";
import { ParsedQs } from "qs";

// Create a new comment
export const createComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { content, parentCommentId } = req.body;
    const { id: projectId } = req.params;
    const userId = (req as any).user._id;

    // Validate content
    const validationError = validateContent(content);
    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    // Extract mentions
    const mentions = await extractMentions(content);

    // Check for spam
    const isSpam = await checkSpam(content);

    // Create comment
    const comment = await Comment.create({
      content,
      projectId,
      author: userId,
      parentCommentId: parentCommentId || null,
      mentions,
      isSpam,
      status: isSpam ? "flagged" : "active",
    });

    await comment.populate([
      { path: "author", select: "name username image" },
      { path: "mentions", select: "name username image" },
    ]);

    res.status(201).json(comment);
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({ message: "Failed to create comment" });
  }
};

// Helper function to validate and convert sort parameter
const validateAndConvertSort = (sortParam: any): Record<string, SortOrder> => {
  const defaultSort = { createdAt: -1 as SortOrder };

  if (!sortParam) {
    return defaultSort;
  }

  const sortValue = Array.isArray(sortParam) ? sortParam[0] : sortParam;

  if (typeof sortValue !== "string") {
    return defaultSort;
  }

  // Validate sort field
  const validSortFields = ["createdAt", "updatedAt", "reactionCounts.LIKE"];
  const sortField = sortValue.startsWith("-") ? sortValue.slice(1) : sortValue;

  if (!validSortFields.includes(sortField)) {
    return defaultSort;
  }

  // Convert to mongoose sort object
  return { [sortField]: sortValue.startsWith("-") ? -1 : 1 } as Record<
    string,
    SortOrder
  >;
};

type QueryValue = string | string[] | ParsedQs | ParsedQs[] | undefined;

interface QueryParams {
  [key: string]: QueryValue;
  parentId?: string;
  page?: string;
  limit?: string;
  sort?: string;
}

// Get comments for a project
export const getComments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const {
      parentId,
      page: pageStr = "1",
      limit: limitStr = "10",
      sort = "-createdAt",
    } = req.query as QueryParams;

    // Convert string values to numbers
    const page = parseInt(pageStr as string, 10);
    const limit = parseInt(limitStr as string, 10);

    const query: any = {
      projectId,
      status: { $ne: "deleted" },
    };

    if (parentId) {
      query.parentCommentId = parentId;
    } else {
      query.parentCommentId = null; // Get top-level comments only
    }

    const skip = (page - 1) * limit;
    const sortOptions = validateAndConvertSort(sort);

    const [comments, total] = await Promise.all([
      Comment.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate([
          { path: "author", select: "name username image" },
          { path: "mentions", select: "name username image" },
        ]),
      Comment.countDocuments(query),
    ]);

    res.json({
      comments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ message: "Failed to retrieve comments" });
  }
};

// Update a comment
export const updateComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = (req as any).user._id;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    if (comment.author.toString() !== userId.toString()) {
      res
        .status(403)
        .json({ message: "Not authorized to update this comment" });
      return;
    }

    // Validate content
    const validationError = validateContent(content);
    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    // Extract mentions
    const mentions = await extractMentions(content);

    // Add to edit history
    comment.editHistory.push({
      content: comment.content,
      editedAt: new Date(),
      editedBy: new mongoose.Types.ObjectId(userId),
    });

    // Update comment
    comment.content = content;
    comment.mentions = mentions;
    await comment.save();

    await comment.populate([
      { path: "author", select: "name username image" },
      { path: "mentions", select: "name username image" },
    ]);

    res.json(comment);
  } catch (error) {
    console.error("Update comment error:", error);
    res.status(500).json({ message: "Failed to update comment" });
  }
};

// Delete a comment
export const deleteComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user._id;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    if (comment.author.toString() !== userId.toString()) {
      res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
      return;
    }

    comment.status = "deleted";
    await comment.save();

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

// Report a comment
export const reportComment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { reason, description } = req.body;
    const userId = (req as any).user._id;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    // Check if user has already reported this comment
    const existingReport = comment.reports.find(
      (report) => report.userId.toString() === userId.toString(),
    );

    if (existingReport) {
      res
        .status(400)
        .json({ message: "You have already reported this comment" });
      return;
    }

    comment.reports.push({
      userId: new mongoose.Types.ObjectId(userId),
      reason,
      description,
      createdAt: new Date(),
    });

    // If comment receives multiple reports, flag it for moderation
    if (comment.reports.length >= 3) {
      comment.status = "flagged";
    }

    await comment.save();

    res.json({ message: "Comment reported successfully" });
  } catch (error) {
    console.error("Report comment error:", error);
    res.status(500).json({ message: "Failed to report comment" });
  }
};
