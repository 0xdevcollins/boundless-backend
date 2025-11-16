import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import Grant, { IGrant } from "../../models/grant.model";
import { UserRole } from "../../models/user.model";
import {
  sendError,
  sendSuccess,
  sendValidationError,
} from "../../utils/apiResponse";
import GrantApplication from "../../models/grant-application.model";
import Comment from "../../models/comment.model";
import Vote from "../../models/vote.model";
import mongoose from "mongoose";

/**
 * @swagger
 * /api/grants:
 *   post:
 *     summary: Create a new grant
 *     description: Allows grant creators to set up structured programs including budgets, rules, and milestones
 *     tags: [Grants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - totalBudget
 *               - rules
 *               - milestones
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 description: Title of the grant
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 description: Detailed description of the grant
 *               totalBudget:
 *                 type: number
 *                 minimum: 1
 *                 description: Total budget allocated for the grant
 *               rules:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Rules and criteria for applicants
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - title
 *                     - description
 *                     - expectedPayout
 *                   properties:
 *                     title:
 *                       type: string
 *                       maxLength: 100
 *                       description: Title of the milestone
 *                     description:
 *                       type: string
 *                       maxLength: 500
 *                       description: Description of the milestone
 *                     expectedPayout:
 *                       type: number
 *                       minimum: 0
 *                       description: Expected payout for this milestone
 *     responses:
 *       201:
 *         description: Grant created successfully
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
 *                   $ref: '#/components/schemas/Grant'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only creators can create grants
 *       500:
 *         description: Internal server error
 */
export const createGrant = async (req: Request, res: Response) => {
  try {
    // Check authentication
    const user = req.user;
    if (!user) {
      return sendError(res, "Authentication required", 401);
    }

    // Check if user has creator role
    const hasCreatorRole = user.roles.some(
      (role) => role.role === UserRole.CREATOR && role.status === "ACTIVE",
    );
    if (!hasCreatorRole) {
      res
        .status(403)
        .json({ success: false, message: "Only creators can create grants" });
      return;
    }

    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.mapped(),
      });
      return;
    }

    const { title, description, totalBudget, rules, milestones } = req.body;

    // Validate milestones
    if (!Array.isArray(milestones) || milestones.length === 0) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: { milestones: "Milestones array cannot be empty" },
      });
      return;
    }

    // Validate total budget vs milestone payouts
    const totalMilestonePayouts = milestones.reduce(
      (sum: number, milestone: any) => sum + milestone.expectedPayout,
      0,
    );

    if (totalMilestonePayouts > totalBudget) {
      res.status(400).json({
        success: false,
        message: "Total milestone payouts cannot exceed total budget",
      });
      return;
    }

    // Create the grant
    const grant = await Grant.create({
      creatorId: user._id,
      title,
      description,
      totalBudget,
      rules,
      milestones,
      status: "draft", // Default status as per requirements
    });

    // Populate creator information
    await grant.populate(
      "creatorId",
      "profile.firstName profile.lastName profile.username",
    );

    res.status(201).json({
      success: true,
      message: "Grant created successfully",
      data: grant,
    });
    return;
  } catch (error: any) {
    console.error("Error creating grant:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors: any = {};
      Object.keys(error.errors).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
      return;
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: "Grant with this title already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to create grant",
      error: error.message,
    });
    return;
  }
};

/**
 * @swagger
 * /api/grants/{id}/status:
 *   patch:
 *     summary: Update grant status
 *     description: Update the status of a grant to open or closed. Only the grant creator can update the status.
 *     tags: [Grants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Grant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, closed]
 *                 description: New status for the grant
 *     responses:
 *       200:
 *         description: Grant status updated successfully
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
 *                   $ref: '#/components/schemas/Grant'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only grant creator can update status
 *       404:
 *         description: Grant not found
 *       500:
 *         description: Internal server error
 */
