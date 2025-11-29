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
          isVerified: true,
        }),
        User.countDocuments({
          createdAt: {
            $gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
            $lt: thirtyDaysAgo,
          },
          isVerified: true,
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

      // Ongoing hackathons with funding info
      Promise.all([
        Hackathon.countDocuments({
          status: { $in: ["active", "published"] },
        }),
        Hackathon.countDocuments({
          status: { $in: ["active", "published"] },
          createdAt: {
            $gte: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
            $lt: thirtyDaysAgo,
          },
        }),
        // Get total distributed and escrow amounts from hackathon-related transactions
        Transaction.aggregate([
          {
            $match: {
              type: { $in: ["FUNDING", "MILESTONE_RELEASE"] },
              status: "CONFIRMED",
              createdAt: { $gte: ninetyDaysAgo },
            },
          },
          {
            $group: {
              _id: null,
              totalDistributed: { $sum: "$amount" },
              totalInEscrow: {
                $sum: {
                  $cond: [{ $eq: ["$type", "FUNDING"] }, "$amount", 0],
                },
              },
            },
          },
        ]),
      ]),

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
    const [currentHackathons, previousHackathons, fundingData] =
      hackathonsResult;

    const usersChange = calculateChange(currentUsers, previousUsers);
    const orgsChange = calculateChange(currentOrgs, previousOrgs);
    const projectsChange = calculateChange(currentProjects, previousProjects);
    const hackathonsChange = calculateChange(
      currentHackathons,
      previousHackathons,
    );

    // Format funding data
    const totalDistributed = fundingData[0]?.totalDistributed || 0;
    const totalInEscrow = fundingData[0]?.totalInEscrow || 0;

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
          value: currentHackathons,
          change: hackathonsChange,
          changeType:
            hackathonsChange >= 0 ? "positive" : ("negative" as const),
          label: "Ongoing hackathons",
          additionalInfo: `$${totalDistributed.toLocaleString()} distributed • $${totalInEscrow.toLocaleString()} in escrow`,
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
