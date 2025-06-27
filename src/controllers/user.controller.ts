import { Request, Response } from "express";
import User from "../models/user.model";
import { uploadToCloudinary } from "../utils/user.upload";
import { IUser } from "../models/user.model";
import mongoose from "mongoose";
import Activity from "../models/activity.model";
import {
  sendSuccess,
  sendNotFound,
  sendUnauthorized,
  sendBadRequest,
  sendInternalServerError,
  sendConflict,
  checkResource,
} from "../utils/apiResponse";
import Project from "../models/project.model";
import Notification from "../models/notification.model";
import Badge from "../models/badge.model";

// Extend the Express Request type to include our custom properties
interface AuthenticatedRequest extends Request {
  user: IUser;
  file?: Express.Multer.File;
}

// Define the SecuritySettings interface
interface SecuritySettings {
  twoFactorEnabled: boolean;
  lastPasswordChange: Date;
  loginAlerts: boolean;
}

// Extend the IUser interface to include security settings
declare module "../models/user.model" {
  interface IUser {
    setting: {
      notifications: any;
      privacy: any;
      preferences: any;
      security?: SecuritySettings;
    };
  }
}

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getUserProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const user = await User.findById(req.user._id).select(
      "-password -settings -badges -roles -status",
    );

    if (checkResource(res, !user, "User not found", 404)) {
      return;
    }

    sendSuccess(res, user, "User profile retrieved successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
export const updateUserProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const {
      firstName,
      lastName,
      username,
      bio,
      location,
      website,
      socialLinks,
    } = req.body;

    // Check if username is being updated and if it's already taken
    if (username) {
      const existingUser = await User.findOne({
        "profile.username": username,
        _id: { $ne: req.user._id },
      });
      if (existingUser) {
        sendConflict(res, "Username is already taken");
        return;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "profile.firstName": firstName,
          "profile.lastName": lastName,
          "profile.username": username,
          "profile.bio": bio,
          "profile.location": location,
          "profile.website": website,
          "profile.socialLinks": socialLinks,
        },
      },
      { new: true },
    ).select("-password");

    sendSuccess(res, updatedUser, "Profile updated successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Update user avatar
 * @route   PUT /api/users/avatar
 * @access  Private
 */
export const updateUserAvatar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    if (!req.file) {
      sendBadRequest(res, "No file uploaded");
      return;
    }

    // Upload to Cloudinary or your preferred storage
    const result = await uploadToCloudinary(req.file);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { "profile.avatar": result.secure_url } },
      { new: true },
    ).select("-password");

    sendSuccess(res, updatedUser, "Avatar updated successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Get user activity
 * @route   GET /api/users/activity
 * @access  Private
 */
export const getUserActivity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const activities = await Activity.find({ "userId.type": req.user._id })
      .sort({ createdAt: -1 }) // Sort by most recent first
      .populate({
        path: "details.projectId",
        select: "title slug", // Only include title and slug from project
      })
      .lean();

    sendSuccess(res, activities, "User activity retrieved successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Get user settings
 * @route   GET /api/users/settings
 * @access  Private
 */
export const getUserSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const user = await User.findById(req.user._id).select("settings");

    if (checkResource(res, !user, "User not found", 404)) {
      return;
    }

    if (!user) return; // TypeScript guard

    sendSuccess(res, user.settings, "User settings retrieved successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Update user settings
 * @route   PUT /api/users/settings
 * @access  Private
 */
export const updateUserSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const { notifications, privacy, preferences } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "settings.notifications": notifications,
          "settings.privacy": privacy,
          "settings.preferences": preferences,
        },
      },
      { new: true },
    ).select("settings");

    if (checkResource(res, !updatedUser, "User not found", 404)) {
      return;
    }

    sendSuccess(res, updatedUser?.settings, "Settings updated successfully");
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Update user security settings
 * @route   PUT /api/users/security
 * @access  Private
 */