export const updateGrantStatus = async (req: Request, res: Response) => {
  try {
    // Check authentication
    const user = req.user;
    if (!user) {
      return sendError(res, "Authentication required", 401);
    }

    const { id } = req.params;
    const { status } = req.body;

    // Validate grant ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(
        res,
        "Invalid grant ID",
        400,
        "Grant ID must be a valid MongoDB ObjectId",
      );
    }

    // Validate status input
    if (!status || !["open", "closed"].includes(status)) {
      return sendValidationError(res, "Validation failed", {
        status: { msg: "Status must be either 'open' or 'closed'" },
      });
    }

    // Find the grant
    const grant = await Grant.findById(id);
    if (!grant) {
      return sendError(
        res,
        "Grant not found",
        404,
        "No grant found with the provided ID",
      );
    }

    // Check authorization - only grant creator can update status
    if (grant.creatorId.toString() !== user._id.toString()) {
      return sendError(
        res,
        "Only the grant creator can update the grant status",
        403,
        "User is not the creator of this grant",
      );
    }

    // Validate status transition
    if (grant.status === "archived") {
      return sendValidationError(res, "Validation failed", {
        status: { msg: "Cannot update status of archived grant" },
      });
    }

    if (grant.status === "draft" && status === "closed") {
      return sendValidationError(res, "Validation failed", {
        status: { msg: "Cannot close a draft grant" },
      });
    }

    // Update the grant status
    grant.status = status;
    await grant.save();

    // Populate creator information
    await grant.populate(
      "creatorId",
      "profile.firstName profile.lastName profile.username",
    );

    res.status(200).json({
      success: true,
      message: "Grant status updated successfully",
      data: grant,
    });
    return;
  } catch (error: any) {
    console.error("Error updating grant status:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors: any = {};
      Object.keys(error.errors).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });
      return sendError(res, "Validation failed", 400, validationErrors);
    }

    return sendError(res, "Failed to update grant status", 500, error.message);
  }
};

/**
 * @swagger
 * /api/grant-applications:
 *   post:
 *     summary: Submit a new grant application
 *     description: Allows grant applicants to submit their application for a specific grant.
 *     tags: [Grant Applications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - grantId
 *               - title
 *               - summary
 *               - milestones
 *             properties:
 *               grantId:
 *                 type: string
 *                 description: ID of the grant being applied for.
 *               title:
 *                 type: string
 *                 description: Title of the application.
 *               summary:
 *                 type: string
 *                 description: Brief summary of the application.
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - title
 *                     - description
 *                     - expectedPayout
 *                   properties:
 *                     title:
 *                       type: string
 *                       maxLength: 100
 *                       description: Title of the milestone.
 *                     description:
 *                       type: string
 *                       maxLength: 500
 *                       description: Description of the milestone.
 *                     expectedPayout:
 *                       type: number
 *                       minimum: 0
 *                       description: Expected payout for this milestone.
 *                     supportingDocuments:
 *                       type: array
 *                       items:
 *                         type: string
 *                         description: URL of the supporting document.
 *     responses:
 *       201:
 *         description: Grant application submitted successfully.
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
 *                   $ref: '#/components/schemas/GrantApplication'
 *       400:
 *         description: Validation error or missing required fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: object
 *       401:
 *         description: Unauthorized - No applicantId found.
 *       403:
 *         description: Forbidden - User is not the applicant.
 *       404:
 *         description: Grant not found.
 *       409:
 *         description: You have already applied for this grant.
 *       500:
 *         description: Internal server error.
 */
export const submitGrantApplication = async (req: Request, res: Response) => {
  try {
    // Extract applicantId from authenticated user context
    const applicantId = req.user?._id;
    if (!applicantId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No applicantId found.",
      });
      return;
    }

    const { grantId, title, summary, milestones } = req.body;

    // Validate required fields
    if (
      !grantId ||
      !title ||
      !summary ||
      !Array.isArray(milestones) ||
      milestones.length === 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Missing required fields: grantId, title, summary, milestones.",
      });
      return;
    }

    // Validate each milestone
    for (const [i, milestone] of milestones.entries()) {
      if (
        !milestone.title ||
        !milestone.description ||
        typeof milestone.expectedPayout !== "number"
      ) {
        res.status(400).json({
          success: false,
          message: `Milestone at index ${i} is missing required fields.`,
        });
        return;
      }
      if (
        milestone.supportingDocuments &&
        !Array.isArray(milestone.supportingDocuments)
      ) {
        res.status(400).json({
          success: false,
          message: `Milestone at index ${i} has invalid supportingDocuments.`,
        });
        return;
      }
    }

    // Create the grant application
    const application = await GrantApplication.create({
      grantId,
      title,
      summary,
      applicantId,
      milestones,
      status: "submitted",
    });

    res.status(201).json({
      success: true,
      message: "Grant application submitted successfully.",
      application,
    });
    return;
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: "You have already applied for this grant.",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
    return;
  }
};

