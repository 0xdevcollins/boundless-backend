import { Request, Response } from "express";
import mongoose from "mongoose";
import Hackathon, {
  HackathonStatus,
  IHackathon,
} from "../../models/hackathon.model";
import Organization from "../../models/organization.model";
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
import {
  AuthenticatedRequest,
  canManageHackathons,
  transformRequestBody,
  validatePublishRequirements,
} from "./hackathon.helpers";

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons:
 *   post:
 *     summary: Publish a hackathon
 *     description: Publish a hackathon (requires all tabs to be complete). Can publish from draft or create new.
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const publishHackathon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;
    const { draftId } = req.query; // Optional: if publishing from existing draft

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
        "Only owners and admins can publish hackathons for this organization",
      );
      return;
    }

    let hackathon: IHackathon | null = null;

    // If draftId is provided, update existing draft; otherwise create new
    if (draftId && mongoose.Types.ObjectId.isValid(draftId as string)) {
      hackathon = await Hackathon.findOne({
        _id: draftId,
        organizationId: orgId,
        status: HackathonStatus.DRAFT,
      });

      if (!hackathon) {
        sendNotFound(res, "Draft not found");
        return;
      }

      // Merge new data with existing draft
      const updateData = transformRequestBody(req.body);
      Object.assign(hackathon, updateData);
    } else {
      // Create new hackathon
      const updateData = transformRequestBody(req.body);
      hackathon = new Hackathon({
        organizationId: new mongoose.Types.ObjectId(orgId),
        status: HackathonStatus.DRAFT,
        ...updateData,
      });
    }

    // Validate all required fields
    const validation = validatePublishRequirements(hackathon);
    if (!validation.valid) {
      sendValidationError(res, "Validation failed", {
        publish: { msg: validation.errors.join("; ") },
      });
      return;
    }

    // Set status to published and set publishedAt
    hackathon.status = HackathonStatus.PUBLISHED;
    hackathon.publishedAt = new Date();
    await hackathon.save();

    // Add hackathon ID to organization.hackathons array if not already present
    // Use Mongoose's id getter which always returns a string, ensuring type safety
    const hackathonIdString = hackathon.id; // Mongoose Document.id is always a string
    const hackathonObjectId = new mongoose.Types.ObjectId(hackathonIdString);

    // Check if hackathon is already in organization's hackathons array
    // Compare string representations for reliable comparison
    const isAlreadyAdded = organization.hackathons.some(
      (id: mongoose.Types.ObjectId) => id.toString() === hackathonIdString,
    );

    if (!isAlreadyAdded) {
      await Organization.findByIdAndUpdate(orgId, {
        $push: { hackathons: hackathonObjectId },
      });
    }

    sendCreated(res, hackathon, "Hackathon published successfully");
  } catch (error) {
    console.error("Publish hackathon error:", error);
    sendInternalServerError(
      res,
      "Failed to publish hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}:
 *   put:
 *     summary: Update a published hackathon
 *     description: Update a published hackathon
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const updateHackathon = async (
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
        "Only owners and admins can update hackathons for this organization",
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

    const updateData = transformRequestBody(req.body);

    Object.assign(hackathon, updateData);
    await hackathon.save();

    sendSuccess(res, hackathon, "Hackathon updated successfully");
  } catch (error) {
    console.error("Update hackathon error:", error);
    sendInternalServerError(
      res,
      "Failed to update hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}:
 *   get:
 *     summary: Get a hackathon by ID
 *     description: Retrieve a hackathon by ID
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getHackathon = async (
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
        "Only owners and admins can view hackathons for this organization",
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

    sendSuccess(res, hackathon, "Hackathon retrieved successfully");
  } catch (error) {
    console.error("Get hackathon error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve hackathon",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons:
 *   get:
 *     summary: List all hackathons for an organization
 *     description: Get all hackathons for an organization with optional status filter
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getHackathons = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;
    const { status } = req.query;

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
        "Only owners and admins can view hackathons for this organization",
      );
      return;
    }

    const query: any = {
      organizationId: orgId,
    };

    if (
      status &&
      Object.values(HackathonStatus).includes(status as HackathonStatus)
    ) {
      query.status = status;
    }

    const hackathons = await Hackathon.find(query).sort({ createdAt: -1 });

    sendSuccess(res, hackathons, "Hackathons retrieved successfully");
  } catch (error) {
    console.error("Get hackathons error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve hackathons",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
