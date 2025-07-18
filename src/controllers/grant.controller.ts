import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import Grant, { IGrant } from "../models/grant.model";
import { UserRole } from "../models/user.model";
import {
  sendError,
  sendSuccess,
  sendValidationError,
} from "../utils/apiResponse";

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
      return sendError(
        res,
        "Only creators can create grants",
        403,
        "User does not have creator role",
      );
    }

    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, "Validation failed", errors.mapped());
    }

    const { title, description, totalBudget, rules, milestones } = req.body;

    // Validate milestones
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return sendError(
        res,
        "At least one milestone is required",
        400,
        "Milestones array cannot be empty",
      );
    }

    // Validate total budget vs milestone payouts
    const totalMilestonePayouts = milestones.reduce(
      (sum: number, milestone: any) => sum + milestone.expectedPayout,
      0,
    );

    if (totalMilestonePayouts > totalBudget) {
      return sendError(
        res,
        "Total milestone payouts cannot exceed total budget",
        400,
        `Total payouts: ${totalMilestonePayouts}, Total budget: ${totalBudget}`,
      );
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

    return sendSuccess(res, grant, "Grant created successfully", 201);
  } catch (error: any) {
    console.error("Error creating grant:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors: any = {};
      Object.keys(error.errors).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });
      return sendError(res, "Validation failed", 400, validationErrors);
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return sendError(
        res,
        "Grant with this title already exists",
        409,
        "Duplicate grant title",
      );
    }

    return sendError(res, "Failed to create grant", 500, error.message);
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
    if (!id || !require("mongoose").Types.ObjectId.isValid(id)) {
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

    return sendSuccess(res, grant, `Grant status updated to ${status}`, 200);
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
