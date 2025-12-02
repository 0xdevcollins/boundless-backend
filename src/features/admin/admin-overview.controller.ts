import { Request, Response } from "express";
import User from "../../models/user.model.js";
import Organization from "../../models/organization.model.js";
import Project from "../../models/project.model.js";
import Hackathon from "../../models/hackathon.model.js";
import Transaction from "../../models/transaction.model.js";
import Crowdfund from "../../models/crowdfund.model.js";
import {
  sendSuccess,
  sendInternalServerError,
} from "../../utils/apiResponse.js";

/**
 * GET /api/admin/overview
 *
 * Get comprehensive admin dashboard overview metrics
 */
export const getAdminOverview = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Calculate metrics with changes
    const [
      totalUsersResult,
      organizationsResult,
      projectsResult,
      hackathonsResult,
      chartData,
    ] = await Promise.all([
      // Total active users this month with change calculation
      Promise.all([
        User.countDocuments({
          createdAt: { $gte: thirtyDaysAgo },
          emailVerified: true,
        }),
        User.countDocuments({
          createdAt: {
            $gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
            $lt: thirtyDaysAgo,
          },
          emailVerified: true,
        }),
      ]),

      // Organizations count with change
      Promise.all([
        Organization.countDocuments({ archived: { $ne: true } }),
        Organization.countDocuments({
          createdAt: {
            $gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
            $lt: thirtyDaysAgo,
          },
          archived: { $ne: true },
        }),
      ]),

      // Active projects count with change
      Promise.all([
        Project.countDocuments({
          status: { $in: ["live", "campaigning", "validated"] },
        }),
        Project.countDocuments({
          status: { $in: ["live", "campaigning", "validated"] },
          createdAt: {
            $gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
            $lt: thirtyDaysAgo,
          },
        }),
      ]),

      // Comprehensive hackathon metrics
      getHackathonMetrics(thirtyDaysAgo),

      // Chart data for last 90 days
      generateChartData(ninetyDaysAgo),
    ]);

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    const [currentUsers, previousUsers] = totalUsersResult;
    const [currentOrgs, previousOrgs] = organizationsResult;
    const [currentProjects, previousProjects] = projectsResult;
    const hackathonMetrics = hackathonsResult;

    const usersChange = calculateChange(currentUsers, previousUsers);
    const orgsChange = calculateChange(currentOrgs, previousOrgs);
    const projectsChange = calculateChange(currentProjects, previousProjects);

    const response = {
      metrics: {
        totalUsers: {
          value: currentUsers,
          change: usersChange,
          changeType: usersChange >= 0 ? "positive" : ("negative" as const),
          label: "Active users this month",
        },
        organizations: {
          value: currentOrgs,
          change: orgsChange,
          changeType: orgsChange >= 0 ? "positive" : ("negative" as const),
          label: "Registered organizations",
        },
        projects: {
          value: currentProjects,
          change: projectsChange,
          changeType: projectsChange >= 0 ? "positive" : ("negative" as const),
          label: "Active projects",
        },
        hackathons: {
          value: hackathonMetrics.totalHackathons,
          change: hackathonMetrics.hackathonsChange,
          changeType:
            hackathonMetrics.hackathonsChange >= 0
              ? "positive"
              : ("negative" as const),
          label: "Total hackathons",
          additionalInfo: `${hackathonMetrics.activeHackathons} active • ${hackathonMetrics.allTimeParticipants} total participants`,
        },
      },
      chart: {
        data: chartData,
        timeRange: "90d",
      },
      lastUpdated: now.toISOString(),
    };

    sendSuccess(res, response, "Admin overview retrieved successfully");
  } catch (error) {
    console.error("Admin overview error:", error);
    sendInternalServerError(res, "Failed to retrieve admin overview");
  }
};

/**
 * Generate chart data for crowdfunding and hackathons over the last 90 days
 */
async function generateChartData(startDate: Date): Promise<
  Array<{
    date: string;
    crowdfunding: number;
    hackathons: number;
  }>