// GET /api/grant-applications/:id - Retrieve a grant application with feedback
export const getGrantApplicationWithFeedback = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid application ID" });
      return;
    }
    const application = await GrantApplication.findById(id);
    if (!application) {
      res
        .status(404)
        .json({ success: false, message: "Grant application not found" });
      return;
    }
    // Fetch comments and votes related to this application (assuming models exist and are linked by applicationId)
    const comments = await Comment.find({ grantApplicationId: id });
    const votes = await Vote.find({ grantApplicationId: id });
    res.status(200).json({
      success: true,
      data: {
        application,
        comments,
        votes,
        status: application.status,
      },
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch grant application feedback",
      error: error.message,
    });
    return;
  }
};

// PATCH /api/grant-applications/:id/review - Admin review action
export const reviewGrantApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;
    const validStatuses = ["approved", "rejected"];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid application ID" });
      return;
    }
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status value. Must be 'approved' or 'rejected'.",
      });
      return;
    }
    // Only admin can review
    if (!req.user || req.user.roles.every((r: any) => r.role !== "ADMIN")) {
      res
        .status(403)
        .json({ success: false, message: "Admin privileges required" });
      return;
    }
    const application = await GrantApplication.findById(id);
    if (!application) {
      res
        .status(404)
        .json({ success: false, message: "Grant application not found" });
      return;
    }
    // Log admin action (for audit)
    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[ADMIN REVIEW] User ${req.user._id} set status to ${status} for application ${id}. Note: ${adminNote || "-"}`,
      );
    }
    // Update application
    application.status = status;
    if (adminNote) {
      (application as any).adminNote = adminNote;
    }
    await application.save();
    // Archive if rejected
    if (status === "rejected") {
      // Move to archive (could be a flag or a separate collection, here we use a flag)
      (application as any).archived = true;
      await application.save();
    }
    // Advance to next stage if approved (could be a status update or workflow step)
    if (status === "approved") {
      // Example: set a field or trigger next workflow step
      // (application as any).stage = "creator_review";
      // await application.save();
    }
    res.status(200).json({
      success: true,
      message: `Application ${status}`,
      data: application,
    });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to review grant application",
      error: error.message,
    });
    return;
  }
};

// Get all grants (public)
export const getAllGrants = async (req: Request, res: Response) => {
  try {
    const grants = await Grant.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: grants });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch grants",
      error: error.message,
    });
    return;
  }
};

// Get grants created by the authenticated user (creator)
export const getMyGrants = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }
    const grants = await Grant.find({ creatorId: userId }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: grants });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch your grants",
      error: error.message,
    });
    return;
  }
};

// Get details for a particular grant by its ID (public)
export const getGrantById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid grant ID" });
      return;
    }
    const grant = await Grant.findById(id);
    if (!grant) {
      res.status(404).json({ success: false, message: "Grant not found" });
      return;
    }
    res.status(200).json({ success: true, data: grant });
    return;
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch grant",
      error: error.message,
    });
    return;
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Grant:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Grant ID
 *         creatorId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             profile:
 *               type: object
 *               properties:
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 username:
 *                   type: string
 *         title:
 *           type: string
 *           description: Title of the grant
 *         description:
 *           type: string
 *           description: Detailed description of the grant
 *         totalBudget:
 *           type: number
 *           description: Total budget allocated for the grant
 *         rules:
 *           type: string
 *           description: Rules and criteria for applicants
 *         milestones:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               expectedPayout:
 *                 type: number
 *         status:
 *           type: string
 *           enum: [draft, open, closed, archived]
 *           description: Current status of the grant
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
