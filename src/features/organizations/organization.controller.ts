import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import Organization, {
  CustomPermissions,
  IOrganization,
  PermissionValue,
} from "../../models/organization.model";
import User from "../../models/user.model";
import Hackathon from "../../models/hackathon.model";
import Grant from "../../models/grant.model";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendCreated,
  sendInternalServerError,
} from "../../utils/apiResponse";
import mongoose from "mongoose";
import sendMail from "../../utils/sendMail.utils";
import { config } from "../../config/main.config";
import getUserRole, { checkPermission } from "../../utils/getUserRole";
import { DEFAULT_PERMISSIONS } from "../../types/permission";

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

// **
//  * Helper function to check if a user has a specific permission
//  */
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
    if (organization.owner === userEmail) userRole = "owner";
    else if (organization.admins?.includes(userEmail)) userRole = "admin";
    else if (organization.members.includes(userEmail)) userRole = "member";

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

    // Check if an organization with this name already exists
    const existingOrganization = await Organization.findOne({
      name: name.trim(),
    });
    if (existingOrganization) {
      sendBadRequest(
        res,
        `An organization with the name "${name}" already exists. Please choose a different name.`,
      );
      return;
    }

    const organization = await Organization.create({
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
    });

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

    // Check if user is a member or owner
    const isMember =
      organization.members.includes(user.email) ||
      organization.owner === user.email;

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

    // Check if user is a member or owner
    const isMember =
      organization.members.includes(user.email) ||
      organization.owner === user.email;

    if (!isMember) {
      sendForbidden(
        res,
        "Access denied. You must be a member to update this organization.",
      );
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

    // Check profile completion and update if needed
    const isComplete = checkProfileCompletion(updatedOrganization!);
    if (updatedOrganization!.isProfileComplete !== isComplete) {
      await Organization.findByIdAndUpdate(id, {
        isProfileComplete: isComplete,
      });
      updatedOrganization!.isProfileComplete = isComplete;
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

    // Check if user is a member or owner
    const isMember =
      organization.members.includes(user.email) ||
      organization.owner === user.email;

    if (!isMember) {
      sendForbidden(
        res,
        "Access denied. You must be a member to update this organization.",
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

    // Check if user is a member or owner
    const isMember =
      organization.members.includes(user.email) ||
      organization.owner === user.email;

    if (!isMember) {
      sendForbidden(
        res,
        "Access denied. You must be a member to update this organization.",
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
export const deleteOrganization = async (
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

    // Only the owner can delete the organization
    if (organization.owner !== user.email) {
      sendForbidden(res, "Only the owner can delete the organization");
      return;
    }

    await Organization.findByIdAndDelete(id);

    sendSuccess(res, null, "Organization deleted successfully");
  } catch (error) {
    console.error("Delete organization error:", error);
    sendInternalServerError(
      res,
      "Failed to delete organization",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

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

    // Check if user is a member or owner
    const isMember =
      organization.members.includes(user.email) ||
      organization.owner === user.email;

    if (!isMember) {
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

    // Filter out already members or already invited
    const alreadyMembers: string[] = [];
    const alreadyInvited: string[] = [];
    const toInvite: string[] = [];

    for (const e of normalizedEmails) {
      if (organization.members.includes(e)) {
        alreadyMembers.push(e);
        continue;
      }
      if (organization.pendingInvites.includes(e)) {
        alreadyInvited.push(e);
        continue;
      }
      toInvite.push(e);
    }

    // Split by registration status
    const existingUsers = await User.find({ email: { $in: toInvite } }).select(
      "email profile.firstName profile.lastName",
    );
    const registeredSet = new Set(
      existingUsers.map((u) => u.email.toLowerCase()),
    );
    const registeredEmails = toInvite.filter((e) => registeredSet.has(e));
    const unregisteredEmails = toInvite.filter((e) => !registeredSet.has(e));

    // Update pendingInvites with all toInvite (both registered and unregistered)
    let updatedOrganization = organization;
    if (toInvite.length > 0) {
      updatedOrganization = (await Organization.findByIdAndUpdate(
        id,
        { $addToSet: { pendingInvites: { $each: toInvite } } },
        { new: true, runValidators: true },
      ))!;
    }

    // Prepare base URL for links (use first CORS origin if array)
    const originCfg = config.cors.origin;
    const baseUrl = Array.isArray(originCfg) ? originCfg[0] : originCfg;

    // Generate and send emails (best effort; failures won't rollback DB)
    const sentToRegistered: string[] = [];
    const sentToUnregistered: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    // Direct invite link for registered users (frontend route)
    for (const e of registeredEmails) {
      const acceptUrl = `${baseUrl}/organizations/${id}/invite/accept?email=${encodeURIComponent(
        e,
      )}`;
      try {
        await sendMail({
          to: e,
          subject: `You've been invited to join an organization`,
          html: `
            <p>Hello,</p>
            <p>You have been invited to join <strong>${organization.name}</strong>.</p>
            <p><a href="${acceptUrl}">Click here to accept the invite</a></p>
            <p>If you did not expect this, you can ignore this email.</p>
          `.trim(),
        });
        sentToRegistered.push(e);
      } catch (err: any) {
        failed.push({ email: e, error: err?.message || "send failed" });
      }
    }

    // Signup link with invite code for unregistered users
    for (const e of unregisteredEmails) {
      const inviteCode = Math.random().toString(36).slice(2, 10);
      const signupUrl = `${baseUrl}/signup?orgId=${encodeURIComponent(
        id,
      )}&invite=${encodeURIComponent(inviteCode)}&email=${encodeURIComponent(e)}`;
      try {
        await sendMail({
          to: e,
          subject: `Join ${organization.name} on Boundless`,
          html: `
            <p>Hello,</p>
            <p>You have been invited to join <strong>${organization.name}</strong> on Boundless.</p>
            <p><a href="${signupUrl}">Create your account and join</a></p>
            <p>Invite code: <strong>${inviteCode}</strong></p>
            <p>If you did not expect this, you can ignore this email.</p>
          `.trim(),
        });
        sentToUnregistered.push(e);
      } catch (err: any) {
        failed.push({ email: e, error: err?.message || "send failed" });
      }
    }

    sendSuccess(
      res,
      {
        organization: updatedOrganization,
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

    // Check if user has a pending invite
    if (!organization.pendingInvites.includes(user.email)) {
      sendBadRequest(res, "No pending invite found for this user");
      return;
    }

    // Remove from pending invites and add to members
    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      {
        $pull: { pendingInvites: user.email },
        $push: { members: user.email },
      },
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

    // Only owner can assign roles
    if (organization.owner !== user.email) {
      sendForbidden(res, "Only the owner can assign roles");
      return;
    }

    // Cannot change owner's role
    if (email === organization.owner) {
      sendBadRequest(res, "Cannot change owner's role");
      return;
    }

    // Check if user is a member
    if (!organization.members.includes(email)) {
      sendBadRequest(res, "User must be a member of the organization");
      return;
    }

    let updatedOrganization;

    if (action === "promote") {
      // Check if already an admin
      if (organization.admins?.includes(email)) {
        sendBadRequest(res, "User is already an admin");
        return;
      }

      updatedOrganization = await Organization.findByIdAndUpdate(
        id,
        { $addToSet: { admins: email } },
        { new: true, runValidators: true },
      );
    } else {
      // demote
      // Check if user is an admin
      if (!organization.admins?.includes(email)) {
        sendBadRequest(res, "User is not an admin");
        return;
      }

      updatedOrganization = await Organization.findByIdAndUpdate(
        id,
        { $pull: { admins: email } },
        { new: true, runValidators: true },
      );
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

    // Check permissions: Owner and Admin can manage members
    if (!checkPermission(organization, user.email, ["owner", "admin"])) {
      sendForbidden(res, "Only owners and admins can manage members");
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
      // If removing an admin, also remove from admins array
      if (organization.admins?.includes(email)) {
        await Organization.findByIdAndUpdate(id, {
          $pull: { admins: email },
        });
      }
      updatedMembers = updatedMembers.filter((member) => member !== email);
    }

    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      { members: updatedMembers },
      { new: true, runValidators: true },
    );

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

    const role = getUserRole(organization, user.email);

    if (!role) {
      sendForbidden(res, "You are not a member of this organization");
      return;
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

    // Check if user is a member
    const userRole = getUserRole(organization, user.email);
    if (!userRole) {
      sendForbidden(
        res,
        "Access denied. You must be a member to view this organization.",
      );
      return;
    }

    // Get user details for all members
    const allEmails = [
      organization.owner,
      ...(organization.admins || []),
      ...organization.members,
    ];
    const uniqueEmails = [...new Set(allEmails)];

    const users = await User.find({ email: { $in: uniqueEmails } }).select(
      "email profile.firstName profile.lastName profile.username profile.avatar",
    );

    const userMap = new Map(
      users.map((u) => [
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

    const owner = userMap.get(organization.owner) || {
      email: organization.owner,
    };

    const admins = (organization.admins || [])
      .map((email) => userMap.get(email) || { email })
      .filter((admin) => admin.email !== organization.owner);

    const members = organization.members
      .map((email) => userMap.get(email) || { email })
      .filter(
        (member) =>
          member.email !== organization.owner &&
          !(organization.admins || []).includes(member.email),
      );

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
