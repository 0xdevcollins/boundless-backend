import { Request, Response } from "express";
import TransactionModel, {
  TransactionType,
  TransactionStatus,
} from "../models/admin.transaction.model";
import ProjectModel from "../models.archive/project.model";
import { validateRequest } from "../middleware/validateRequest";
import { query } from "express-validator";
import mongoose from "mongoose";

// Validation schemas
export const listTransactionsSchema = [
  query("status")
    .optional()
    .isIn(Object.values(TransactionStatus))
    .withMessage("Invalid transaction status"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
  query("projectId").optional().isMongoId().withMessage("Invalid project ID"),
  query("sortBy")
    .optional()
    .isIn(["timestamp", "amount", "projectName"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Invalid sort order"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

export const getProjectTransactionsSchema = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

export const getPendingTransactionsSchema = [
  query("sortBy")
    .optional()
    .isIn(["timestamp", "amount"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Invalid sort order"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

export const getFundingStatisticsSchema = [
  query("period")
    .optional()
    .isIn(["day", "week", "month", "year", "all"])
    .withMessage("Invalid period"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
];

// List all funding transactions
export const listTransactions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      status,
      startDate,
      endDate,
      projectId,
      sortBy = "timestamp",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Build query
    const query: any = { type: TransactionType.FUNDING };
    if (status) query.status = status;
    if (projectId)
      query.projectId = new mongoose.Types.ObjectId(projectId as string);
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    // Build sort object
    const sort: any = {};
    if (sortBy === "projectName") {
      // We'll handle this after aggregation
    } else {
      sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query with aggregation for project details
    const transactions = await TransactionModel.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "projects",
          localField: "projectId",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: "$project" },
      {
        $project: {
          _id: 1,
          amount: 1,
          status: 1,
          timestamp: 1,
          transactionHash: 1,
          fromAddress: 1,
          toAddress: 1,
          project: {
            _id: 1,
            title: 1,
            category: 1,
          },
        },
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: Number(limit) },
    ]);

    // Get total count
    const total = await TransactionModel.countDocuments(query);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error listing transactions:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving transactions",
    });
  }
};

// Get detailed transactions for a specific project
export const getProjectTransactions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate project exists
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get transactions with details
    const transactions = await TransactionModel.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
          type: TransactionType.FUNDING,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "fromAddress",
          foreignField: "walletAddress",
          as: "contributor",
        },
      },
      { $unwind: "$contributor" },
      {
        $project: {
          _id: 1,
          amount: 1,
          status: 1,
          timestamp: 1,
          transactionHash: 1,
          fromAddress: 1,
          toAddress: 1,
          contributor: {
            _id: 1,
            profile: {
              firstName: 1,
              lastName: 1,
              username: 1,
            },
          },
        },
      },
      { $sort: { timestamp: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
    ]);

    // Get statistics
    const stats = await TransactionModel.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
          type: TransactionType.FUNDING,
        },
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          successfulTransactions: {
            $sum: {
              $cond: [{ $eq: ["$status", TransactionStatus.CONFIRMED] }, 1, 0],
            },
          },
          failedTransactions: {
            $sum: {
              $cond: [{ $eq: ["$status", TransactionStatus.FAILED] }, 1, 0],
            },
          },
          uniqueBackers: { $addToSet: "$fromAddress" },
        },
      },
      {
        $project: {
          _id: 0,
          totalTransactions: 1,
          totalAmount: 1,
          successfulTransactions: 1,
          failedTransactions: 1,
          uniqueBackers: { $size: "$uniqueBackers" },
          averageContribution: {
            $divide: ["$totalAmount", { $size: "$uniqueBackers" }],
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        project: {
          _id: project._id,
          title: project.title,
          category: project.category,
          funding: project.funding,
        },
        transactions,
        statistics: stats[0] || {
          totalTransactions: 0,
          totalAmount: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          uniqueBackers: 0,
          averageContribution: 0,
        },
        pagination: {
          total: transactions.length,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(transactions.length / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error getting project transactions:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving project transactions",
    });
  }
};

// List pending funding requests
export const getPendingTransactions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      sortBy = "timestamp",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get pending transactions with project details
    const transactions = await TransactionModel.aggregate([
      {
        $match: {
          type: TransactionType.FUNDING,
          status: TransactionStatus.PENDING,
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "projectId",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: "$project" },
      {
        $project: {
          _id: 1,
          amount: 1,
          timestamp: 1,
          transactionHash: 1,
          fromAddress: 1,
          toAddress: 1,
          project: {
            _id: 1,
            title: 1,
            category: 1,
            funding: 1,
          },
        },
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: Number(limit) },
    ]);

    // Get total count
    const total = await TransactionModel.countDocuments({
      type: TransactionType.FUNDING,
      status: TransactionStatus.PENDING,
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error getting pending transactions:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving pending transactions",
    });
  }
};

