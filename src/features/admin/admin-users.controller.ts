import { Request, Response } from "express";
import User, { IUser, UserStatus, UserRole } from "../../models/user.model.js";
import {
  sendSuccess,
  sendInternalServerError,
  sendBadRequest,
} from "../../utils/apiResponse.js";
import { getRolePermissions, adminRoles } from "../../lib/admin-permissions.js";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

/**
 * GET /api/admin/users
 *
 * Get paginated list of users for admin dashboard with sessions and permissions
 */
export const getAdminUsers = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search = "", status, role } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build query filters
    const query: any = {
      deleted: { $ne: true }, // Exclude deleted users
    };

    // Add search filter (search by name, email, or username)
    if (search && typeof search === "string") {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { "profile.firstName": { $regex: search, $options: "i" } },
        { "profile.lastName": { $regex: search, $options: "i" } },
        { "profile.username": { $regex: search, $options: "i" } },
      ];
    }

    // Add status filter
    if (status && Object.values(UserStatus).includes(status as UserStatus)) {
      query.status = status;
    }

    // Add role filter - check if user has the specified role in their roles array
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      query["roles.role"] = role;
      query["roles.status"] = "ACTIVE"; // Only active roles
    }

    // Get total count for pagination
    const total = await User.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    // Get users with pagination
    const users = await User.find(query)
      .select(
        "_id email profile status roles createdAt lastLogin emailVerified",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get session information for each user (from Better Auth regular sessions)
    const mongoUri = process.env.MONGODB_URI;
    let userSessions: any[] = [];

    if (mongoUri) {
      const client = new MongoClient(mongoUri);
      try {
        await client.connect();
        const db = client.db();

        // Get sessions for these users
        const userIds = users.map((u) => u._id.toString());
        userSessions = await db
          .collection("sessions")
          .find({ userId: { $in: userIds } })
          .sort({ createdAt: -1 })
          .toArray();
      } catch (error) {
        console.warn("Could not fetch user sessions:", error);
      } finally {
        await client.close();
      }
    }

    // Transform users to match expected format with sessions and permissions
    const transformedUsers = await Promise.all(
      users.map(async (user) => {
        // Get user sessions
        const userSessionData = userSessions.filter(
          (s) => s.userId === user._id.toString(),
        );
        const sessions = userSessionData.map((session) => ({
          id: session._id.toString(),
          device: session.userAgent || "Unknown Device",
          ip: session.ipAddress || "Unknown IP",
          location: "Unknown", // Could be enhanced with IP geolocation
          lastActive:
            session.createdAt?.toISOString() || new Date().toISOString(),
          isActive: true, // Assume recent sessions are active
        }));

        // Get user permissions (this would be for regular users, not admins)
        // For admin users, permissions come from admin roles
        const userRole = getPrimaryRole(user.roles);
        const permissions = getUserPermissions(userRole);

        // Get activity history (simplified - could be enhanced with activity model)
        const activityHistory = await getUserActivityHistory(
          user._id.toString(),
        );

        return {
          id: user._id.toString(),
          name:
            `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
            user.profile?.username ||
            "Unknown User",
          email: user.email,
          role: userRole,
          status: mapStatusToDisplay(user.status),
          joinDate:
            (user as any).createdAt?.toISOString() || new Date().toISOString(),
          lastActive:
            (user as any).lastLogin?.toISOString() ||
            (user as any).createdAt?.toISOString() ||
            new Date().toISOString(),
          avatar:
            user.profile?.avatar ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user._id}`,
          bio: user.profile?.bio || "",
          activityHistory,
          sessions,
          permissions,
        };
      }),
    );

    const response = {
      users: transformedUsers,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };

    sendSuccess(res, response, "Users retrieved successfully");
  } catch (error) {
    console.error("Admin users retrieval error:", error);
    sendInternalServerError(res, "Failed to retrieve users");
  }
};

/**
 * GET /api/admin/users/:id
 *
 * Get detailed user information by ID with sessions and permissions
 */
