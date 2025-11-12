import { Request, Response } from "express";
import mongoose from "mongoose";
import Hackathon, { HackathonStatus } from "../../models/hackathon.model";
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
} from "./hackathon.helpers";

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/drafts:
 *   post:
 *     summary: Create a new hackathon draft
 *     description: Create a new draft hackathon with partial data
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const createDraft = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;

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
        "Only owners and admins can create hackathons for this organization",
      );
      return;
    }

    const updateData = transformRequestBody(req.body);

    const hackathon = await Hackathon.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      status: HackathonStatus.DRAFT,
      ...updateData,
    });

    sendCreated(res, hackathon, "Draft created successfully");
  } catch (error) {
    console.error("Create draft error:", error);
    sendInternalServerError(
      res,
      "Failed to create draft",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/drafts/{draftId}:
 *   put:
 *     summary: Update a hackathon draft
 *     description: Update a draft hackathon with partial data
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const updateDraft = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, draftId } = req.params;

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

    if (!mongoose.Types.ObjectId.isValid(draftId)) {
      sendBadRequest(res, "Invalid draft ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: draftId,
      organizationId: orgId,
      status: HackathonStatus.DRAFT,
    });

    if (!hackathon) {
      sendNotFound(res, "Draft not found");
      return;
    }

    const updateData = transformRequestBody(req.body);

    Object.assign(hackathon, updateData);
    await hackathon.save();

    sendSuccess(res, hackathon, "Draft updated successfully");
  } catch (error) {
    console.error("Update draft error:", error);
    sendInternalServerError(
      res,
      "Failed to update draft",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/drafts/{draftId}:
 *   get:
 *     summary: Get a hackathon draft by ID
 *     description: Retrieve a draft hackathon by ID
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, draftId } = req.params;

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

    if (!mongoose.Types.ObjectId.isValid(draftId)) {
      sendBadRequest(res, "Invalid draft ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: draftId,
      organizationId: orgId,
      status: HackathonStatus.DRAFT,
    });

    if (!hackathon) {
      sendNotFound(res, "Draft not found");
      return;
    }

    sendSuccess(res, hackathon, "Draft retrieved successfully");
  } catch (error) {
    console.error("Get draft error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve draft",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/drafts:
 *   get:
 *     summary: List all hackathon drafts for an organization
 *     description: Get all draft hackathons for an organization
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getDrafts = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId } = req.params;

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

    const drafts = await Hackathon.find({
      organizationId: orgId,
      status: HackathonStatus.DRAFT,
    }).sort({ createdAt: -1 });

    sendSuccess(res, drafts, "Drafts retrieved successfully");
  } catch (error) {
    console.error("Get drafts error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve drafts",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
