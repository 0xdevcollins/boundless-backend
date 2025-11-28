import { Request, Response } from "express";
import Organization, {
  CustomPermissions,
  IOrganization,
  PermissionValue,
} from "../../models/organization.model.js";
import User from "../../models/user.model.js";
import Hackathon from "../../models/hackathon.model.js";
import Grant from "../../models/grant.model.js";
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendCreated,
  sendInternalServerError,
} from "../../utils/apiResponse.js";
import mongoose from "mongoose";
import sendMail from "../../utils/sendMail.utils.js";
import { config } from "../../config/main.config.js";
import getUserRole, { checkPermission } from "../../utils/getUserRole.js";
import { DEFAULT_PERMISSIONS } from "../../types/permission.js";
import NotificationService from "../notifications/notification.service.js";
import EmailTemplatesService from "../../services/email/email-templates.service.js";
import { NotificationType } from "../../models/notification.model.js";
import hackathonParticipantModel from "../../models/hackathon-participant.model.js";
import hackathonTeamInvitationModel from "../../models/hackathon-team-invitation.model.js";
import { auth } from "../../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { getCustomOrgFromBetterAuth } from "../../utils/organization-sync.utils.js";

const checkProfileCompletion = (org: IOrganization): boolean => {
  // Check if all required profile fields are filled
  const hasRequiredFields = !!(
    org.name &&
    org.name.trim() !== "" &&
    org.logo &&
    org.logo.trim() !== "" &&
    org.tagline &&
    org.tagline.trim() !== "" &&
    org.about &&
    org.about.trim() !== ""
  );

  // Check if at least one link is present
  const hasLinks =
    !!(org.links.website && org.links.website.trim() !== "") ||
    !!(org.links.x && org.links.x.trim() !== "") ||
    !!(org.links.github && org.links.github.trim() !== "") ||
    !!(org.links.others && org.links.others.trim() !== "");

  // Check if there is at least one member (besides the owner)
  const hasMembers =
    org.members.length > 1 ||
    (org.members.length === 1 && !org.members.includes(org.owner));

  return hasRequiredFields && hasLinks && hasMembers;
};

/**
 * Helper function to check if a user has a specific permission
 */
export const checkUserPermission = async (
  organizationId: string,
  userEmail: string,
  permissionKey: keyof CustomPermissions,
): Promise<boolean> => {
  try {
    const organization = await Organization.findById(organizationId);
    if (!organization) return false;

    // Determine user role
    let userRole: "owner" | "admin" | "member" | null = null;

    // If Better Auth org ID exists, check via Better Auth
    if (organization.betterAuthOrgId) {
      try {
        const user = await User.findOne({ email: userEmail.toLowerCase() });
        if (!user) return false;

        const members = await auth.api.listMembers({
          query: {
            organizationId: organization.betterAuthOrgId,
          },
        });

        const userMember = members.members?.find(
          (m: any) => m.user.email.toLowerCase() === userEmail.toLowerCase(),
        );

        if (!userMember) return false;

        // Map Better Auth roles to our roles
        if (userMember.role === "owner") userRole = "owner";
        else if (userMember.role === "admin") userRole = "admin";
        else userRole = "member";
      } catch (error) {
        console.error("Error checking Better Auth membership:", error);
        // Fallback to custom org check
        if (organization.owner === userEmail) userRole = "owner";
        else if (organization.admins?.includes(userEmail)) userRole = "admin";
        else if (organization.members.includes(userEmail)) userRole = "member";
      }
    } else {
      // Fallback to custom org check
      if (organization.owner === userEmail) userRole = "owner";
      else if (organization.admins?.includes(userEmail)) userRole = "admin";
      else if (organization.members.includes(userEmail)) userRole = "member";
    }

    if (!userRole) return false;

    // Get permissions
    const permissions = organization.customPermissions || DEFAULT_PERMISSIONS;
    const permission = permissions[permissionKey];

    if (!permission) return false;

    // Get role-specific permission
    const rolePermission = permission[userRole];

    // Handle both boolean and object with value
    return typeof rolePermission === "object"
      ? rolePermission.value
      : rolePermission;
  } catch (error) {
    console.error("Check user permission error:", error);
    return false;
  }
};

/**
 * Type guard to check if permission value is an object with note
 */
export const isPermissionWithNote = (
  value: PermissionValue,
): value is { value: boolean; note: string } => {
  return typeof value === "object" && "value" in value && "note" in value;
};
interface AuthenticatedRequest extends Request {
  user: any;
}

/**
 * @swagger
 * /api/organizations:
 *   post:
 *     summary: Create a new organization
 *     description: Creates an organization with a dummy name and sets the current user as owner
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

export const createOrganization = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { name, logo, tagline, about } = await req.body;

    if (!name || !logo || !tagline || !about) {
      sendError(
        res,
        "All fields (name, logo, timeline, about) are required",
        400,
      );
      return;
    }

    // Check if an organization with this name already exists (case-insensitive)
    const trimmedName = name.trim();
    const existingOrganization = await Organization.findOne({
      name: {
        $regex: new RegExp(
          `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i",
        ),
      },
    });
    if (existingOrganization) {
      sendBadRequest(
        res,
        `An organization with the name "${trimmedName}" already exists. Please choose a different name.`,
      );
      return;
    }

    // Generate slug from name
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Create Better Auth organization
    let betterAuthOrg;
    try {
      betterAuthOrg = await auth.api.createOrganization({
        body: {
          name: name.trim(),
          slug,
        },
        headers: fromNodeHeaders(req.headers),
      });

      if (!betterAuthOrg || !betterAuthOrg.id) {
        throw new Error("Failed to create Better Auth organization");
      }
    } catch (error: any) {
      console.error("Error creating Better Auth organization:", error);
      sendInternalServerError(
        res,
        "Failed to create organization",
        error instanceof Error ? error.message : "Unknown error",
      );
      return;
    }

    // Wait a bit for the hook to create custom org, then update it
    // The hook creates a basic custom org, we need to update it with additional fields
    let organization = await getCustomOrgFromBetterAuth(betterAuthOrg.id);

    if (!organization) {
      // Check if an org with this name exists but isn't linked to Better Auth yet
      const existingOrg = await Organization.findOne({
        name: {
          $regex: new RegExp(
            `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i",
          ),
        },
      });

      if (existingOrg) {
        // Link existing org to Better Auth and update it using findOneAndUpdate to avoid validation issues
        organization = await Organization.findOneAndUpdate(
          { _id: existingOrg._id },
          {
            $set: {
              betterAuthOrgId: betterAuthOrg.id,
              logo,
              tagline,
              about,
              // Ensure owner and members are set if missing
              ...(existingOrg.owner ? {} : { owner: user.email }),
              ...(existingOrg.members?.length ? {} : { members: [user.email] }),
            },
          },
          { new: true },
        );
      } else {
        // Create new custom org
        organization = await Organization.create({
          name: name.trim(),
          logo,
          tagline,
          about,
          links: {
            website: "",
            x: "",
            github: "",
            others: "",
          },
          owner: user.email,
          members: [user.email],
          betterAuthOrgId: betterAuthOrg.id,
        });
      }
    } else {
      // Update existing custom org with additional fields using findOneAndUpdate
      const orgId = organization._id;
      const hasOwner = !!organization.owner;
      const hasMembers = !!organization.members?.length;
      organization = await Organization.findOneAndUpdate(
        { _id: orgId },
        {
          $set: {
            logo,
            tagline,
            about,
            // Ensure owner and members are set if missing
            ...(hasOwner ? {} : { owner: user.email }),
            ...(hasMembers ? {} : { members: [user.email] }),
          },
        },
        { new: true },
      );
    }

    // Ensure organization was created/updated successfully
    if (!organization) {
      sendInternalServerError(res, "Failed to create organization record");
      return;
    }

    // Send notification to the creator
    try {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const ownerName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;

      await NotificationService.sendSingleNotification(
        {
          userId: user._id,
          email: user.email,
          name: ownerName,
          preferences: user.settings?.notifications,
        },
        {
          type: NotificationType.ORGANIZATION_CREATED,
          title: `Organization "${organization.name}" created`,
          message: `Your organization ${organization.name} has been successfully created.`,
          data: {
            organizationId: organization._id,
            organizationName: organization.name,
          },
          emailTemplate: EmailTemplatesService.getTemplate(
            "organization-created",
            {
              organizationId: organization._id.toString(),
              organizationName: organization.name,
              unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(user.email)}`,
            },
          ),
        },
      );
    } catch (notificationError) {
      console.error(
        "Error sending organization created notification:",
        notificationError,
      );
      // Don't fail the whole operation if notification fails
    }

    sendCreated(res, organization, "Organization created successfully");
  } catch (error: any) {
    console.error("Create organization error:", error);

    // Handle duplicate key error specifically
    if (error.code === 11000 && error.keyPattern?.name) {
      sendBadRequest(
        res,
        `An organization with the name "${error.keyValue?.name || "this name"}" already exists. Please choose a different name.`,
      );
      return;
    }

    sendInternalServerError(
      res,
      "Failed to create organization",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

// Helper function to calculate trend data
const calculateTrend = (
  current: number,
  previous: number,
): {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
  isPositive: boolean;
} => {
  const change = current - previous;
  const changePercentage =
    previous > 0 ? (change / previous) * 100 : current > 0 ? 100 : 0;
  const isPositive = change > 0;

  return {
    current,
    previous,
    change,
    changePercentage: Math.round(changePercentage * 10) / 10, // Round to 1 decimal
    isPositive,
  };
};

// Helper function to get monthly time series data
const getMonthlyTimeSeries = async (
  organizationId: string,
  model: mongoose.Model<any>,
  organizationIdField: string,
  months: number = 12,
): Promise<
  Array<{
    month: string;
    year: number;
    count: number;
    timestamp: string;
  }>
> => {
  const now = new Date();
  const timeSeries: Array<{
    month: string;
    year: number;
    count: number;
    timestamp: string;
  }> = [];

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Get data for the last N months
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const count = await model.countDocuments({
      [organizationIdField]: new mongoose.Types.ObjectId(organizationId),
      createdAt: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    });

    timeSeries.push({
      month: monthNames[date.getMonth()],
      year: date.getFullYear(),
      count,
      timestamp: startOfMonth.toISOString(),
    });
  }

  return timeSeries;
};

// Helper function to calculate organization analytics
const calculateOrganizationAnalytics = async (
  organizationId: string,
  organization: IOrganization,
): Promise<{
  trends: {
    members: {
      current: number;
      previous: number;
      change: number;
      changePercentage: number;
      isPositive: boolean;
    };
    hackathons: {
      current: number;
      previous: number;
      change: number;
      changePercentage: number;
      isPositive: boolean;
    };
    grants: {
      current: number;
      previous: number;
      change: number;
      changePercentage: number;
      isPositive: boolean;
    };
  };
  timeSeries: {
    hackathons: Array<{
      month: string;
      year: number;
      count: number;
      timestamp: string;
    }>;
  };
}> => {
  const now = new Date();
  const periodDays = 30; // Compare last 30 days vs previous 30 days

  // Current period (last 30 days)
  const currentPeriodStart = new Date(now);
  currentPeriodStart.setDate(currentPeriodStart.getDate() - periodDays);
  const currentPeriodEnd = now;

  // Previous period (30 days before current period)
  const previousPeriodStart = new Date(currentPeriodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);
  const previousPeriodEnd = new Date(currentPeriodStart);

  const orgObjectId = new mongoose.Types.ObjectId(organizationId);

  // Calculate trends for members
  // Note: Since members are stored as an array without join dates,
  // we use the current count. For accurate trends, member join tracking would be needed.
  const currentMembers = organization.members.length;
  const previousMembers = currentMembers; // Simplified: would need join date tracking for accuracy

  // Get organization user IDs for grant queries (run in parallel with hackathon queries)
  const orgMemberEmails = [organization.owner, ...organization.members];
  const [orgUsers, currentHackathons, previousHackathons] = await Promise.all([
    User.find({ email: { $in: orgMemberEmails } })
      .select("_id")
      .lean(),
    Hackathon.countDocuments({
      organizationId: orgObjectId,
      createdAt: { $gte: currentPeriodStart, $lte: currentPeriodEnd },
    }),
    Hackathon.countDocuments({
      organizationId: orgObjectId,
      createdAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
    }),
  ]);

  const orgUserIds = orgUsers.map((u) => u._id);

  // Calculate trends for grants (run in parallel)
  const [currentGrants, previousGrants, hackathonsTimeSeries] =
    await Promise.all([
      Grant.countDocuments({
        creatorId: { $in: orgUserIds },
        createdAt: { $gte: currentPeriodStart, $lte: currentPeriodEnd },
      }),
      Grant.countDocuments({
        creatorId: { $in: orgUserIds },
        createdAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
      }),
      getMonthlyTimeSeries(organizationId, Hackathon, "organizationId", 12),
    ]);

  return {
    trends: {
      members: calculateTrend(currentMembers, previousMembers),
      hackathons: calculateTrend(currentHackathons, previousHackathons),
      grants: calculateTrend(currentGrants, previousGrants),
    },
    timeSeries: {
      hackathons: hackathonsTimeSeries,
    },
  };
};

/**
 * @swagger
 * /api/organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     description: Fetch organization by ID with analytics data (only accessible by members)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization retrieved successfully with analytics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not a member
 *       404:
 *         description: Organization not found
 */