export const getAdminUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendBadRequest(res, "User ID is required");
    }

    const user = await User.findOne({
      _id: id,
      deleted: { $ne: true },
    })
      .select({
        _id: 1,
        email: 1,
        "profile.firstName": 1,
        "profile.lastName": 1,
        "profile.username": 1,
        "profile.avatar": 1,
        "profile.bio": 1,
        "profile.location": 1,
        "profile.website": 1,
        "profile.socialLinks": 1,
        status: 1,
        roles: 1,
        stats: 1,
        badges: 1,
        settings: 1,
        createdAt: 1,
        lastLogin: 1,
        emailVerified: 1,
      })
      .lean();

    if (!user) {
      return sendBadRequest(res, "User not found");
    }

    // Get user sessions from Better Auth
    const mongoUri = process.env.MONGODB_URI;
    let sessions: any[] = [];

    if (mongoUri) {
      const client = new MongoClient(mongoUri);
      try {
        await client.connect();
        const db = client.db();

        const userSessions = await db
          .collection("sessions")
          .find({ userId: id })
          .sort({ createdAt: -1 })
          .limit(10) // Limit to recent sessions
          .toArray();

        sessions = userSessions.map((session) => ({
          id: session._id.toString(),
          device: session.userAgent || "Unknown Device",
          ip: session.ipAddress || "Unknown IP",
          location: "Unknown", // Could be enhanced with IP geolocation
          lastActive:
            session.createdAt?.toISOString() || new Date().toISOString(),
          isActive:
            new Date(session.createdAt) >
            new Date(Date.now() - 24 * 60 * 60 * 1000), // Active if within 24 hours
        }));
      } catch (error) {
        console.warn("Could not fetch user sessions:", error);
      } finally {
        await client.close();
      }
    }

    // Get user permissions and activity history
    const userRole = getPrimaryRole(user.roles);
    const permissions = getUserPermissions(userRole);
    const activityHistory = await getUserActivityHistory(id);

    // Transform to expected format
    const transformedUser = {
      id: user._id.toString(),
      name:
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.profile?.username ||
        "Unknown User",
      email: user.email,
      role: userRole,
      status: mapStatusToDisplay(user.status),
      joinDate:
        (user as any).createdAt?.toISOString() || new Date().toISOString(),
      lastActive:
        (user as any).lastLogin?.toISOString() ||
        (user as any).createdAt?.toISOString() ||
        new Date().toISOString(),
      avatar:
        user.profile?.avatar ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user._id}`,
      bio: user.profile?.bio || "",
      location: user.profile?.location,
      website: user.profile?.website,
      socialLinks: user.profile?.socialLinks,
      stats: user.stats,
      isVerified: user.emailVerified,
      activityHistory,
      sessions,
      permissions,
    };

    sendSuccess(res, transformedUser, "User details retrieved successfully");
  } catch (error) {
    console.error("Admin user retrieval error:", error);
    sendInternalServerError(res, "Failed to retrieve user details");
  }
};

/**
 * PATCH /api/admin/users/:id/status
 *
 * Update user status (admin action)
 */
export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return sendBadRequest(res, "User ID is required");
    }

    if (!status || !Object.values(UserStatus).includes(status)) {
      return sendBadRequest(res, "Valid status is required");
    }

    const user = await User.findOneAndUpdate(
      { _id: id, deleted: { $ne: true } },
      { status },
      { new: true },
    ).select("_id email profile status");

    if (!user) {
      return sendBadRequest(res, "User not found");
    }

    const transformedUser = {
      id: user._id.toString(),
      name:
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.profile?.username ||
        "Unknown User",
      email: user.email,
      status: mapStatusToDisplay(user.status),
    };

    sendSuccess(res, transformedUser, "User status updated successfully");
  } catch (error) {
    console.error("User status update error:", error);
    sendInternalServerError(res, "Failed to update user status");
  }
};

/**
 * Helper function to get primary role from roles array
 */
function getPrimaryRole(
  roles?: Array<{ role: UserRole; status: string }>,
): string {
  if (!roles || roles.length === 0) {
    return "User";
  }

  // Priority order for roles
  const rolePriority = {
    [UserRole.ADMIN]: 1,
    [UserRole.MODERATOR]: 2,
    [UserRole.CREATOR]: 3,
    [UserRole.BACKER]: 4,
  };

  const activeRoles = roles.filter((r) => r.status === "ACTIVE");
  if (activeRoles.length === 0) {
    return "User";
  }

  // Sort by priority and return highest priority role
  activeRoles.sort(
    (a, b) => (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99),
  );
  return (
    activeRoles[0].role.charAt(0).toUpperCase() +
    activeRoles[0].role.slice(1).toLowerCase()
  );
}

/**
 * Helper function to map status enum to display format
 */
function mapStatusToDisplay(status: UserStatus): string {
  switch (status) {
    case UserStatus.ACTIVE:
      return "Active";
    case UserStatus.SUSPENDED:
      return "Suspended";
    case UserStatus.BANNED:
      return "Banned";
    default:
      return "Unknown";
  }
}

/**
 * Get user permissions based on their role
 */
function getUserPermissions(role: string): Record<string, string[]> {
  // This is for regular users, not admin users
  // Admin permissions are handled separately in the admin system
  const roleKey = role.toLowerCase() as keyof typeof adminRoles;

  // If it's an admin role, return admin permissions
  if (["super admin", "admin", "moderator"].includes(role.toLowerCase())) {
    return getRolePermissions(roleKey) || {};
  }

  // For regular users, return basic user permissions
  return {
    profile: ["read", "update"],
    projects: ["create", "read", "update"],
    comments: ["create", "read", "update"],
    // Add more as needed
  };
}

/**
 * Get user activity history (simplified version)
 */
async function getUserActivityHistory(userId: string): Promise<
  Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>
> {
  try {
    // Import Activity model
    const Activity = (await import("../../models/activity.model.js")).default;

    const activities = await Activity.find({ "userId.type": userId })
      .sort({ createdAt: -1 })
      .limit(5) // Get last 5 activities
      .select("type details createdAt")
      .lean();

    return activities.map((activity) => ({
      id: (activity as any)._id.toString(),
      type: activity.type,
      description: generateActivityDescription(activity.type, activity.details),
      timestamp:
        (activity as any).createdAt?.toISOString() || new Date().toISOString(),
    }));
  } catch (error) {
    console.warn("Could not fetch user activity history:", error);
    return [];
  }
}

/**
 * Generate human-readable description from activity type and details
 */
function generateActivityDescription(type: string, details?: any): string {
  switch (type) {
    case "LOGIN":
      return "Logged into account";
    case "LOGOUT":
      return "Logged out of account";
    case "PASSWORD_CHANGED":
      return "Changed password";
    case "PROJECT_CREATED":
      return "Created a new project";
    case "PROJECT_UPDATED":
      return "Updated project details";
    case "PROJECT_FUNDED":
      return `Received funding ${details?.amount ? `of $${details.amount}` : ""}`;
    case "PROJECT_VOTED":
      return "Voted on a project";
    case "CONTRIBUTION_MADE":
      return `Made a contribution ${details?.amount ? `of $${details.amount}` : ""}`;
    case "REFUND_RECEIVED":
      return `Received a refund ${details?.amount ? `of $${details.amount}` : ""}`;
    case "PROFILE_UPDATED":
      return "Updated profile information";
    case "AVATAR_CHANGED":
      return "Changed profile avatar";
    case "TEAM_JOINED":
      return "Joined a team";
    case "TEAM_LEFT":
      return "Left a team";
    case "MILESTONE_CREATED":
      return "Created a milestone";
    case "MILESTONE_COMPLETED":
      return "Completed a milestone";
    case "MILESTONE_FUNDS_RELEASED":
      return `Milestone funds released ${details?.amount ? `of $${details.amount}` : ""}`;
    case "COMMENT_POSTED":
      return "Posted a comment";
    case "COMMENT_LIKED":
      return "Liked a comment";
    case "COMMENT_DISLIKED":
      return "Disliked a comment";
    case "USER_FOLLOWED":
      return "Followed a user";
    case "USER_UNFOLLOWED":
      return "Unfollowed a user";
    case "ORGANIZATION_JOINED":
      return "Joined an organization";
    case "ORGANIZATION_LEFT":
      return "Left an organization";
    default:
      return `${type.replace(/_/g, " ").toLowerCase()}`;
  }
}
