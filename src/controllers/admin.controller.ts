import type { Request, Response } from "express";
import User, { UserRole } from "../models/user.model";
import Project, { ProjectStatus } from "../models/project.model";

/**
 * @desc    Get admin dashboard overview with comprehensive statistics
 * @route   GET /api/admin/dashboard/overview
 * @access  Private (Admin only)
 */
export const getDashboardOverview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Get total counts
    const [totalProjects, totalUsers, pendingProjects] = await Promise.all([
      Project.countDocuments(),
      User.countDocuments(),
      Project.countDocuments({
        status: {
          $in: [
            ProjectStatus.AWAITING_BOUNDLESS_VERIFICATION,
            ProjectStatus.PENDING_DEPLOYMENT,
            ProjectStatus.VOTING,
          ],
        },
      }),
    ]);

    // Calculate total funding across all projects
    const fundingAggregation = await Project.aggregate([
      {
        $group: {
          _id: null,
          totalFunding: { $sum: "$funding.raised" },
        },
      },
    ]);
    const totalFunding = fundingAggregation[0]?.totalFunding || 0;

    // Get recent projects (last 10)
    const recentProjectsData = await Project.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate(
        "owner.type",
        "profile.firstName profile.lastName profile.avatar",
      )
      .lean();

    const recentProjects = recentProjectsData.map((project: any) => ({
      name: project.title,
      status: project.status,
      creatorName: `${project.owner.type?.profile?.firstName || ""} ${
        project.owner.type?.profile?.lastName || ""
      }`.trim(),
      creatorAvatar: project.owner.type?.profile?.avatar || "",
      timestamp: project.createdAt,
    }));

    // Get recent users (last 10)
    const recentUsersData = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        "profile.avatar profile.firstName profile.lastName email roles createdAt",
      )
      .lean();

    const recentUsers = recentUsersData.map((user: any) => ({
      avatar: user.profile?.avatar || "",
      name: `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim(),
      email: user.email,
      role: user.roles?.[0]?.role || UserRole.BACKER,
      timestamp: user.createdAt,
    }));

    // Get funding overview by project status
    const fundingByStatus = await Project.aggregate([
      {
        $group: {
          _id: "$status",
          totalRaised: { $sum: "$funding.raised" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: "$_id",
          value: "$totalRaised",
          count: 1,
          _id: 0,
        },
      },
    ]);

    // Get funding overview by category
    const fundingByCategory = await Project.aggregate([
      {
        $group: {
          _id: "$category",
          totalRaised: { $sum: "$funding.raised" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: "$_id",
          value: "$totalRaised",
          count: 1,
          _id: 0,
        },
      },
      {
        $sort: { value: -1 },
      },
      {
        $limit: 5, // Top 5 categories
      },
    ]);

    // Combine funding data for chart
    const chartData = [
      ...fundingByStatus.map((item) => ({
        name: `Status: ${item.name}`,
        value: item.value,
      })),
      ...fundingByCategory.map((item) => ({
        name: `Category: ${item.name}`,
        value: item.value,
      })),
    ];

    const response = {
      totalProjects,
      totalUsers,
      pendingProjects,
      totalFunding,
      recentProjects,
      recentUsers,
      fundingOverview: {
        chartData,
      },
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error fetching admin dashboard overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard overview",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * @desc    Get detailed user statistics for admin dashboard
 * @route   GET /api/admin/dashboard/users
 * @access  Private (Admin only)
 */
export const getUserStatistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Get user statistics by role
    const usersByRole = await User.aggregate([
      {
        $unwind: "$roles",
      },
      {
        $group: {
          _id: "$roles.role",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          role: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    // Get user registration trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const registrationTrends = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        usersByRole,
        registrationTrends,
      },
    });
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * @desc    Get detailed project statistics for admin dashboard
 * @route   GET /api/admin/dashboard/projects
 * @access  Private (Admin only)
 */
export const getProjectStatistics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Get project statistics by status
    const projectsByStatus = await Project.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalFunding: { $sum: "$funding.raised" },
          avgFunding: { $avg: "$funding.raised" },
        },
      },
      {
        $project: {
          status: "$_id",
          count: 1,
          totalFunding: 1,
          avgFunding: { $round: ["$avgFunding", 2] },
          _id: 0,
        },
      },
    ]);

    // Get project creation trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const creationTrends = await Project.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
          totalFunding: { $sum: "$funding.raised" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get top performing projects
    const topProjects = await Project.find()
      .sort({ "funding.raised": -1 })
      .limit(10)
      .populate("owner.type", "profile.firstName profile.lastName")
      .select("title funding.raised funding.goal status owner")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        projectsByStatus,
        creationTrends,
        topProjects,
      },
    });
  } catch (error) {
    console.error("Error fetching project statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch project statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
