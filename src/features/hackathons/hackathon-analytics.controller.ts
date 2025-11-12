import { Request, Response } from "express";
import mongoose from "mongoose";
import Hackathon from "../../models/hackathon.model";
import HackathonParticipant from "../../models/hackathon-participant.model";
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendInternalServerError,
} from "../../utils/apiResponse";
import { AuthenticatedRequest, canManageHackathons } from "./hackathon.helpers";

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/statistics:
 *   get:
 *     summary: Get hackathon statistics
 *     description: Retrieve statistics for a hackathon including participants, submissions, judges, and milestones
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getHackathonStatistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;

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
        "Only owners and admins can view hackathon statistics for this organization",
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

    // Get participants count
    const participantsCount = await HackathonParticipant.countDocuments({
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    // Get submissions count (participants who have submitted)
    const submissionsCount = await HackathonParticipant.countDocuments({
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      submission: { $exists: true, $ne: null },
    });

    // Get active judges count
    // TODO: Implement judge model/role system when available
    // For now, returning 0 as placeholder
    const activeJudges = 0;

    // Get completed milestones count
    // TODO: Implement milestone tracking for hackathon projects when available
    // For now, returning 0 as placeholder
    const completedMilestones = 0;

    const statistics = {
      participantsCount,
      submissionsCount,
      activeJudges,
      completedMilestones,
    };

    sendSuccess(res, statistics, "Statistics retrieved successfully");
  } catch (error) {
    console.error("Get hackathon statistics error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve hackathon statistics",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/analytics:
 *   get:
 *     summary: Get hackathon analytics
 *     description: Retrieve time-series analytics data for submissions and participants
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [daily, weekly]
 *         description: Time granularity for analytics (optional)
 */
export const getHackathonAnalytics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;
    const { granularity } = req.query;

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
        "Only owners and admins can view hackathon analytics for this organization",
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

    // Helper function to generate time series data
    const generateTimeSeries = (
      startDate: Date,
      endDate: Date,
      granularity: "daily" | "weekly",
    ): Array<{ date: string; count: number }> => {
      const data: Array<{ date: string; count: number }> = [];
      const current = new Date(startDate);
      const end = new Date(endDate);

      if (granularity === "daily") {
        while (current <= end) {
          data.push({
            date: current.toISOString().split("T")[0],
            count: 0,
          });
          current.setDate(current.getDate() + 1);
        }
      } else {
        // Weekly aggregation
        const seenWeeks = new Set<string>();
        while (current <= end) {
          // Get the start of the week (Monday)
          const weekStart = new Date(current);
          const dayOfWeek = current.getDay();
          const diff =
            current.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          weekStart.setDate(diff);
          weekStart.setHours(0, 0, 0, 0);

          const weekKey = weekStart.toISOString().split("T")[0];

          // Only add if we haven't seen this week yet
          if (!seenWeeks.has(weekKey)) {
            data.push({
              date: weekKey,
              count: 0,
            });
            seenWeeks.add(weekKey);
          }

          // Move to next week
          current.setDate(current.getDate() + 7);
        }
      }

      return data;
    };

    // Get hackathon date range
    const startDate = hackathon.startDate || hackathon.createdAt;
    const endDate =
      hackathon.winnerAnnouncementDate ||
      hackathon.submissionDeadline ||
      new Date();

    // Generate daily time series
    const dailySubmissions = generateTimeSeries(startDate, endDate, "daily");
    const dailyParticipants = generateTimeSeries(startDate, endDate, "daily");

    // Generate weekly time series
    const weeklySubmissions = generateTimeSeries(startDate, endDate, "weekly");
    const weeklyParticipants = generateTimeSeries(startDate, endDate, "weekly");

    // Aggregate submissions by date (daily)
    const submissionsDaily = await HackathonParticipant.aggregate([
      {
        $match: {
          hackathonId: new mongoose.Types.ObjectId(hackathonId),
          organizationId: new mongoose.Types.ObjectId(orgId),
          submission: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$submittedAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Map daily submissions to time series
    submissionsDaily.forEach((item) => {
      const dataPoint = dailySubmissions.find((d) => d.date === item._id);
      if (dataPoint) dataPoint.count = item.count;
    });

    // Aggregate participants by registration date (daily)
    const participantsDaily = await HackathonParticipant.aggregate([
      {
        $match: {
          hackathonId: new mongoose.Types.ObjectId(hackathonId),
          organizationId: new mongoose.Types.ObjectId(orgId),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$registeredAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Map daily participants to time series
    participantsDaily.forEach((item) => {
      const dataPoint = dailyParticipants.find((d) => d.date === item._id);
      if (dataPoint) dataPoint.count = item.count;
    });

    // Aggregate submissions by week
    // Get all submissions and group them by week manually
    const allSubmissions = await HackathonParticipant.find({
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      submission: { $exists: true, $ne: null },
    })
      .select("submittedAt")
      .lean();

    const submissionsByWeek = new Map<string, number>();
    allSubmissions.forEach((item: any) => {
      if (item.submittedAt) {
        const date = new Date(item.submittedAt);
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(date);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        const weekKey = weekStart.toISOString().split("T")[0];
        submissionsByWeek.set(
          weekKey,
          (submissionsByWeek.get(weekKey) || 0) + 1,
        );
      }
    });

    // Map weekly submissions to time series
    submissionsByWeek.forEach((count, weekKey) => {
      const dataPoint = weeklySubmissions.find((d) => d.date === weekKey);
      if (dataPoint) dataPoint.count = count;
    });

    // Aggregate participants by week
    const allParticipants = await HackathonParticipant.find({
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
    })
      .select("registeredAt")
      .lean();

    const participantsByWeek = new Map<string, number>();
    allParticipants.forEach((item: any) => {
      if (item.registeredAt) {
        const date = new Date(item.registeredAt);
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(date);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        const weekKey = weekStart.toISOString().split("T")[0];
        participantsByWeek.set(
          weekKey,
          (participantsByWeek.get(weekKey) || 0) + 1,
        );
      }
    });

    // Map weekly participants to time series
    participantsByWeek.forEach((count, weekKey) => {
      const dataPoint = weeklyParticipants.find((d) => d.date === weekKey);
      if (dataPoint) dataPoint.count = count;
    });

    const analytics = {
      submissions: {
        daily: dailySubmissions,
        weekly: weeklySubmissions,
      },
      participants: {
        daily: dailyParticipants,
        weekly: weeklyParticipants,
      },
    };

    // If granularity is specified, filter the response
    if (granularity === "daily") {
      sendSuccess(
        res,
        {
          submissions: { daily: dailySubmissions },
          participants: { daily: dailyParticipants },
        },
        "Analytics retrieved successfully",
      );
    } else if (granularity === "weekly") {
      sendSuccess(
        res,
        {
          submissions: { weekly: weeklySubmissions },
          participants: { weekly: weeklyParticipants },
        },
        "Analytics retrieved successfully",
      );
    } else {
      sendSuccess(res, analytics, "Analytics retrieved successfully");
    }
  } catch (error) {
    console.error("Get hackathon analytics error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve hackathon analytics",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