// Get funding statistics
export const getFundingStatistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { period = "all", startDate, endDate } = req.query;

    // Build date range
    let dateRange: any = {};
    if (period !== "all") {
      const now = new Date();
      switch (period) {
        case "day":
          dateRange.$gte = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          dateRange.$gte = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          dateRange.$gte = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "year":
          dateRange.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }
    }
    if (startDate) dateRange.$gte = new Date(startDate as string);
    if (endDate) dateRange.$lte = new Date(endDate as string);

    // Get overview statistics
    const overview = await TransactionModel.aggregate([
      {
        $match: {
          type: TransactionType.FUNDING,
          ...(Object.keys(dateRange).length > 0 && { timestamp: dateRange }),
        },
      },
      {
        $group: {
          _id: null,
          totalFundsRaised: { $sum: "$amount" },
          totalProjects: { $addToSet: "$projectId" },
          totalTransactions: { $sum: 1 },
          successfulTransactions: {
            $sum: {
              $cond: [{ $eq: ["$status", TransactionStatus.CONFIRMED] }, 1, 0],
            },
          },
          failedTransactions: {
            $sum: {
              $cond: [{ $eq: ["$status", TransactionStatus.FAILED] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalFundsRaised: 1,
          totalProjects: { $size: "$totalProjects" },
          totalTransactions: 1,
          successfulTransactions: 1,
          failedTransactions: 1,
          successRate: {
            $multiply: [
              { $divide: ["$successfulTransactions", "$totalTransactions"] },
              100,
            ],
          },
        },
      },
    ]);

    // Get daily trends
    const dailyTrends = await TransactionModel.aggregate([
      {
        $match: {
          type: TransactionType.FUNDING,
          ...(Object.keys(dateRange).length > 0 && { timestamp: dateRange }),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
          },
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get top projects
    const topProjects = await TransactionModel.aggregate([
      {
        $match: {
          type: TransactionType.FUNDING,
          status: TransactionStatus.CONFIRMED,
          ...(Object.keys(dateRange).length > 0 && { timestamp: dateRange }),
        },
      },
      {
        $group: {
          _id: "$projectId",
          totalRaised: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "_id",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: "$project" },
      {
        $project: {
          _id: 1,
          title: "$project.title",
          category: "$project.category",
          totalRaised: 1,
          transactionCount: 1,
        },
      },
      { $sort: { totalRaised: -1 } },
      { $limit: 10 },
    ]);

    // Get top backers
    const topBackers = await TransactionModel.aggregate([
      {
        $match: {
          type: TransactionType.FUNDING,
          status: TransactionStatus.CONFIRMED,
          ...(Object.keys(dateRange).length > 0 && { timestamp: dateRange }),
        },
      },
      {
        $group: {
          _id: "$fromAddress",
          totalContributed: { $sum: "$amount" },
          projectCount: { $addToSet: "$projectId" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "walletAddress",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 1,
          name: {
            $concat: ["$user.profile.firstName", " ", "$user.profile.lastName"],
          },
          username: "$user.profile.username",
          totalContributed: 1,
          projectCount: { $size: "$projectCount" },
        },
      },
      { $sort: { totalContributed: -1 } },
      { $limit: 10 },
    ]);

    // Get category breakdown
    const categoryBreakdown = await TransactionModel.aggregate([
      {
        $match: {
          type: TransactionType.FUNDING,
          status: TransactionStatus.CONFIRMED,
          ...(Object.keys(dateRange).length > 0 && { timestamp: dateRange }),
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "projectId",
          foreignField: "_id",
          as: "project",
        },
      },
      { $unwind: "$project" },
      {
        $group: {
          _id: "$project.category",
          totalAmount: { $sum: "$amount" },
          projectCount: { $addToSet: "$projectId" },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalAmount: 1,
          projectCount: { $size: "$projectCount" },
          transactionCount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: overview[0] || {
          totalFundsRaised: 0,
          totalProjects: 0,
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          successRate: 0,
        },
        trends: {
          daily: dailyTrends,
        },
        topProjects,
        topBackers,
        categoryBreakdown,
      },
    });
  } catch (error) {
    console.error("Error getting funding statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving funding statistics",
    });
  }
};