> {
  const endDate = new Date();

  // Generate date range
  const dates: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Get crowdfunding data (validated crowdfunds)
  const crowdfundingData = await Crowdfund.aggregate([
    {
      $match: {
        status: "validated",
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Get hackathon data (published/active)
  const hackathonData = await Hackathon.aggregate([
    {
      $match: {
        status: { $in: ["published", "active"] },
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Convert to maps for easy lookup
  const crowdfundingMap = new Map(
    crowdfundingData.map((item) => [item._id, item.count]),
  );
  const hackathonMap = new Map(
    hackathonData.map((item) => [item._id, item.count]),
  );

  // Generate chart data
  return dates.map((date) => ({
    date,
    crowdfunding: crowdfundingMap.get(date) || 0,
    hackathons: hackathonMap.get(date) || 0,
  }));
}

/**
 * Get comprehensive hackathon metrics
 */
async function getHackathonMetrics(thirtyDaysAgo: Date) {
  const [
    totalHackathonsResult,
    activeHackathons,
    allTimeParticipants,
    activeParticipants,
    escrowMetrics,
  ] = await Promise.all([
    // Total hackathons with change calculation
    Promise.all([
      Hackathon.countDocuments(),
      Hackathon.countDocuments({
        createdAt: {
          $gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
          $lt: thirtyDaysAgo,
        },
      }),
    ]),

    // Active hackathons (ongoing)
    Hackathon.countDocuments({
      status: { $in: ["active", "published"] },
    }),

    // All time participants (unique users who participated in any hackathon)
    // This requires querying hackathon participants collection
    getAllTimeParticipants(),

    // Active participants (currently participating)
    getActiveParticipants(),

    // Escrow and revenue metrics
    getEscrowMetrics(),
  ]);

  const [currentTotal, previousTotal] = totalHackathonsResult;
  const hackathonsChange = calculateChange(currentTotal, previousTotal);

  return {
    totalHackathons: currentTotal,
    hackathonsChange,
    activeHackathons,
    allTimeParticipants,
    activeParticipants,
    ...escrowMetrics,
  };
}

/**
 * Calculate percentage change between current and previous values
 */
function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

/**
 * Get total unique participants across all hackathons
 */
async function getAllTimeParticipants(): Promise<number> {
  try {
    const HackathonParticipant = (
      await import("../../models/hackathon-participant.model.js")
    ).default;

    // Count unique users who have participated in any hackathon
    const uniqueParticipants = await HackathonParticipant.distinct("userId", {
      status: { $in: ["registered", "confirmed", "completed"] },
    });

    return uniqueParticipants.length;
  } catch (error) {
    console.warn("Could not fetch all-time participants:", error);
    return 0;
  }
}

/**
 * Get currently active participants
 */
async function getActiveParticipants(): Promise<number> {
  try {
    const HackathonParticipant = (
      await import("../../models/hackathon-participant.model.js")
    ).default;

    // Count participants in active/ongoing hackathons
    const activeHackathonIds = await Hackathon.find({
      status: { $in: ["active", "published"] },
    }).distinct("_id");

    const activeParticipants = await HackathonParticipant.distinct("userId", {
      hackathonId: { $in: activeHackathonIds },
      status: { $in: ["registered", "confirmed"] },
    });

    return activeParticipants.length;
  } catch (error) {
    console.warn("Could not fetch active participants:", error);
    return 0;
  }
}

/**
 * Get escrow and revenue metrics for hackathons
 */
async function getEscrowMetrics(): Promise<{
  totalLockedEscrow: number;
  totalReleasedEscrow: number;
  totalRevenue: number;
}> {
  try {
    // Get all hackathon-related transactions
    const hackathonTransactions = await Transaction.aggregate([
      {
        $match: {
          type: { $in: ["FUNDING", "MILESTONE_RELEASE"] },
          status: "CONFIRMED",
        },
      },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const fundingTx = hackathonTransactions.find((tx) => tx._id === "FUNDING");
    const releaseTx = hackathonTransactions.find(
      (tx) => tx._id === "MILESTONE_RELEASE",
    );

    const totalLockedEscrow = fundingTx?.totalAmount || 0;
    const totalReleasedEscrow = releaseTx?.totalAmount || 0;
    const totalRevenue = totalLockedEscrow * 0.05; // Assuming 5% platform fee

    return {
      totalLockedEscrow,
      totalReleasedEscrow,
      totalRevenue,
    };
  } catch (error) {
    console.warn("Could not fetch escrow metrics:", error);
    return {
      totalLockedEscrow: 0,
      totalReleasedEscrow: 0,
      totalRevenue: 0,
    };
  }
}