export const updateUserSecurity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }

    const { currentPassword, newPassword, twoFactorEnabled, twoFactorCode } =
      req.body;
    const user = await User.findById(req.user._id);

    if (checkResource(res, !user, "User not found", 404)) {
      return;
    }

    // At this point, user is guaranteed to be non-null
    if (!user) return; // TypeScript guard

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      sendBadRequest(res, "Current password is incorrect");
      return;
    }

    // Initialize security settings if they don't exist
    if (!user.settings) {
      user.settings = {
        notifications: {
          email: true,
          push: true,
          inApp: true,
        },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: false,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "UTC",
          theme: "LIGHT",
        },
      };
    }

    // Update password if new password is provided
    if (newPassword) {
      user.password = newPassword;
    }

    await user.save();
    sendSuccess(
      res,
      { message: "Security settings updated successfully" },
      "Security settings updated successfully",
    );
  } catch (error) {
    console.error(error);
    sendInternalServerError(res, "Server Error");
  }
};

/**
 * @desc    Get dashboard overview for the authenticated user
 * @route   GET /api/users/dashboard/overview
 * @access  Private
 */
export const getDashboardOverview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      sendUnauthorized(res, "Not authorized");
      return;
    }
    const userId = req.user._id;
    // Fetch user info
    const user = await User.findById(userId).populate({
      path: "badges.badge",
      select: "name type",
    });
    if (!user) {
      sendBadRequest(res, "User not found");
      return;
    }
    // UserOverviewData
    const userOverview = {
      userId: user._id.toString(),
      name: `${user.profile.firstName} ${user.profile.lastName}`,
      email: user.email,
      avatarUrl: user.profile.avatar,
      badges: [
        ...((
          user.badges?.map((b: any) => {
            // Only use badge if populated and has a name
            if (
              b.badge &&
              typeof b.badge === "object" &&
              "name" in b.badge &&
              typeof b.badge.name === "string" &&
              [
                "CREATOR",
                "BACKER",
                "GRANT_APPLICANT",
                "GRANT_CREATOR",
                "VERIFIED",
              ].includes(b.badge.name.toUpperCase())
            ) {
              return b.badge.name.toUpperCase();
            }
            return undefined;
          }) || []
        ).filter(Boolean) as string[]),
        // Also add roles as badges
        ...user.roles.map((r: any) => r.role),
      ],
      kycVerified: !!user.isVerified,
    };
    // DashboardStats
    const stats = {
      totalContributed: user.stats.totalContributed,
      totalRaised: await Project.aggregate([
        {
          $match: { "owner.type": user._id },
        },
        {
          $group: { _id: null, total: { $sum: "$funding.raised" } },
        },
      ]).then((r) => r[0]?.total || 0),
      campaignsBacked: user.stats.projectsFunded,
      campaignsCreated: user.stats.projectsCreated,
      grantsApplied: await Project.countDocuments({
        "grant.applications.applicant": user._id,
      }),
      grantsCreated: await Project.countDocuments({
        "owner.type": user._id,
        "grant.isGrant": true,
      }),
      milestonesCompleted: await Project.aggregate([
        {
          $match: {
            $or: [
              { "owner.type": user._id },
              { "grant.applications.applicant": user._id },
            ],
          },
        },
        { $unwind: "$milestones" },
        { $match: { "milestones.status": "COMPLETED" } },
        { $count: "count" },
      ]).then((r) => r[0]?.count || 0),
    };
    // Notifications
    const notifications = await Notification.find({ "userId.type": user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const userNotifications = (notifications as any[]).map((n: any) => ({
      id: n._id.toString(),
      type: n.type,
      message: n.message,
      timestamp: n.createdAt.toISOString(),
      link: n.data?.projectId ? `/projects/${n.data.projectId}` : undefined,
    }));
    // UserCampaigns
    const campaigns = await Project.find({
      "owner.type": user._id,
      "grant.isGrant": { $ne: true },
    }).lean();
    const userCampaigns = (campaigns as any[]).map((c: any) => ({
      id: c._id.toString(),
      title: c.title,
      status: c.status,
      fundingGoal: c.funding.goal,
      raisedAmount: c.funding.raised,
      backersCount: c.funding.contributors.length,
      nextMilestoneDue:
        c.milestones
          ?.find((m: any) => m.status === "PENDING")
          ?.dueDate?.toISOString() || null,
      progressPercent: c.funding.goal
        ? Math.round((c.funding.raised / c.funding.goal) * 100)
        : 0,
    }));
    // UserBackedProjects
    const backedProjects = await Project.find({
      "funding.contributors.user": user._id,
    }).lean();
    const userBackedProjects = (backedProjects as any[]).map((p: any) => {
      const contrib = p.funding.contributors.find(
        (c: any) => c.user.toString() === user._id.toString(),
      );
      return {
        projectId: p._id.toString(),
        title: p.title,
        contributedAmount: contrib?.amount || 0,
        currentStatus: p.status,
        nextUpdate: null, // Placeholder
        refundEligible: false, // Placeholder
      };
    });
    // UserGrantApplications
    const grantApplications = await Project.find({
      "grant.applications.applicant": user._id,
      "grant.isGrant": true,
    }).lean();
    const userGrantApplications = (grantApplications as any[]).flatMap(
      (g: any) =>
        (g.grant?.applications || [])
          .filter((a: any) => a.applicant.toString() === user._id.toString())
          .map((a: any) => ({
            grantId: g._id.toString(),
            grantTitle: g.title,
            status: a.status,
            submittedAt: a.submittedAt?.toISOString() || "",
            nextAction: a.nextAction,
            escrowedAmount: a.escrowedAmount,
            milestonesCompleted: a.milestonesCompleted,
          })),
    );
    // UserCreatedGrants
    const createdGrants = await Project.find({
      "owner.type": user._id,
      "grant.isGrant": true,
    }).lean();
    const userCreatedGrants = createdGrants.map((g) => ({
      id: g._id.toString(),
      title: g.title,
      totalBudget: g.grant?.totalBudget || 0,
      totalDisbursed: g.grant?.totalDisbursed || 0,
      proposalsReceived: g.grant?.proposalsReceived || 0,
      proposalsApproved: g.grant?.proposalsApproved || 0,
      status: g.grant?.status || "OPEN",
    }));
    // SuggestedActions (static for now)
    const suggestedActions = [
      {
        id: "1",
        description: "Complete your profile",
        actionLabel: "Edit Profile",
        actionUrl: "/profile/edit",
        icon: "user",
      },
      {
        id: "2",
        description: "Start a new campaign",
        actionLabel: "Create Campaign",
        actionUrl: "/campaigns/new",
        icon: "plus",
      },
    ];
    // PlatformMetrics
    const [
      totalCampaigns,
      totalGrants,
      totalUsers,
      totalRaised,
      totalMilestonesVerified,
    ] = await Promise.all([
      Project.countDocuments({ "grant.isGrant": { $ne: true } }),
      Project.countDocuments({ "grant.isGrant": true }),
      User.countDocuments(),
      Project.aggregate([
        { $group: { _id: null, total: { $sum: "$funding.raised" } } },
      ]).then((r) => r[0]?.total || 0),
      Project.aggregate([
        { $unwind: "$milestones" },
        { $match: { "milestones.status": "COMPLETED" } },
        { $count: "count" },
      ]).then((r) => r[0]?.count || 0),
    ]);
    const platformMetrics = {
      totalCampaigns,
      totalGrants,
      totalUsers,
      totalRaised,
      totalMilestonesVerified,
    };
    // Response
    sendSuccess(
      res,
      {
        user: userOverview,
        stats,
        notifications: userNotifications,
        campaigns: userCampaigns,
        backedProjects: userBackedProjects,
        grantApplications: userGrantApplications,
        createdGrants: userCreatedGrants,
        suggestedActions,
        platformMetrics,
      },
      "Dashboard overview fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching dashboard overview:", error);
    sendInternalServerError(res, `${error}`);
  }
};
