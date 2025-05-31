import { Request, Response } from "express";
import Report from "../models/report.model";
import Comment from "../models/comment.model";
import mongoose from "mongoose";

async function getReports(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const status = req.query.status as string;
    const contentType = req.query.contentType as string;

    const filter: any = {};
    if (status) filter.status = status;
    if (contentType) filter.contentType = contentType;

    const reports = await Report.find(filter)
      .populate("reportedBy", "username email")
      .populate("reviewedBy", "username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Report.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function handleReport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, actionTaken } = req.body;
    const reviewedBy = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid report ID",
      });
    }

    const report = await Report.findByIdAndUpdate(
      id,
      {
        status,
        actionTaken,
        reviewedBy,
        reviewedAt: new Date(),
      },
      { new: true },
    ).populate("reportedBy", "username email");

    if (!report) {
      res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.status(200).json({
      success: true,
      data: report,
      message: "Report updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update report",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function getFlaggedComments(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const status = req.query.status as string;
    const filter: any = {};

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ["flagged", "hidden"] };
    }

    const comments = await Comment.find(filter)
      .populate("author", "username email")
      .populate("projectId", "title")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch flagged comments",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function deleteComment(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
    }

    const comment = await Comment.findByIdAndUpdate(
      id,
      { status: "deleted" },
      { new: true },
    );

    if (!comment) {
      res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      data: comment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function flagContent(req: Request, res: Response) {
  try {
    const { contentId, contentType, reason, description } = req.body;
    const reportedBy = req.user?.id;

    if (!contentId || !contentType || !reason) {
      res.status(400).json({
        success: false,
        message: "Content ID, content type, and reason are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID",
      });
    }

    let contentExists = false;
    if (contentType === "comment") {
      const comment = await Comment.findById(contentId);
      contentExists = !!comment;

      // Update comment status to flagged
      if (comment) {
        await Comment.findByIdAndUpdate(contentId, { status: "flagged" });
      }
    }

    if (!contentExists) {
      res.status(404).json({
        success: false,
        message: "Content not found",
      });
    }

    const report = new Report({
      contentId,
      contentType,
      reportedBy,
      reason,
      description,
    });

    await report.save();

    res.status(201).json({
      success: true,
      data: report,
      message: "Content flagged successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to flag content",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
export default {
  flagContent,
  deleteComment,
  getFlaggedComments,
  handleReport,
  getReports,
};
