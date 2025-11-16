import express from "express";
import { protect } from "../../middleware/better-auth.middleware.js";
import User from "../../models/user.model.js";
import Project from "../../models/project.model.js";
import Organization from "../../models/organization.model.js";
import Follow from "../../models/follow.model.js";
import Activity from "../../models/activity.model.js";
import Comment from "../../models/comment.model.js";
import {
  sendSuccess,
  sendInternalServerError,
} from "../../utils/apiResponse.js";

const router = express.Router();

/**
 * Get current user profile with enriched data
 * Better Auth handles all other auth endpoints automatically at /api/auth/*
 * Returns user data with organizations, projects, following, followers, stats, activities, and contributed projects
 */
router.get("/me", protect, async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Get user with all necessary data
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch all related data in parallel for better performance
    const [
      userProjects,
      userOrganizations,
      following,
      followers,
      activities,
      contributedProjects,
      totalProjectsCreated,
      totalProjectsFunded,
      totalComments,
      totalVotes,
      totalGrants,
      totalHackathons,
      totalDonations,
    ] = await Promise.all([
      // Get user's projects
      Project.find({ "owner.type": userId })
        .select(
          "title description media tags category type funding status createdAt updatedAt owner",
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      // Get user's organizations
      Organization.find({
        $or: [{ members: user.email }, { owner: user.email }],
      })
        .select(
          "_id name logo tagline about links members owner hackathons grants isProfileComplete pendingInvites createdAt updatedAt",
        )
        .lean(),

      // Get following users
      Follow.find({ follower: userId, status: "ACTIVE" })
        .populate({
          path: "following",
          select:
            "_id email profile.firstName profile.lastName profile.username profile.avatar",
        })
        .sort({ followedAt: -1 })
        .limit(100)
        .lean(),

      // Get followers
      Follow.find({ following: userId, status: "ACTIVE" })
        .populate({
          path: "follower",
          select:
            "_id email profile.firstName profile.lastName profile.username profile.avatar",
        })
        .sort({ followedAt: -1 })
        .limit(100)
        .lean(),

      // Get user's activities
      Activity.find({ userId: userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate({
          path: "details.projectId",
          select: "title media",
        })
        .lean(),

      // Get user's contributed projects
      Project.find({
        "funding.contributors.user": userId,
      })
        .select(
          "title description media tags category type funding status createdAt updatedAt",
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      // Calculate stats
      Project.countDocuments({ "owner.type": userId }),
      Project.countDocuments({ "funding.contributors.user": userId }),
      Comment.countDocuments({ author: userId }),
      Project.aggregate([
        { $match: { "voting.voters.userId": userId } },
        { $count: "total" },
      ]).then((result) => result[0]?.total || 0),
      Project.countDocuments({ "owner.type": userId, "grant.isGrant": true }),
      Project.countDocuments({ "owner.type": userId, category: "hackathon" }),
      Project.aggregate([
        { $match: { "funding.contributors.user": userId } },
        { $unwind: "$funding.contributors" },
        { $match: { "funding.contributors.user": userId } },
        {
          $group: {
            _id: null,
            total: { $sum: "$funding.contributors.amount" },
          },
        },
      ]).then((result) => result[0]?.total || 0),
    ]);

    // Format projects according to Project interface
    const formattedProjects = userProjects.map((project: any) => ({
      id: project._id.toString(),
      name: project.title,
      description: project.description || "",
      image: project.media?.banner || project.media?.logo || "",
      link: project.projectWebsite || "#",
      tags: project.tags || [],
      category: project.category || "",
      type: project.type || "",
      amount: project.funding?.goal || 0,
      status: project.status || "",
      createdAt: project.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: project.updatedAt?.toISOString() || new Date().toISOString(),
      owner: user.profile.username || null,
      ownerName: `${user.profile.firstName} ${user.profile.lastName}`,
      ownerUsername: user.profile.username,
      ownerAvatar: user.profile.avatar || "",
    }));

    // Format organizations according to Organization interface
    const formattedOrganizations = userOrganizations.map((org: any) => ({
      _id: org._id.toString(),
      name: org.name,
      logo: org.logo || "",
      tagline: org.tagline || "",
      about: org.about || "",
      links: {
        website: org.links?.website || "",
        x: org.links?.x || "",
        github: org.links?.github || "",
        others: org.links?.others || "",
      },
      members: org.members || [],
      owner: org.owner || "",
      hackathons: (org.hackathons || []).map((id: any) => id.toString()),
      grants: (org.grants || []).map((id: any) => id.toString()),
      isProfileComplete: org.isProfileComplete || false,
      pendingInvites: org.pendingInvites || [],
      createdAt: org.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: org.updatedAt?.toISOString() || new Date().toISOString(),
    }));

    // Format following users according to User interface
    const formattedFollowing = following
      .filter((follow: any) => follow.following)
      .map((follow: any) => {
        const followedUser = follow.following as any;
        return {
          _id: followedUser._id.toString(),
          email: followedUser.email,
          profile: {
            firstName: followedUser.profile?.firstName || "",
            lastName: followedUser.profile?.lastName || "",
            username: followedUser.profile?.username || "",
            avatar: followedUser.profile?.avatar || "",
          },
          isVerified: followedUser.isVerified || false,
          roles: followedUser.roles?.map((r: any) => r.role) || [],
        };
      });

    // Format followers according to User interface
    const formattedFollowers = followers
      .filter((follow: any) => follow.follower)
      .map((follow: any) => {
        const followerUser = follow.follower as any;
        return {
          _id: followerUser._id.toString(),
          email: followerUser.email,
          profile: {
            firstName: followerUser.profile?.firstName || "",
            lastName: followerUser.profile?.lastName || "",
            username: followerUser.profile?.username || "",
            avatar: followerUser.profile?.avatar || "",
          },
          isVerified: followerUser.isVerified || false,
          roles: followerUser.roles?.map((r: any) => r.role) || [],
        };
      });

    // Format contributed projects
    const formattedContributedProjects = contributedProjects.map(
      (project: any) => ({
        id: project._id.toString(),
        name: project.title,
        description: project.description || "",
        image: project.media?.banner || project.media?.logo || "",
        link: project.projectWebsite || "#",
        tags: project.tags || [],
        category: project.category || "",
        type: project.type || "",
        amount: project.funding?.goal || 0,
        status: project.status || "",
        createdAt: project.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: project.updatedAt?.toISOString() || new Date().toISOString(),
      }),
    );

    // Format activities (keeping as unknown[] for now, can be typed later)
    const formattedActivities = activities.map((activity: any) => ({
      id: activity._id.toString(),
      type: activity.type,
      description: activity.description || "",
      timestamp: activity.createdAt?.toISOString() || new Date().toISOString(),
      ...activity,
    }));

    // Build comprehensive response matching GetMeResponse type
    const response = {
      _id: user._id.toString(),
      email: user.email,
      profile: {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        username: user.profile.username,
        avatar: user.profile.avatar || "",
      },
      isVerified: user.isVerified,
      roles: user.roles.filter((r) => r.status === "ACTIVE").map((r) => r.role),
      lastLogin: user.lastLogin?.toISOString(),
      organizations: formattedOrganizations,
      projects: formattedProjects,
      following: formattedFollowing,
      followers: formattedFollowers,
      stats: {
        votes: totalVotes,
        grants: totalGrants,
        hackathons: totalHackathons,
        donations: totalDonations,
        projectsCreated: totalProjectsCreated,
        projectsFunded: totalProjectsFunded,
        totalContributed: user.stats.totalContributed || totalDonations,
        reputation: user.stats.reputation || 0,
        communityScore: user.stats.communityScore || 0,
        commentsPosted: totalComments,
        organizations: formattedOrganizations.length,
        followers: formattedFollowers.length,
        following: formattedFollowing.length,
      },
      activities: formattedActivities,
      contributedProjects: formattedContributedProjects,
    };

    sendSuccess(res, response, "User profile retrieved successfully");
  } catch (error) {
    console.error("Get me error:", error);
    sendInternalServerError(res, "Server error");
  }
});

export default router;
