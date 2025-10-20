import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import Organization, { IOrganization } from "../models/organization.model";
import User from "../models/user.model";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendCreated,
  sendInternalServerError,
} from "../utils/apiResponse";
import mongoose from "mongoose";

// Helper function to check profile completion
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

// Extend the Express Request type to include our custom properties
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

    // Create organization with dummy name
    const organization = await Organization.create({
      name: "Untitled Organization",
      logo: "",
      tagline: "",
      about: "",
      links: {
        website: "",
        x: "",
        github: "",
        others: "",
      },
      members: [user.email],
      owner: user.email,
    });

    sendCreated(res, organization, "Organization created successfully");
  } catch (error) {
    console.error("Create organization error:", error);
    sendInternalServerError(
      res,
      "Failed to create organization",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     description: Fetch organization by ID (only accessible by members)
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
 *         description: Organization retrieved successfully
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

    sendSuccess(res, organization, "Organization retrieved successfully");
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

    // Update links
    const updateData: any = {};
    if (website !== undefined) updateData["links.website"] = website;
    if (x !== undefined) updateData["links.x"] = x;
    if (github !== undefined) updateData["links.github"] = github;
    if (others !== undefined) updateData["links.others"] = others;

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
    const { email } = req.body;
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendBadRequest(res, "Invalid organization ID");
      return;
    }

    if (!email) {
      sendBadRequest(res, "Email is required");
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

    // Check if email is already a member or pending invite
    if (organization.members.includes(email)) {
      sendBadRequest(res, "User is already a member");
      return;
    }

    if (organization.pendingInvites.includes(email)) {
      sendBadRequest(res, "User has already been invited");
      return;
    }

    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      { $push: { pendingInvites: email } },
      { new: true, runValidators: true },
    );

    sendSuccess(res, updatedOrganization, "Invite sent successfully");
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