export const getOrganizationById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Check if user is a member (via Better Auth if available)
    let isMember = false;
    if (organization.betterAuthOrgId) {
      try {
        const membersResponse = await auth.api.listMembers({
          query: {
            organizationId: organization.betterAuthOrgId,
          },
          headers: fromNodeHeaders(req.headers),
        });
        const membersList = (membersResponse as any).members || [];
        isMember = membersList.some(
          (m: any) => m.user.email.toLowerCase() === user.email.toLowerCase(),
        );
      } catch (error) {
        console.error("Error checking Better Auth membership:", error);
        // Fallback to custom org check
        isMember =
          organization.members.includes(user.email) ||
          organization.owner === user.email;
      }
    } else {
      // Fallback to custom org check
      isMember =
        organization.members.includes(user.email) ||
        organization.owner === user.email;
    }

    if (!isMember) {
      sendForbidden(
        res,
        "Access denied. You must be a member to view this organization.",
      );
      return;
    }

    // Calculate analytics data
    const analytics = await calculateOrganizationAnalytics(id, organization);

    // Convert organization to plain object and add analytics
    const organizationData = organization.toObject();
    const responseData = {
      ...organizationData,
      analytics,
      memberCount: organization.members.length,
      hackathonCount: organization.hackathons.length,
      grantCount: organization.grants.length,
      createdAt: organization.createdAt.toISOString(),
    };

    sendSuccess(res, responseData, "Organization retrieved successfully");
  } catch (error) {
    console.error("Get organization error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve organization",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/profile:
 *   patch:
 *     summary: Update organization profile
 *     description: Update profile fields (name, logo, tagline, about)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               logo:
 *                 type: string
 *               tagline:
 *                 type: string
 *               about:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not a member
 *       404:
 *         description: Organization not found
 */
export const updateOrganizationProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, logo, tagline, about } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Check if user is a member (via Better Auth if available)
    let isMember = false;
    if (organization.betterAuthOrgId) {
      try {
        const membersResponse = await auth.api.listMembers({
          query: {
            organizationId: organization.betterAuthOrgId,
          },
          headers: fromNodeHeaders(req.headers),
        });
        const membersList = (membersResponse as any).members || [];
        isMember = membersList.some(
          (m: any) => m.user.email.toLowerCase() === user.email.toLowerCase(),
        );
      } catch (error) {
        console.error("Error checking Better Auth membership:", error);
        // Fallback to custom org check
        isMember =
          organization.members.includes(user.email) ||
          organization.owner === user.email;
      }
    } else {
      // Fallback to custom org check
      isMember =
        organization.members.includes(user.email) ||
        organization.owner === user.email;
    }

    if (!isMember) {
      sendForbidden(
        res,
        "Access denied. You must be a member to update this organization.",
      );
      return;
    }

    // Update Better Auth organization if name changed
    if (
      organization.betterAuthOrgId &&
      name !== undefined &&
      name !== organization.name
    ) {
      try {
        // Generate slug from new name
        const slug = name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        await auth.api.updateOrganization({
          body: {
            data: {
              name: name.trim(),
              slug,
            },
          },
          headers: fromNodeHeaders(req.headers),
        });
      } catch (error) {
        console.error("Error updating Better Auth organization:", error);
        // Continue with custom org update even if Better Auth update fails
      }
    }

    // Update profile fields in custom org
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (logo !== undefined) updateData.logo = logo;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (about !== undefined) updateData.about = about;

    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    );

    // Check profile completion and update if needed
    const isComplete = checkProfileCompletion(updatedOrganization!);
    if (updatedOrganization!.isProfileComplete !== isComplete) {
      await Organization.findByIdAndUpdate(id, {
        isProfileComplete: isComplete,
      });
      updatedOrganization!.isProfileComplete = isComplete;
    }

    // Send notification to organization members about profile update
    try {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const actorName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;
      const changes = Object.keys(updateData).join(", ");

      // Notify all members (excluding the actor)
      const allMembers = [organization.owner, ...organization.members].filter(
        (email) => email !== user.email,
      );

      if (allMembers.length > 0) {
        const memberUsers = await User.find({
          email: { $in: allMembers },
        }).select(
          "email profile.firstName profile.lastName settings.notifications",
        );

        await NotificationService.notifyTeamMembers(
          memberUsers.map((member) => ({
            userId: member._id,
            email: member.email,
            name:
              `${member.profile?.firstName || ""} ${member.profile?.lastName || ""}`.trim() ||
              member.email,
          })),
          {
            type: NotificationType.ORGANIZATION_UPDATED,
            title: `${organization.name} profile updated`,
            message: `${actorName} has updated the organization profile`,
            data: {
              organizationId: new mongoose.Types.ObjectId(id),
              organizationName: organization.name,
              changes,
            },
            emailTemplate: EmailTemplatesService.getTemplate(
              "organization-updated",
              {
                organizationId: id,
                organizationName: organization.name,
                changes,
                unsubscribeUrl: undefined, // Will be set per recipient
              },
            ),
            sendEmail: false, // Only in-app for profile updates
            sendInApp: true,
          },
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending profile update notifications:",
        notificationError,
      );
      // Don't fail the whole operation if notification fails
    }

    sendSuccess(res, updatedOrganization, "Profile updated successfully");
  } catch (error) {
    console.error("Update organization profile error:", error);
    sendInternalServerError(
      res,
      "Failed to update profile",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/links:
 *   patch:
 *     summary: Update organization links
 *     description: Update org links (website, x, github, others)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               website:
 *                 type: string
 *               x:
 *                 type: string
 *               github:
 *                 type: string
 *               others:
 *                 type: string
 *     responses:
 *       200:
 *         description: Links updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not a member
 *       404:
 *         description: Organization not found
 */
export const updateOrganizationLinks = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { website, x, github, others } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Check if user is owner or admin (per create_edit_profile permission)
    const hasPermission = await checkUserPermission(
      id,
      user.email,
      "create_edit_profile",
    );

    if (!hasPermission) {
      sendForbidden(
        res,
        "Access denied. Only owners and admins can update organization links.",
      );
      return;
    }

    // Update links - only include fields that are not empty strings
    const updateData: any = {};
    if (website !== undefined && website.trim() !== "")
      updateData["links.website"] = website.trim();
    if (x !== undefined && x.trim() !== "") updateData["links.x"] = x.trim();
    if (github !== undefined && github.trim() !== "")
      updateData["links.github"] = github.trim();
    if (others !== undefined && others.trim() !== "")
      updateData["links.others"] = others.trim();

    // If all fields are empty, we still want to update to clear the links
    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    // Check profile completion and update if needed
    const isComplete = checkProfileCompletion(updatedOrganization!);
    if (updatedOrganization!.isProfileComplete !== isComplete) {
      await Organization.findByIdAndUpdate(id, {
        isProfileComplete: isComplete,
      });
      updatedOrganization!.isProfileComplete = isComplete;
    }

    // Send notification to organization members about links update
    try {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const actorName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;
      const changes = Object.keys(updateData).join(", ");

      // Notify all members (excluding the actor)
      const allMembers = [organization.owner, ...organization.members].filter(
        (email) => email !== user.email,
      );

      if (allMembers.length > 0) {
        const memberUsers = await User.find({
          email: { $in: allMembers },
        }).select(
          "email profile.firstName profile.lastName settings.notifications",
        );

        await NotificationService.notifyTeamMembers(
          memberUsers.map((member) => ({
            userId: member._id,
            email: member.email,
            name:
              `${member.profile?.firstName || ""} ${member.profile?.lastName || ""}`.trim() ||
              member.email,
          })),
          {
            type: NotificationType.ORGANIZATION_UPDATED,
            title: `${organization.name} links updated`,
            message: `${actorName} has updated the organization links`,
            data: {
              organizationId: new mongoose.Types.ObjectId(id),
              organizationName: organization.name,
              changes,
            },
            sendEmail: false, // Only in-app for links updates
            sendInApp: true,
          },
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending links update notifications:",
        notificationError,
      );
      // Don't fail the whole operation if notification fails
    }

    sendSuccess(res, updatedOrganization, "Links updated successfully");
  } catch (error) {
    console.error("Update organization links error:", error);
    sendInternalServerError(
      res,
      "Failed to update links",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
/**
 * @swagger
 * /api/organizations/{id}/members:
 *   patch:
 *     summary: Add or remove members
 *     description: Add or remove members (emails)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - email
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [add, remove]
 *                 description: Action to perform (add or remove)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email of the user to add or remove
 *     responses:
 *       200:
 *         description: Members updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not a member
 *       404:
 *         description: Organization not found
 */
export const updateOrganizationMembers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, email } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!action || !email) {
      sendBadRequest(res, "Action and email are required");
      return;
    }

    if (!["add", "remove"].includes(action)) {
      sendBadRequest(res, "Action must be 'add' or 'remove'");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Check if user has permission to invite/remove members (owner or admin)
    const hasPermission = await checkUserPermission(
      id,
      user.email,
      "invite_remove_members",
    );

    if (!hasPermission) {
      sendForbidden(
        res,
        "Access denied. Only owners and admins can add or remove members.",
      );
      return;
    }

    let updatedMembers = [...organization.members];

    if (action === "add") {
      if (updatedMembers.includes(email)) {
        sendBadRequest(res, "User is already a member");
        return;
      }
      updatedMembers.push(email);
    } else if (action === "remove") {
      if (email === organization.owner) {
        sendBadRequest(res, "Cannot remove the owner");
        return;
      }
      updatedMembers = updatedMembers.filter((member) => member !== email);
    }

    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      { members: updatedMembers },
      { new: true, runValidators: true },
    );

    // Check profile completion and update if needed
    const isComplete = checkProfileCompletion(updatedOrganization!);
    if (updatedOrganization!.isProfileComplete !== isComplete) {
      await Organization.findByIdAndUpdate(id, {
        isProfileComplete: isComplete,
      });
      updatedOrganization!.isProfileComplete = isComplete;
    }

    // Send notifications
    try {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const actorName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;

      if (action === "add") {
        // Notify the added member
        const addedUser = await User.findOne({ email }).select(
          "email profile.firstName profile.lastName settings.notifications",
        );

        if (addedUser) {
          await NotificationService.sendSingleNotification(
            {
              userId: addedUser._id,
              email: addedUser.email,
              name:
                `${addedUser.profile?.firstName || ""} ${addedUser.profile?.lastName || ""}`.trim() ||
                addedUser.email,
              preferences: addedUser.settings?.notifications,
            },
            {
              type: NotificationType.ORGANIZATION_MEMBER_ADDED,
              title: `Added to ${organization.name}`,
              message: `You have been added as a member of "${organization.name}" by ${actorName}`,
              data: {
                organizationId: new mongoose.Types.ObjectId(id),
                organizationName: organization.name,
                memberEmail: email,
              },
              emailTemplate: EmailTemplatesService.getTemplate(
                "organization-member-added",
                {
                  organizationId: id,
                  organizationName: organization.name,
                  unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`,
                },
              ),
            },
          );
        }

        // Notify organization admins (excluding the actor)
        const allAdmins = [
          organization.owner,
          ...(organization.admins || []),
        ].filter(
          (adminEmail) => adminEmail !== user.email && adminEmail !== email,
        );

        if (allAdmins.length > 0) {
          const adminUsers = await User.find({
            email: { $in: allAdmins },
          }).select(
            "email profile.firstName profile.lastName settings.notifications",
          );

          await NotificationService.notifyTeamMembers(
            adminUsers.map((admin) => ({
              userId: admin._id,
              email: admin.email,
              name:
                `${admin.profile?.firstName || ""} ${admin.profile?.lastName || ""}`.trim() ||
                admin.email,
            })),
            {
              type: NotificationType.ORGANIZATION_MEMBER_ADDED,
              title: `New member added to ${organization.name}`,
              message: `${actorName} has added ${email} as a member of "${organization.name}"`,
              data: {
                organizationId: new mongoose.Types.ObjectId(id),
                organizationName: organization.name,
                memberEmail: email,
              },
              sendEmail: false,
              sendInApp: true,
            },
          );
        }
      } else if (action === "remove") {
        // Notify the removed member
        const removedUser = await User.findOne({ email }).select(
          "email profile.firstName profile.lastName settings.notifications",
        );

        if (removedUser) {
          await NotificationService.sendSingleNotification(
            {
              userId: removedUser._id,
              email: removedUser.email,
              name:
                `${removedUser.profile?.firstName || ""} ${removedUser.profile?.lastName || ""}`.trim() ||
                removedUser.email,
              preferences: removedUser.settings?.notifications,
            },
            {
              type: NotificationType.ORGANIZATION_MEMBER_REMOVED,
              title: `Removed from ${organization.name}`,
              message: `You have been removed as a member of "${organization.name}" by ${actorName}`,
              data: {
                organizationId: new mongoose.Types.ObjectId(id),
                organizationName: organization.name,
                memberEmail: email,
              },
              emailTemplate: EmailTemplatesService.getTemplate(
                "organization-member-removed",
                {
                  organizationId: id,
                  organizationName: organization.name,
                  unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`,
                },
              ),
            },
          );
        }

        // Notify organization admins (excluding the actor)
        const allAdmins = [
          organization.owner,
          ...(organization.admins || []),
        ].filter(
          (adminEmail) => adminEmail !== user.email && adminEmail !== email,
        );

        if (allAdmins.length > 0) {
          const adminUsers = await User.find({
            email: { $in: allAdmins },
          }).select(
            "email profile.firstName profile.lastName settings.notifications",
          );

          await NotificationService.notifyTeamMembers(
            adminUsers.map((admin) => ({
              userId: admin._id,
              email: admin.email,
              name:
                `${admin.profile?.firstName || ""} ${admin.profile?.lastName || ""}`.trim() ||
                admin.email,
            })),
            {
              type: NotificationType.ORGANIZATION_MEMBER_REMOVED,
              title: `Member removed from ${organization.name}`,
              message: `${actorName} has removed ${email} from "${organization.name}"`,
              data: {
                organizationId: new mongoose.Types.ObjectId(id),
                organizationName: organization.name,
                memberEmail: email,
              },
              sendEmail: false,
              sendInApp: true,
            },
          );
        }
      }
    } catch (notificationError) {
      console.error(
        "Error sending member update notifications:",
        notificationError,
      );
      // Don't fail the whole operation if notification fails
    }

    sendSuccess(res, updatedOrganization, `Member ${action}ed successfully`);
  } catch (error) {
    console.error("Update organization members error:", error);
    sendInternalServerError(
      res,
      "Failed to update members",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/transfer:
 *   patch:
 *     summary: Transfer ownership
 *     description: Transfer ownership to another user (must already be in members)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newOwnerEmail
 *             properties:
 *               newOwnerEmail:
 *                 type: string
 *                 format: email
 *                 description: Email of the new owner
 *     responses:
 *       200:
 *         description: Ownership transferred successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner can transfer ownership
 *       404:
 *         description: Organization not found
 */
export const transferOwnership = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { newOwnerEmail } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!newOwnerEmail) {
      sendBadRequest(res, "New owner email is required");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Only the owner can transfer ownership
    if (organization.owner !== user.email) {
      sendForbidden(res, "Only the owner can transfer ownership");
      return;
    }

    // Check if the new owner is already a member
    if (!organization.members.includes(newOwnerEmail)) {
      sendBadRequest(
        res,
        "New owner must already be a member of the organization",
      );
      return;
    }

    // Verify the new owner exists
    const newOwner = await User.findOne({ email: newOwnerEmail });
    if (!newOwner) {
      sendBadRequest(res, "New owner user not found");
      return;
    }

    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      { owner: newOwnerEmail },
      { new: true, runValidators: true },
    );

    sendSuccess(res, updatedOrganization, "Ownership transferred successfully");
  } catch (error) {
    console.error("Transfer ownership error:", error);
    sendInternalServerError(
      res,
      "Failed to transfer ownership",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}:
 *   delete:
 *     summary: Delete organization
 *     description: Delete organization (owner only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner can delete
 *       404:
 *         description: Organization not found
 */
/**
 * @swagger
 * /api/organizations/{id}/archive:
 *   post:
 *     summary: Archive organization
 *     description: Archive organization (soft delete) - owner and admins only
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization archived successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner and admins can archive
 *       404:
 *         description: Organization not found
 */
export const archiveOrganization = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Check if already archived
    if (organization.archived) {
      sendBadRequest(res, "Organization is already archived");
      return;
    }

    // Only owner and admins can archive
    const isOwner = organization.owner === user.email;
    const isAdmin = organization.admins?.includes(user.email) || false;

    if (!isOwner && !isAdmin) {
      sendForbidden(
        res,
        "Only the owner and admins can archive the organization",
      );
      return;
    }

    // Archive the organization
    organization.archived = true;
    organization.archivedAt = new Date();
    organization.archivedBy = user.email;
    await organization.save();

    // Send notifications to all members
    try {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const archiverName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;

      // Notify all members (including owner)
      const allMembers = [organization.owner, ...organization.members];

      const memberUsers = await User.find({
        email: { $in: allMembers },
      }).select(
        "email profile.firstName profile.lastName settings.notifications",
      );

      await NotificationService.notifyTeamMembers(
        memberUsers.map((member) => ({
          userId: member._id,
          email: member.email,
          name:
            `${member.profile?.firstName || ""} ${member.profile?.lastName || ""}`.trim() ||
            member.email,
        })),
        {
          type: NotificationType.ORGANIZATION_ARCHIVED,
          title: `${organization.name} has been archived`,
          message: `${archiverName} has archived the organization "${organization.name}"`,
          data: {
            organizationId: new mongoose.Types.ObjectId(id),
            organizationName: organization.name,
            archivedBy: user.email,
          },
          emailTemplate: EmailTemplatesService.getTemplate(
            "organization-archived",
            {
              organizationId: id,
              organizationName: organization.name,
              archivedBy: archiverName,
              unsubscribeUrl: undefined, // Will be set per recipient
            },
          ),
        },
      );
    } catch (notificationError) {
      console.error("Error sending archive notifications:", notificationError);
      // Don't fail the whole operation if notification fails
    }

    sendSuccess(res, organization, "Organization archived successfully");
  } catch (error) {
    console.error("Archive organization error:", error);
    sendInternalServerError(
      res,
      "Failed to archive organization",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/unarchive:
 *   post:
 *     summary: Unarchive organization
 *     description: Unarchive organization (restore) - owner and admins only
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization unarchived successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner and admins can unarchive
 *       404:
 *         description: Organization not found
 */
export const unarchiveOrganization = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    // Allow finding archived organizations for archive/unarchive operations
    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Check if already unarchived
    if (!organization.archived) {
      sendBadRequest(res, "Organization is not archived");
      return;
    }

    // Only owner and admins can unarchive
    const isOwner = organization.owner === user.email;
    const isAdmin = organization.admins?.includes(user.email) || false;

    if (!isOwner && !isAdmin) {
      sendForbidden(
        res,
        "Only the owner and admins can unarchive the organization",
      );
      return;
    }

    // Unarchive the organization
    organization.archived = false;
    organization.archivedAt = undefined;
    organization.archivedBy = undefined;
    await organization.save();

    // Send notifications to all members
    try {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const unarchiverName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;

      // Notify all members (including owner)
      const allMembers = [organization.owner, ...organization.members];

      const memberUsers = await User.find({
        email: { $in: allMembers },
      }).select(
        "email profile.firstName profile.lastName settings.notifications",
      );

      await NotificationService.notifyTeamMembers(
        memberUsers.map((member) => ({
          userId: member._id,
          email: member.email,
          name:
            `${member.profile?.firstName || ""} ${member.profile?.lastName || ""}`.trim() ||
            member.email,
        })),
        {
          type: NotificationType.ORGANIZATION_UNARCHIVED,
          title: `${organization.name} has been restored`,
          message: `${unarchiverName} has unarchived the organization "${organization.name}"`,
          data: {
            organizationId: new mongoose.Types.ObjectId(id),
            organizationName: organization.name,
            archivedBy: user.email,
          },
          emailTemplate: EmailTemplatesService.getTemplate(
            "organization-unarchived",
            {
              organizationId: id,
              organizationName: organization.name,
              archivedBy: unarchiverName,
              unsubscribeUrl: undefined, // Will be set per recipient
            },
          ),
        },
      );
    } catch (notificationError) {
      console.error(
        "Error sending unarchive notifications:",
        notificationError,
      );
      // Don't fail the whole operation if notification fails
    }

    sendSuccess(res, organization, "Organization unarchived successfully");
  } catch (error) {
    console.error("Unarchive organization error:", error);
    sendInternalServerError(
      res,
      "Failed to unarchive organization",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

export const deleteOrganization = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      await session.abortTransaction();
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id).session(session);

    if (!organization) {
      await session.abortTransaction();
      sendNotFound(res, "Organization not found");
      return;
    }

    // Check if user is owner (via Better Auth if available)
    let isOwner = false;
    if (organization.betterAuthOrgId) {
      try {
        const members = await auth.api.listMembers({
          query: {
            organizationId: organization.betterAuthOrgId,
          },
          headers: fromNodeHeaders(req.headers),
        });
        const userMember = members.members?.find(
          (m: any) => m.user.email.toLowerCase() === user.email.toLowerCase(),
        );
        isOwner = userMember?.role === "owner";
      } catch (error) {
        console.error("Error checking Better Auth ownership:", error);
        // Fallback to custom org check
        isOwner = organization.owner === user.email;
      }
    } else {
      // Fallback to custom org check
      isOwner = organization.owner === user.email;
    }

    if (!isOwner) {
      await session.abortTransaction();
      sendForbidden(res, "Only the owner can delete the organization");
      return;
    }

    // Delete Better Auth organization if it exists
    if (organization.betterAuthOrgId) {
      try {
        await auth.api.deleteOrganization({
          body: {
            organizationId: organization.betterAuthOrgId,
          },
          headers: fromNodeHeaders(req.headers),
        });
      } catch (error) {
        console.error("Error deleting Better Auth organization:", error);
        // Continue with custom org deletion even if Better Auth deletion fails
      }
    }

    // Notify team members (non-blocking)
    try {
      const frontendUrl = process.env.FRONTEND_URL || "https://boundlessfi.xyz";
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const ownerName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;

      const allMembers = [organization.owner, ...organization.members];
      const memberUsers = await User.find({
        email: { $in: allMembers },
      }).select(
        "email profile.firstName profile.lastName settings.notifications",
      );

      await NotificationService.notifyTeamMembers(
        memberUsers.map((member) => ({
          userId: member._id,
          email: member.email,
          name:
            `${member.profile?.firstName || ""} ${member.profile?.lastName || ""}`.trim() ||
            member.email,
        })),
        {
          type: NotificationType.ORGANIZATION_DELETED,
          title: `${organization.name} has been deleted`,
          message: `${ownerName} has deleted the organization "${organization.name}"`,
          data: {
            organizationId: new mongoose.Types.ObjectId(id),
            organizationName: organization.name,
          },
          emailTemplate: EmailTemplatesService.getTemplate(
            "organization-deleted",
            {
              organizationId: id,
              organizationName: organization.name,
              unsubscribeUrl: undefined,
            },
          ),
        },
      );
    } catch (notificationError) {
      console.error("Error sending delete notifications:", notificationError);
    }

    // Cleanup: hackathons, participants, invitations, grants, and statistics
    const hackathonIds = await Hackathon.find({ organizationId: id })
      .select("_id")
      .session(session)
      .then((hackathons) => hackathons.map((h) => h._id));

    if (hackathonIds.length > 0) {
      await hackathonParticipantModel
        .deleteMany({
          hackathonId: { $in: hackathonIds },
        })
        .session(session);

      await hackathonTeamInvitationModel
        .deleteMany({
          hackathonId: { $in: hackathonIds },
        })
        .session(session);

      await Hackathon.deleteMany({ organizationId: id }).session(session);
    }

    await Grant.deleteMany({ organizationId: id }).session(session);

    await hackathonTeamInvitationModel
      .deleteMany({
        organizationId: id,
      })
      .session(session);

    const allMemberEmails = [
      ...new Set([organization.owner, ...organization.members]),
    ];

    await User.updateMany(
      { email: { $in: allMemberEmails } },
      {
        $inc: {
          "stats.organizations": -1,
          "stats.hackathons": -hackathonIds.length,
        },
      },
    ).session(session);

    await Organization.findByIdAndDelete(id).session(session);

    await session.commitTransaction();

    console.log(`Successfully deleted organization ${id}`);
    sendSuccess(
      res,
      {
        deletedHackathons: hackathonIds.length,
        deletedGrants: await Grant.countDocuments({ organizationId: id }),
      },
      "Organization and all associated data deleted successfully",
    );
  } catch (error) {
    await session.abortTransaction();

    console.error("Delete organization error:", error);
    sendInternalServerError(
      res,
      "Failed to delete organization and associated data",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    session.endSession();
  }
};

/**
 * @swagger
 * /api/organizations/{organizationId}/hackathons/{hackathonId}:
 *   delete:
 *     summary: Delete hackathon
 *     description: Delete hackathon and all associated data (owner and admins only)
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: hackathonId
 *         required: true
 *         schema:
 *           type: string
 *         description: Hackathon ID
 *     responses:
 *       200:
 *         description: Hackathon and all associated data deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner and admins can delete
 *       404:
 *         description: Hackathon not found
 */

/**
 * @swagger
 * /api/organizations/{id}/invite:
 *   post:
 *     summary: Send invite to user
 *     description: Send an invite to a user email (adds to pendingInvites)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email of the user to invite
 *     responses:
 *       200:
 *         description: Invite sent successfully
 *       400:
 *         description: User already invited or is a member
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not a member
 *       404:
 *         description: Organization not found
 */
export const sendInvite = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { emails } = req.body as { emails: string[] };
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      sendBadRequest(res, "'emails' must be a non-empty array of emails");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Get Better Auth organization ID
    const betterAuthOrgId = organization.betterAuthOrgId;
    if (!betterAuthOrgId) {
      sendBadRequest(
        res,
        "Organization is not linked to Better Auth. Please contact support.",
      );
      return;
    }

    // Check if user is a member or owner (using Better Auth)
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session || !session.user) {
        sendForbidden(res, "Authentication required");
        return;
      }

      // Check membership via Better Auth
      const members = await auth.api.listMembers({
        query: {
          organizationId: betterAuthOrgId,
        },
        headers: fromNodeHeaders(req.headers),
      });

      const isMember = members.members?.some(
        (m: any) => m.user.email === user.email,
      );

      if (!isMember) {
        sendForbidden(
          res,
          "Access denied. You must be a member to invite others.",
        );
        return;
      }
    } catch (error) {
      console.error("Error checking membership:", error);
      sendForbidden(
        res,
        "Access denied. You must be a member to invite others.",
      );
      return;
    }

    // Normalize and dedupe emails
    const normalizedEmails = Array.from(
      new Set(
        emails
          .filter((e) => typeof e === "string")
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0),
      ),
    );

    // Check existing members and invitations via Better Auth
    const members = await auth.api.listMembers({
      query: {
        organizationId: betterAuthOrgId,
      },
      headers: fromNodeHeaders(req.headers),
    });

    const invitations = await auth.api.listInvitations({
      query: {
        organizationId: betterAuthOrgId,
      },
      headers: fromNodeHeaders(req.headers),
    });

    const existingMemberEmails = new Set(
      members.members?.map((m: any) => m.user.email.toLowerCase()) || [],
    );
    const existingInvitationEmails = new Set(
      (Array.isArray(invitations) ? invitations : []).map((inv: any) =>
        inv.email.toLowerCase(),
      ) || [],
    );

    // Filter out already members or already invited
    const alreadyMembers: string[] = [];
    const alreadyInvited: string[] = [];
    const toInvite: string[] = [];

    for (const e of normalizedEmails) {
      if (existingMemberEmails.has(e)) {
        alreadyMembers.push(e);
        continue;
      }
      if (existingInvitationEmails.has(e)) {
        alreadyInvited.push(e);
        continue;
      }
      toInvite.push(e);
    }

    // Create invitations via Better Auth (emails will be sent via callback)
    const sentToRegistered: string[] = [];
    const sentToUnregistered: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const email of toInvite) {
      try {
        const result = await auth.api.createInvitation({
          body: {
            email,
            role: "member",
            organizationId: betterAuthOrgId,
            resend: false,
          },
          headers: fromNodeHeaders(req.headers),
        });

        if (result && result.id) {
          // Check if user is registered
          const existingUser = await User.findOne({
            email: email.toLowerCase(),
          });
          if (existingUser) {
            sentToRegistered.push(email);
          } else {
            sentToUnregistered.push(email);
          }
        } else {
          failed.push({
            email,
            error: "Failed to create invitation",
          });
        }
      } catch (err: any) {
        failed.push({ email, error: err?.message || "send failed" });
      }
    }

    // Send notification to organization owner/admins about invites sent
    try {
      const inviterName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;
      const allAdmins = [
        organization.owner,
        ...(organization.admins || []),
      ].filter((email) => email !== user.email); // Don't notify the inviter

      if (allAdmins.length > 0 && toInvite.length > 0) {
        const adminUsers = await User.find({
          email: { $in: allAdmins },
        }).select(
          "email profile.firstName profile.lastName settings.notifications",
        );

        await NotificationService.notifyTeamMembers(
          adminUsers.map((admin) => ({
            userId: admin._id,
            email: admin.email,
            name:
              `${admin.profile?.firstName || ""} ${admin.profile?.lastName || ""}`.trim() ||
              admin.email,
          })),
          {
            type: NotificationType.ORGANIZATION_INVITE_SENT,
            title: `Invitations sent to ${toInvite.length} user${toInvite.length > 1 ? "s" : ""}`,
            message: `${inviterName} has invited ${toInvite.length} user${toInvite.length > 1 ? "s" : ""} to join "${organization.name}"`,
            data: {
              organizationId: new mongoose.Types.ObjectId(id),
              organizationName: organization.name,
              inviterName,
              inviteCount: toInvite.length,
            },
            sendEmail: false, // Only in-app notification for admins
            sendInApp: true,
          },
        );
      }
    } catch (notificationError) {
      console.error("Error sending admin notifications:", notificationError);
      // Don't fail the whole operation if notification fails
    }

    sendSuccess(
      res,
      {
        organization,
        summary: {
          invitedCount: toInvite.length,
          alreadyMembers,
          alreadyInvited,
          sentToRegistered,
          sentToUnregistered,
          failed,
        },
      },
      "Invites processed",
    );
  } catch (error) {
    console.error("Send invite error:", error);
    sendInternalServerError(
      res,
      "Failed to send invite",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/accept-invite:
 *   post:
 *     summary: Accept organization invite
 *     description: A user accepts an invite (removes from pendingInvites and adds to members)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Invite accepted successfully
 *       400:
 *         description: No pending invite found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Organization not found
 */
export const acceptInvite = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Get Better Auth organization ID
    const betterAuthOrgId = organization.betterAuthOrgId;
    if (!betterAuthOrgId) {
      sendBadRequest(
        res,
        "Organization is not linked to Better Auth. Please contact support.",
      );
      return;
    }

    // Find pending invitation for this user
    let invitationId: string | null = null;
    try {
      const invitations = await auth.api.listUserInvitations({
        query: {
          email: user.email,
        },
        headers: fromNodeHeaders(req.headers),
      });

      const invitationsArray = Array.isArray(invitations) ? invitations : [];
      const userInvitation = invitationsArray.find(
        (inv: any) =>
          inv.organizationId === betterAuthOrgId && inv.status === "pending",
      );

      if (!userInvitation) {
        sendBadRequest(res, "No pending invite found for this user");
        return;
      }

      invitationId = userInvitation.id;
    } catch (error) {
      console.error("Error finding invitation:", error);
      sendBadRequest(res, "No pending invite found for this user");
      return;
    }

    // Accept invitation via Better Auth (this will add user to organization)
    try {
      await auth.api.acceptInvitation({
        body: {
          invitationId: invitationId!,
        },
        headers: fromNodeHeaders(req.headers),
      });
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      sendBadRequest(res, error?.message || "Failed to accept invitation");
      return;
    }

    // Sync members to custom org (hook should handle this, but ensure it's done)
    const updatedOrganization = await Organization.findById(id);

    // Check profile completion and update if needed
    const isComplete = checkProfileCompletion(updatedOrganization!);
    if (updatedOrganization!.isProfileComplete !== isComplete) {
      await Organization.findByIdAndUpdate(id, {
        isProfileComplete: isComplete,
      });
      updatedOrganization!.isProfileComplete = isComplete;
    }

    // Send notifications
    try {
      const memberName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;

      // Notify the new member
      await NotificationService.sendSingleNotification(
        {
          userId: user._id,
          email: user.email,
          name: memberName,
          preferences: user.settings?.notifications,
        },
        {
          type: NotificationType.ORGANIZATION_INVITE_ACCEPTED,
          title: `Welcome to ${organization.name}!`,
          message: `You have successfully joined "${organization.name}"`,
          data: {
            organizationId: new mongoose.Types.ObjectId(id),
            organizationName: organization.name,
          },
          emailTemplate: EmailTemplatesService.getTemplate(
            "organization-member-added",
            {
              organizationId: id,
              organizationName: organization.name,
              unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(user.email)}`,
            },
          ),
        },
      );

      // Notify organization owner and admins
      const allAdmins = [
        organization.owner,
        ...(organization.admins || []),
      ].filter((email) => email !== user.email); // Don't notify the new member

      if (allAdmins.length > 0) {
        const adminUsers = await User.find({
          email: { $in: allAdmins },
        }).select(
          "email profile.firstName profile.lastName settings.notifications",
        );

        await NotificationService.notifyTeamMembers(
          adminUsers.map((admin) => ({
            userId: admin._id,
            email: admin.email,
            name:
              `${admin.profile?.firstName || ""} ${admin.profile?.lastName || ""}`.trim() ||
              admin.email,
          })),
          {
            type: NotificationType.ORGANIZATION_INVITE_ACCEPTED,
            title: `New member joined ${organization.name}`,
            message: `${memberName} (${user.email}) has accepted the invitation and joined "${organization.name}"`,
            data: {
              organizationId: new mongoose.Types.ObjectId(id),
              organizationName: organization.name,
              memberEmail: user.email,
              memberName,
            },
            emailTemplate: EmailTemplatesService.getTemplate(
              "organization-invite-accepted",
              {
                organizationId: id,
                organizationName: organization.name,
                memberEmail: user.email,
                memberName,
                unsubscribeUrl: undefined, // Will be set per recipient
              },
            ),
          },
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending accept invite notifications:",
        notificationError,
      );
      // Don't fail the whole operation if notification fails
    }

    sendSuccess(res, updatedOrganization, "Invite accepted successfully");
  } catch (error) {
    console.error("Accept invite error:", error);
    sendInternalServerError(
      res,
      "Failed to accept invite",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/hackathons:
 *   patch:
 *     summary: Update organization hackathons
 *     description: Append or remove hackathon IDs (owner only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - hackathonId
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [add, remove]
 *                 description: Action to perform (add or remove)
 *               hackathonId:
 *                 type: string
 *                 description: Hackathon ID to add or remove
 *     responses:
 *       200:
 *         description: Hackathons updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner can manage hackathons
 *       404:
 *         description: Organization not found
 */
export const updateOrganizationHackathons = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, hackathonId } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!action || !hackathonId) {
      sendBadRequest(res, "Action and hackathonId are required");
      return;
    }

    if (!["add", "remove"].includes(action)) {
      sendBadRequest(res, "Action must be 'add' or 'remove'");
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Only the owner can manage hackathons
    if (organization.owner !== user.email) {
      sendForbidden(res, "Only the owner can manage hackathons");
      return;
    }

    let updateOperation: any;
    if (action === "add") {
      if (
        organization.hackathons.includes(
          new mongoose.Types.ObjectId(hackathonId),
        )
      ) {
        sendBadRequest(
          res,
          "Hackathon is already associated with this organization",
        );
        return;
      }
      updateOperation = { $push: { hackathons: hackathonId } };
    } else {
      if (
        !organization.hackathons.includes(
          new mongoose.Types.ObjectId(hackathonId),
        )
      ) {
        sendBadRequest(
          res,
          "Hackathon is not associated with this organization",
        );
        return;
      }
      updateOperation = { $pull: { hackathons: hackathonId } };
    }

    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      updateOperation,
      { new: true, runValidators: true },
    );

    sendSuccess(res, updatedOrganization, `Hackathon ${action}ed successfully`);
  } catch (error) {
    console.error("Update organization hackathons error:", error);
    sendInternalServerError(
      res,
      "Failed to update hackathons",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/grants:
 *   patch:
 *     summary: Update organization grants
 *     description: Append or remove grant IDs (owner only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - grantId
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [add, remove]
 *                 description: Action to perform (add or remove)
 *               grantId:
 *                 type: string
 *                 description: Grant ID to add or remove
 *     responses:
 *       200:
 *         description: Grants updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner can manage grants
 *       404:
 *         description: Organization not found
 */
export const updateOrganizationGrants = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, grantId } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!action || !grantId) {
      sendBadRequest(res, "Action and grantId are required");
      return;
    }

    if (!["add", "remove"].includes(action)) {
      sendBadRequest(res, "Action must be 'add' or 'remove'");
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(grantId)) {
      sendBadRequest(res, "Invalid grant ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Only the owner can manage grants
    if (organization.owner !== user.email) {
      sendForbidden(res, "Only the owner can manage grants");
      return;
    }

    let updateOperation: any;
    if (action === "add") {
      if (organization.grants.includes(new mongoose.Types.ObjectId(grantId))) {
        sendBadRequest(
          res,
          "Grant is already associated with this organization",
        );
        return;
      }
      updateOperation = { $push: { grants: grantId } };
    } else {
      if (!organization.grants.includes(new mongoose.Types.ObjectId(grantId))) {
        sendBadRequest(res, "Grant is not associated with this organization");
        return;
      }
      updateOperation = { $pull: { grants: grantId } };
    }

    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      updateOperation,
      { new: true, runValidators: true },
    );

    sendSuccess(res, updatedOrganization, `Grant ${action}ed successfully`);
  } catch (error) {
    console.error("Update organization grants error:", error);
    sendInternalServerError(
      res,
      "Failed to update grants",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

//Organization role and permission
/**
 * @swagger
 * /api/organizations/{id}/roles:
 *   patch:
 *     summary: Assign or revoke admin role
 *     description: Owner can promote members to admin or demote admins to members
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - email
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [promote, demote]
 *                 description: promote to admin or demote to member
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email of the user
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner can assign roles
 *       404:
 *         description: Organization not found
 */
export const assignRole = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, email } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!action || !email) {
      sendBadRequest(res, "Action and email are required");
      return;
    }

    if (!["promote", "demote"].includes(action)) {
      sendBadRequest(res, "Action must be 'promote' or 'demote'");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Get Better Auth organization ID
    const betterAuthOrgId = organization.betterAuthOrgId;
    if (!betterAuthOrgId) {
      sendBadRequest(
        res,
        "Organization is not linked to Better Auth. Please contact support.",
      );
      return;
    }

    // Check permissions via Better Auth (only owner can assign roles)
    try {
      const activeMember = await auth.api.getActiveMember({
        headers: fromNodeHeaders(req.headers),
      });

      if (!activeMember || activeMember.role !== "owner") {
        sendForbidden(res, "Only the owner can assign roles");
        return;
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
      sendForbidden(res, "Only the owner can assign roles");
      return;
    }

    // Find member by email
    const members = await auth.api.listMembers({
      query: {
        organizationId: betterAuthOrgId,
      },
      headers: fromNodeHeaders(req.headers),
    });

    const targetMember = members.members?.find(
      (m: any) => m.user.email.toLowerCase() === email.toLowerCase(),
    );

    if (!targetMember) {
      sendBadRequest(res, "User must be a member of the organization");
      return;
    }

    // Cannot change owner's role
    if (targetMember.role === "owner") {
      sendBadRequest(res, "Cannot change owner's role");
      return;
    }

    let newRole: string;
    if (action === "promote") {
      // Check if already an admin
      if (targetMember.role === "admin") {
        sendBadRequest(res, "User is already an admin");
        return;
      }
      newRole = "admin";
    } else {
      // demote
      // Check if user is an admin
      if (targetMember.role !== "admin") {
        sendBadRequest(res, "User is not an admin");
        return;
      }
      newRole = "member";
    }

    // Update role via Better Auth
    await auth.api.updateMemberRole({
      body: {
        role: newRole,
        memberId: targetMember.id,
        organizationId: betterAuthOrgId,
      },
      headers: fromNodeHeaders(req.headers),
    });

    // Sync members to custom org
    const { syncMembersToCustomOrg } = await import(
      "../../utils/organization-sync.utils.js"
    );
    await syncMembersToCustomOrg(betterAuthOrgId);

    const updatedOrganization = await Organization.findById(id);

    // Send notifications for role changes
    try {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        config.cors.origin ||
        "https://boundlessfi.xyz";
      const baseUrl = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
      const actorName =
        `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() ||
        user.email;
      const targetEmail = email;
      const oldRole = action === "promote" ? "member" : "admin";
      const newRole = action === "promote" ? "admin" : "member";

      // Notify the user whose role changed
      const targetUser = await User.findOne({ email: targetEmail }).select(
        "email profile.firstName profile.lastName settings.notifications",
      );

      if (targetUser) {
        await NotificationService.sendSingleNotification(
          {
            userId: targetUser._id,
            email: targetUser.email,
            name:
              `${targetUser.profile?.firstName || ""} ${targetUser.profile?.lastName || ""}`.trim() ||
              targetUser.email,
            preferences: targetUser.settings?.notifications,
          },
          {
            type: NotificationType.ORGANIZATION_ROLE_CHANGED,
            title: `Role changed in ${organization.name}`,
            message: `${actorName} has changed your role in "${organization.name}" from ${oldRole} to ${newRole}`,
            data: {
              organizationId: new mongoose.Types.ObjectId(id),
              organizationName: organization.name,
              oldRole,
              newRole,
              memberEmail: targetEmail,
            },
            emailTemplate: EmailTemplatesService.getTemplate(
              "organization-role-changed",
              {
                organizationId: id,
                organizationName: organization.name,
                oldRole,
                newRole,
                unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(targetEmail)}`,
              },
            ),
          },
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending role change notifications:",
        notificationError,
      );
      // Don't fail the whole operation if notification fails
    }

    sendSuccess(
      res,
      {
        organization: updatedOrganization,
        role: action === "promote" ? "admin" : "member",
      },
      `User ${action}d successfully`,
    );
  } catch (error) {
    console.error("Assign role error:", error);
    sendInternalServerError(
      res,
      "Failed to assign role",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/profile:
 *   patch:
 *     summary: Update organization profile
 *     description: Owner can update all fields, Admin can only edit (not create)
 *     tags: [Organizations]
 */
export const updateOrganizationProfileWithRoles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, logo, tagline, about } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    const userRole = getUserRole(organization, user.email);

    if (!userRole) {
      sendForbidden(
        res,
        "Access denied. You must be a member to update this organization.",
      );
      return;
    }

    // Check permissions: Owner and Admin can edit (but admin can only edit existing)
    if (!checkPermission(organization, user.email, ["owner", "admin"])) {
      sendForbidden(res, "You don't have permission to edit the profile");
      return;
    }

    // Update profile fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (logo !== undefined) updateData.logo = logo;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (about !== undefined) updateData.about = about;

    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    );

    sendSuccess(res, updatedOrganization, "Profile updated successfully");
  } catch (error) {
    console.error("Update organization profile error:", error);
    sendInternalServerError(
      res,
      "Failed to update profile",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/hackathons:
 *   patch:
 *     summary: Manage hackathons
 *     description: Owner and Admin can add/remove hackathons
 */
export const updateOrganizationHackathonsWithRoles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, hackathonId } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!action || !hackathonId) {
      sendBadRequest(res, "Action and hackathonId are required");
      return;
    }

    if (!["add", "remove"].includes(action)) {
      sendBadRequest(res, "Action must be 'add' or 'remove'");
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Check permissions: Owner and Admin can manage hackathons
    if (!checkPermission(organization, user.email, ["owner", "admin"])) {
      sendForbidden(res, "Only owners and admins can manage hackathons");
      return;
    }

    let updateOperation: any;
    if (action === "add") {
      if (
        organization.hackathons.includes(
          new mongoose.Types.ObjectId(hackathonId),
        )
      ) {
        sendBadRequest(
          res,
          "Hackathon is already associated with this organization",
        );
        return;
      }
      updateOperation = { $push: { hackathons: hackathonId } };
    } else {
      if (
        !organization.hackathons.includes(
          new mongoose.Types.ObjectId(hackathonId),
        )
      ) {
        sendBadRequest(
          res,
          "Hackathon is not associated with this organization",
        );
        return;
      }
      updateOperation = { $pull: { hackathons: hackathonId } };
    }

    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      updateOperation,
      { new: true, runValidators: true },
    );

    sendSuccess(res, updatedOrganization, `Hackathon ${action}ed successfully`);
  } catch (error) {
    console.error("Update organization hackathons error:", error);
    sendInternalServerError(
      res,
      "Failed to update hackathons",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/members:
 *   patch:
 *     summary: Add or remove members
 *     description: Owner and Admin can invite/remove members
 */
export const updateOrganizationMembersWithRoles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, email } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!action || !email) {
      sendBadRequest(res, "Action and email are required");
      return;
    }

    if (!["add", "remove"].includes(action)) {
      sendBadRequest(res, "Action must be 'add' or 'remove'");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Get Better Auth organization ID
    const betterAuthOrgId = organization.betterAuthOrgId;
    if (!betterAuthOrgId) {
      sendBadRequest(
        res,
        "Organization is not linked to Better Auth. Please contact support.",
      );
      return;
    }

    // Check permissions via Better Auth
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session || !session.user) {
        sendForbidden(res, "Authentication required");
        return;
      }

      const activeMember = await auth.api.getActiveMember({
        headers: fromNodeHeaders(req.headers),
      });

      if (
        !activeMember ||
        (activeMember.role !== "owner" && activeMember.role !== "admin")
      ) {
        sendForbidden(res, "Only owners and admins can manage members");
        return;
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
      sendForbidden(res, "Only owners and admins can manage members");
      return;
    }

    if (action === "add") {
      // Find user by email
      const targetUser = await User.findOne({ email: email.toLowerCase() });
      if (!targetUser) {
        sendBadRequest(res, "User not found");
        return;
      }

      // Add member via Better Auth
      try {
        await auth.api.addMember({
          body: {
            userId: targetUser._id.toString(),
            role: "member",
            organizationId: betterAuthOrgId,
          },
          headers: fromNodeHeaders(req.headers),
        });
      } catch (error: any) {
        if (error.message?.includes("already")) {
          sendBadRequest(res, "User is already a member");
          return;
        }
        throw error;
      }
    } else if (action === "remove") {
      // Find member by email
      const members = await auth.api.listMembers({
        query: {
          organizationId: betterAuthOrgId,
        },
        headers: fromNodeHeaders(req.headers),
      });

      const targetMember = members.members?.find(
        (m: any) => m.user.email.toLowerCase() === email.toLowerCase(),
      );

      if (!targetMember) {
        sendBadRequest(res, "User is not a member");
        return;
      }

      // Check if trying to remove owner
      if (targetMember.role === "owner") {
        sendBadRequest(res, "Cannot remove the owner");
        return;
      }

      // Remove member via Better Auth
      await auth.api.removeMember({
        body: {
          memberIdOrEmail: email,
          organizationId: betterAuthOrgId,
        },
        headers: fromNodeHeaders(req.headers),
      });
    }

    // Sync members to custom org
    const { syncMembersToCustomOrg } = await import(
      "../../utils/organization-sync.utils.js"
    );
    await syncMembersToCustomOrg(betterAuthOrgId);

    const updatedOrganization = await Organization.findById(id);

    sendSuccess(res, updatedOrganization, `Member ${action}ed successfully`);
  } catch (error) {
    console.error("Update organization members error:", error);
    sendInternalServerError(
      res,
      "Failed to update members",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/role:
 *   get:
 *     summary: Get user's role in organization
 *     description: Returns the role of the authenticated user
 */
export const getUserRoleInOrganization = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Get Better Auth organization ID
    const betterAuthOrgId = organization.betterAuthOrgId;
    if (!betterAuthOrgId) {
      // Fallback to custom org check for backward compatibility
      const role = getUserRole(organization, user.email);
      if (!role) {
        sendForbidden(res, "You are not a member of this organization");
        return;
      }
      // Return role from custom org
      const permissions = {
        owner: {
          canEditProfile: true,
          canCreateProfile: true,
          canManageHackathons: true,
          canPublishHackathons: true,
          canViewAnalytics: true,
          canInviteMembers: true,
          canRemoveMembers: true,
          canAssignRoles: true,
          canPostAnnouncements: true,
          canComment: true,
          canAccessSubmissions: true,
          canDeleteOrganization: true,
        },
        admin: {
          canEditProfile: true,
          canCreateProfile: false,
          canManageHackathons: true,
          canPublishHackathons: false,
          canViewAnalytics: true,
          canInviteMembers: true,
          canRemoveMembers: true,
          canAssignRoles: false,
          canPostAnnouncements: false,
          canComment: true,
          canAccessSubmissions: true,
          canDeleteOrganization: false,
        },
        member: {
          canEditProfile: false,
          canCreateProfile: false,
          canManageHackathons: false,
          canPublishHackathons: false,
          canViewAnalytics: true,
          canInviteMembers: false,
          canRemoveMembers: false,
          canAssignRoles: false,
          canPostAnnouncements: false,
          canComment: true,
          canAccessSubmissions: true,
          canDeleteOrganization: false,
        },
      };
      sendSuccess(
        res,
        {
          role,
          permissions: permissions[role],
        },
        "User role retrieved successfully",
      );
      return;
    }

    // Get role from Better Auth
    let role: "owner" | "admin" | "member" | null = null;
    try {
      const membersResponse = await auth.api.listMembers({
        query: {
          organizationId: betterAuthOrgId,
        },
        headers: fromNodeHeaders(req.headers),
      });

      const membersList = (membersResponse as any).members || [];
      const userMember = membersList.find(
        (m: any) => m.user.email.toLowerCase() === user.email.toLowerCase(),
      );

      if (!userMember) {
        sendForbidden(res, "You are not a member of this organization");
        return;
      }

      role = userMember.role as "owner" | "admin" | "member";
    } catch (error) {
      console.error("Error getting role from Better Auth:", error);
      // Fallback to custom org check
      const fallbackRole = getUserRole(organization, user.email);
      if (!fallbackRole) {
        sendForbidden(res, "You are not a member of this organization");
        return;
      }
      role = fallbackRole;
    }

    // Get detailed permissions based on role
    const permissions = {
      owner: {
        canEditProfile: true,
        canCreateProfile: true,
        canManageHackathons: true,
        canPublishHackathons: true,
        canViewAnalytics: true,
        canInviteMembers: true,
        canRemoveMembers: true,
        canAssignRoles: true,
        canPostAnnouncements: true,
        canComment: true,
        canAccessSubmissions: true,
        canDeleteOrganization: true,
      },
      admin: {
        canEditProfile: true,
        canCreateProfile: false,
        canManageHackathons: true,
        canPublishHackathons: false,
        canViewAnalytics: true,
        canInviteMembers: true,
        canRemoveMembers: true,
        canAssignRoles: false,
        canPostAnnouncements: false,
        canComment: true,
        canAccessSubmissions: true,
        canDeleteOrganization: false,
      },
      member: {
        canEditProfile: false,
        canCreateProfile: false,
        canManageHackathons: false,
        canPublishHackathons: false,
        canViewAnalytics: true,
        canInviteMembers: false,
        canRemoveMembers: false,
        canAssignRoles: false,
        canPostAnnouncements: false,
        canComment: true,
        canAccessSubmissions: true, // view only
        canDeleteOrganization: false,
      },
    };

    if (!role) {
      sendForbidden(res, "You are not a member of this organization");
      return;
    }

    sendSuccess(
      res,
      {
        role,
        permissions: permissions[role],
      },
      "User role retrieved successfully",
    );
  } catch (error) {
    console.error("Get user role error:", error);
    sendInternalServerError(
      res,
      "Failed to get user role",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/members-with-roles:
 *   get:
 *     summary: Get all members with their roles
 *     description: Returns all organization members grouped by role
 */
export const getMembersWithRoles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Get Better Auth organization ID
    const betterAuthOrgId = organization.betterAuthOrgId;

    let owner: any;
    let admins: any[] = [];
    let members: any[] = [];

    if (betterAuthOrgId) {
      // Get members from Better Auth
      try {
        const betterAuthMembers = await auth.api.listMembers({
          query: {
            organizationId: betterAuthOrgId,
          },
          headers: fromNodeHeaders(req.headers),
        });

        // Check if user is a member
        const userMember = betterAuthMembers.members?.find(
          (m: any) => m.user.email.toLowerCase() === user.email.toLowerCase(),
        );
        if (!userMember) {
          sendForbidden(
            res,
            "Access denied. You must be a member to view this organization.",
          );
          return;
        }

        // Get user details for all members
        const memberEmails =
          betterAuthMembers.members?.map((m: any) => m.user.email) || [];
        const usersData = await User.find({
          email: { $in: memberEmails },
        }).select(
          "email profile.firstName profile.lastName profile.username profile.avatar",
        );

        const userMap = new Map(
          usersData.map((u) => [
            u.email,
            {
              email: u.email,
              firstName: u.profile.firstName,
              lastName: u.profile.lastName,
              username: u.profile.username,
              avatar: u.profile.avatar,
            },
          ]),
        );

        // Group by role
        for (const member of betterAuthMembers.members || []) {
          const userData = userMap.get(member.user.email) || {
            email: member.user.email,
          };
          if (member.role === "owner") {
            owner = userData;
          } else if (member.role === "admin") {
            admins.push(userData);
          } else {
            members.push(userData);
          }
        }
      } catch (error) {
        console.error("Error getting members from Better Auth:", error);
        // Fallback to custom org
        const userRole = getUserRole(organization, user.email);
        if (!userRole) {
          sendForbidden(
            res,
            "Access denied. You must be a member to view this organization.",
          );
          return;
        }
        const allEmails = [
          organization.owner,
          ...(organization.admins || []),
          ...organization.members,
        ];
        const uniqueEmails = [...new Set(allEmails)];
        const usersData = await User.find({
          email: { $in: uniqueEmails },
        }).select(
          "email profile.firstName profile.lastName profile.username profile.avatar",
        );
        const userMap = new Map(
          usersData.map((u) => [
            u.email,
            {
              email: u.email,
              firstName: u.profile.firstName,
              lastName: u.profile.lastName,
              username: u.profile.username,
              avatar: u.profile.avatar,
            },
          ]),
        );
        owner = userMap.get(organization.owner) || {
          email: organization.owner,
        };
        admins = (organization.admins || [])
          .map((email) => userMap.get(email) || { email })
          .filter((admin) => admin.email !== organization.owner);
        members = organization.members
          .map((email) => userMap.get(email) || { email })
          .filter(
            (member) =>
              member.email !== organization.owner &&
              !organization.admins?.includes(member.email),
          );
      }
    } else {
      // Fallback to custom org check
      const userRole = getUserRole(organization, user.email);
      if (!userRole) {
        sendForbidden(
          res,
          "Access denied. You must be a member to view this organization.",
        );
        return;
      }

      const allEmails = [
        organization.owner,
        ...(organization.admins || []),
        ...organization.members,
      ];
      const uniqueEmails = [...new Set(allEmails)];

      const usersData = await User.find({
        email: { $in: uniqueEmails },
      }).select(
        "email profile.firstName profile.lastName profile.username profile.avatar",
      );

      const userMap = new Map(
        usersData.map((u) => [
          u.email,
          {
            email: u.email,
            firstName: u.profile.firstName,
            lastName: u.profile.lastName,
            username: u.profile.username,
            avatar: u.profile.avatar,
          },
        ]),
      );

      owner = userMap.get(organization.owner) || {
        email: organization.owner,
      };

      admins = (organization.admins || [])
        .map((email) => userMap.get(email) || { email })
        .filter((admin) => admin.email !== organization.owner);

      members = organization.members
        .map((email) => userMap.get(email) || { email })
        .filter(
          (member) =>
            member.email !== organization.owner &&
            !(organization.admins || []).includes(member.email),
        );
    }

    sendSuccess(
      res,
      {
        owner,
        admins,
        members,
        totalCount: {
          owner: 1,
          admins: admins.length,
          members: members.length,
          total: 1 + admins.length + members.length,
        },
      },
      "Members with roles retrieved successfully",
    );
  } catch (error) {
    console.error("Get members with roles error:", error);
    sendInternalServerError(
      res,
      "Failed to get members with roles",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
//Permission Management
// **
//  * @swagger
//  * /api/organizations/{id}/permissions:
//  *   get:
//  *     summary: Get organization permissions
//  *     description: Get custom permissions or default if not set
//  *     tags: [Organizations]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Organization ID
//  *     responses:
//  *       200:
//  *         description: Permissions retrieved successfully
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden - Not a member
//  *       404:
//  *         description: Organization not found
//  */
export const getOrganizationPermissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Check if user is a member
    const isMember =
      organization.members.includes(user.email) ||
      organization.owner === user.email ||
      organization.admins?.includes(user.email);

    if (!isMember) {
      sendForbidden(
        res,
        "Access denied. You must be a member to view permissions.",
      );
      return;
    }

    // Return custom permissions or defaults
    const permissions = organization.customPermissions || DEFAULT_PERMISSIONS;

    sendSuccess(
      res,
      {
        permissions,
        isCustom: !!organization.customPermissions,
        canEdit: organization.owner === user.email,
      },
      "Permissions retrieved successfully",
    );
  } catch (error) {
    console.error("Get organization permissions error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve permissions",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/permissions:
 *   patch:
 *     summary: Update organization permissions
 *     description: Update custom permissions (owner only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: object
 *                 description: Custom permissions object
 *     responses:
 *       200:
 *         description: Permissions updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner can update
 *       404:
 *         description: Organization not found
 */
export const updateOrganizationPermissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { permissions } = req.body as { permissions: CustomPermissions };
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!permissions || typeof permissions !== "object") {
      sendBadRequest(res, "Valid permissions object is required");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Only owner can update permissions
    if (organization.owner !== user.email) {
      sendForbidden(res, "Only the owner can update permissions");
      return;
    }

    // Validate permissions structure
    const validPermissionKeys = Object.keys(DEFAULT_PERMISSIONS) as Array<
      keyof CustomPermissions
    >;
    const providedKeys = Object.keys(permissions) as Array<
      keyof CustomPermissions
    >;

    // Check if all required keys are present
    const missingKeys = validPermissionKeys.filter(
      (key) => !providedKeys.includes(key),
    );
    if (missingKeys.length > 0) {
      sendBadRequest(res, `Missing permission keys: ${missingKeys.join(", ")}`);
      return;
    }

    // Validate each permission has owner, admin, member
    for (const key of providedKeys) {
      const perm = permissions[key];
      if (
        !perm.hasOwnProperty("owner") ||
        !perm.hasOwnProperty("admin") ||
        !perm.hasOwnProperty("member")
      ) {
        sendBadRequest(
          res,
          `Permission '${key}' must have owner, admin, and member properties`,
        );
        return;
      }

      // Owner permissions must always be true (cannot be disabled)
      if (!perm.owner) {
        sendBadRequest(
          res,
          `Owner permissions cannot be disabled for '${key}'`,
        );
        return;
      }
    }

    // Update organization with custom permissions
    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      { customPermissions: permissions },
      { new: true, runValidators: true },
    );

    sendSuccess(res, updatedOrganization, "Permissions updated successfully");
  } catch (error) {
    console.error("Update organization permissions error:", error);
    sendInternalServerError(
      res,
      "Failed to update permissions",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}/permissions/reset:
 *   post:
 *     summary: Reset permissions to defaults
 *     description: Reset custom permissions to default values (owner only)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Permissions reset successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only owner can reset
 *       404:
 *         description: Organization not found
 */
export const resetOrganizationPermissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    const organization = await Organization.findById(id);

    if (!organization) {
      sendNotFound(res, "Organization not found");
      return;
    }

    // Only owner can reset permissions
    if (organization.owner !== user.email) {
      sendForbidden(res, "Only the owner can reset permissions");
      return;
    }

    // Remove custom permissions (will fall back to defaults)
    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      { $unset: { customPermissions: "" } },
      { new: true, runValidators: true },
    );

    sendSuccess(
      res,
      {
        organization: updatedOrganization,
        permissions: DEFAULT_PERMISSIONS,
      },
      "Permissions reset to defaults successfully",
    );
  } catch (error) {
    console.error("Reset organization permissions error:", error);
    sendInternalServerError(
      res,
      "Failed to reset permissions",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
