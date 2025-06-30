import express from "express";
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  submitCampaignForApproval,
  deleteCampaign,
  getCampaignsByCreator,
} from "../controllers/campaign.controller";
import { protect } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { body, param, query } from "express-validator";
import { Request, Response, NextFunction } from "express";

const router = express.Router();

// Validation schemas
const createCampaignSchema = [
  body("projectId")
    .notEmpty()
    .withMessage("Project ID is required")
    .isMongoId()
    .withMessage("Invalid project ID format"),
  body("goalAmount")
    .isNumeric()
    .withMessage("Goal amount must be a number")
    .custom((value) => {
      if (value <= 0) {
        throw new Error("Goal amount must be greater than 0");
      }
      return true;
    }),
  body("deadline")
    .isISO8601()
    .withMessage("Invalid deadline format")
    .custom((value) => {
      const deadline = new Date(value);
      const minDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (deadline <= minDeadline) {
        throw new Error("Deadline must be at least 24 hours in the future");
      }
      return true;
    }),
  body("currency")
    .optional()
    .isIn(["USD", "XLM", "USDC"])
    .withMessage("Currency must be USD, XLM, or USDC"),
  body("minimumContribution")
    .optional()
    .isNumeric()
    .withMessage("Minimum contribution must be a number")
    .custom((value) => {
      if (value < 0.01) {
        throw new Error("Minimum contribution must be at least 0.01");
      }
      return true;
    }),
  body("maximumContribution")
    .optional()
    .isNumeric()
    .withMessage("Maximum contribution must be a number"),
  body("refundPolicy")
    .optional()
    .isIn(["all_or_nothing", "keep_it_all", "milestone_based"])
    .withMessage("Invalid refund policy"),
  body("milestones")
    .isArray({ min: 1 })
    .withMessage("At least one milestone is required"),
  body("milestones.*.title")
    .notEmpty()
    .withMessage("Milestone title is required")
    .isLength({ max: 200 })
    .withMessage("Milestone title cannot exceed 200 characters"),
  body("milestones.*.description")
    .notEmpty()
    .withMessage("Milestone description is required")
    .isLength({ max: 2000 })
    .withMessage("Milestone description cannot exceed 2000 characters"),
  body("milestones.*.targetAmount")
    .isNumeric()
    .withMessage("Milestone target amount must be a number")
    .custom((value) => {
      if (value < 0) {
        throw new Error("Milestone target amount cannot be negative");
      }
      return true;
    }),
  body("milestones.*.dueDate")
    .isISO8601()
    .withMessage("Invalid milestone due date format"),
  body("milestones.*.deliverables")
    .optional()
    .isArray()
    .withMessage("Deliverables must be an array"),
  body("milestones.*.acceptanceCriteria")
    .optional()
    .isArray()
    .withMessage("Acceptance criteria must be an array"),
  body("milestones.*.estimatedHours")
    .optional()
    .isNumeric()
    .withMessage("Estimated hours must be a number"),
  body("milestones.*.priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("Priority must be low, medium, or high"),
];

const updateCampaignSchema = [
  param("id").isMongoId().withMessage("Invalid campaign ID format"),
  body("goalAmount")
    .optional()
    .isNumeric()
    .withMessage("Goal amount must be a number")
    .custom((value) => {
      if (value <= 0) {
        throw new Error("Goal amount must be greater than 0");
      }
      return true;
    }),
  body("deadline")
    .optional()
    .isISO8601()
    .withMessage("Invalid deadline format")
    .custom((value) => {
      const deadline = new Date(value);
      const minDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
      if (deadline <= minDeadline) {
        throw new Error("Deadline must be at least 24 hours in the future");
      }
      return true;
    }),
  body("currency")
    .optional()
    .isIn(["USD", "XLM", "USDC"])
    .withMessage("Currency must be USD, XLM, or USDC"),
  body("minimumContribution")
    .optional()
    .isNumeric()
    .withMessage("Minimum contribution must be a number")
    .custom((value) => {
      if (value < 0.01) {
        throw new Error("Minimum contribution must be at least 0.01");
      }
      return true;
    }),
  body("maximumContribution")
    .optional()
    .isNumeric()
    .withMessage("Maximum contribution must be a number"),
  body("refundPolicy")
    .optional()
    .isIn(["all_or_nothing", "keep_it_all", "milestone_based"])
    .withMessage("Invalid refund policy"),
];

const paginationSchema = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

const campaignIdSchema = [
  param("id").isMongoId().withMessage("Invalid campaign ID format"),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Campaign:
 *       type: object
 *       required:
 *         - projectId
 *         - creatorId
 *         - goalAmount
 *         - deadline
 *       properties:
 *         _id:
 *           type: string
 *           description: Campaign ID
 *         projectId:
 *           type: string
 *           description: Associated project ID
 *         creatorId:
 *           type: string
 *           description: Campaign creator ID
 *         goalAmount:
 *           type: number
 *           description: Funding goal amount
 *         deadline:
 *           type: string
 *           format: date-time
 *           description: Campaign deadline
 *         fundsRaised:
 *           type: number
 *           description: Amount of funds raised
 *         smartContractAddress:
 *           type: string
 *           description: Smart contract address (if deployed)
 *         status:
 *           type: string
 *           enum: [draft, pending_approval, live, funded, failed, cancelled]
 *           description: Campaign status
 *         metadata:
 *           type: object
 *           properties:
 *             currency:
 *               type: string
 *               enum: [USD, XLM, USDC]
 *             minimumContribution:
 *
 *             maximumContribution:
 *               type: number
 *             refundPolicy:
 *               type: string
 *               enum: [all_or_nothing, keep_it_all, milestone_based]
 *         analytics:
 *           type: object
 *           properties:
 *             totalContributors:
 *               type: number
 *             averageContribution:
 *               type: number
 *             lastContributionAt:
 *               type: string
 *               format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Milestone:
 *       type: object
 *       required:
 *         - campaignId
 *         - title
 *         - description
 *         - targetAmount
 *         - dueDate
 *       properties:
 *         _id:
 *           type: string
 *           description: Milestone ID
 *         campaignId:
 *           type: string
 *           description: Associated campaign ID
 *         title:
 *           type: string
 *           description: Milestone title
 *         description:
 *           type: string
 *           description: Milestone description
 *         index:
 *           type: number
 *           description: Milestone order index
 *         targetAmount:
 *           type: number
 *           description: Target funding amount for this milestone
 *         proofUrl:
 *           type: string
 *           description: URL to proof of completion
 *         status:
 *           type: string
 *           enum: [pending, submitted, approved, rejected, completed]
 *           description: Milestone status
 *         dueDate:
 *           type: string
 *           format: date-time
 *           description: Milestone due date
 *         metadata:
 *           type: object
 *           properties:
 *             deliverables:
 *               type: array
 *               items:
 *                 type: string
 *             acceptanceCriteria:
 *               type: array
 *               items:
 *                 type: string
 *             estimatedHours:
 *               type: number
 *             priority:
 *               type: string
 *               enum: [low, medium, high]
 */

/**
 * @swagger
 * /api/campaigns:
 *   post:
 *     summary: Create a new campaign with milestones
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - goalAmount
 *               - deadline
 *               - milestones
 *             properties:
 *               projectId:
 *                 type: string
 *                 description: ID of the validated project
 *               goalAmount:
 *                 type: number
 *                 minimum: 1
 *                 description: Campaign funding goal
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 description: Campaign deadline (must be at least 24 hours in future)
 *               currency:
 *                 type: string
 *                 enum: [USD, XLM, USDC]
 *                 default: USD
 *               minimumContribution:
 *
 *
 *                 type: number
 *                 minimum: 0.01
 *                 default: 1
 *               maximumContribution:
 *                 type: number
 *                 description: Maximum contribution amount (optional)
 *               refundPolicy:
 *                 type: string
 *                 enum: [all_or_nothing, keep_it_all, milestone_based]
 *                 default: all_or_nothing
 *               milestones:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - title
 *                     - description
 *                     - targetAmount
 *                     - dueDate
 *                   properties:
 *                     title:
 *                       type: string
 *                       maxLength: 200
 *                     description:
 *                       type: string
 *                       maxLength: 2000
 *                     targetAmount:
 *                       type: number
 *                       minimum: 0
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                     deliverables:
 *                       type: array
 *                       items:
 *                         type: string
 *                     acceptanceCriteria:
 *                       type: array
 *                       items:
 *                         type: string
 *                     estimatedHours:
 *                       type: number
 *                       minimum: 0
 *                     priority:
 *                       type: string
 *                       enum: [low, medium, high]
 *                       default: medium
 *     responses:
 *       201:
 *         description: Campaign created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     campaign:
 *                       $ref: '#/components/schemas/Campaign'
 *                     milestones:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Milestone'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - validation errors
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not project owner or project not validated
 *       404:
 *         description: Project not found
 *       409:
 *         description: Campaign already exists for this project
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get all campaigns with filtering and pagination
 *     tags: [Campaigns]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending_approval, live, funded, failed, cancelled]
 *       - in: query
 *         name: creatorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     campaigns:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Campaign'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalItems:
 *                           type: integer
 *                         itemsPerPage:
 *                           type: integer
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  protect,
  rateLimitMiddleware("campaign_create", 5, 60), // 5 campaigns per hour
  validateRequest(createCampaignSchema),
  createCampaign,
);

router.get("/", validateRequest(paginationSchema), getCampaigns);

/**
 * @swagger
 * /api/campaigns/{id}:
 *   get:
 *     summary: Get campaign by ID with milestones
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     campaign:
 *                       $ref: '#/components/schemas/Campaign'
 *                     milestones:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Milestone'
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         totalMilestones:
 *                           type: integer
 *                         completedMilestones:
 *                           type: integer
 *                         milestoneProgress:
 *                           type: number
 *                         fundingProgress:
 *                           type: number
 *                         daysRemaining:
 *                           type: integer
 *       400:
 *         description: Invalid campaign ID format
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update campaign (only in draft status)
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               goalAmount:
 *                 type: number
 *                 minimum: 1
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               currency:
 *                 type: string
 *                 enum: [USD, XLM, USDC]
 *               minimumContribution:
 *                 type: number
 *                 minimum: 0.01
 *               maximumContribution:
 *                 type: number
 *               refundPolicy:
 *                 type: string
 *                 enum: [all_or_nothing, keep_it_all, milestone_based]
 *     responses:
 *       200:
 *         description: Campaign updated successfully
 *       400:
 *         description: Bad request - validation errors or campaign not in draft status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not campaign creator
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete campaign (only in draft status)
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign deleted successfully
 *       400:
 *         description: Campaign not in draft status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not campaign creator
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.get("/:id", validateRequest(campaignIdSchema), getCampaignById);

router.put(
  "/:id",
  protect,
  rateLimitMiddleware("campaign_update", 10, 60), // 10 updates per hour
  validateRequest(updateCampaignSchema),
  updateCampaign,
);

router.delete(
  "/:id",
  protect,
  validateRequest(campaignIdSchema),
  deleteCampaign,
);

/**
 * @swagger
 * /api/campaigns/{id}/submit:
 *   post:
 *     summary: Submit campaign for admin approval
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign submitted for approval successfully
 *       400:
 *         description: Campaign not in draft status or missing milestones
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not campaign creator
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/submit",
  protect,
  validateRequest(campaignIdSchema),
  submitCampaignForApproval,
);

/**
 * @swagger
 * /api/campaigns/creator/{creatorId}:
 *   get:
 *     summary: Get campaigns by creator
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Creator user ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Creator campaigns retrieved successfully
 *       400:
 *         description: Invalid creator ID format
 *       500:
 *         description: Server error
 */
router.get(
  "/creator/:creatorId",
  validateRequest([
    param("creatorId").isMongoId().withMessage("Invalid creator ID format"),
    ...paginationSchema,
  ]),
  getCampaignsByCreator,
);

export default router;
// In-memory store for rate limits (for production, use Redis or similar)
const rateLimitStore: Record<string, { count: number; reset: number }> = {};

/**
 * Simple rate limiting middleware.
 * @param keyPrefix Unique key for the rate limit (e.g., "campaign_create")
 * @param maxRequests Maximum allowed requests in the window
 * @param windowMinutes Window size in minutes
 */
function rateLimitMiddleware(
  keyPrefix: string,
  maxRequests: number,
  windowMinutes: number,
): import("express-serve-static-core").RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Use user ID if available, otherwise IP address
    const userId = (req as any).user?._id || req.ip;
    const key = `${keyPrefix}:${userId}`;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    if (!rateLimitStore[key] || rateLimitStore[key].reset < now) {
      rateLimitStore[key] = { count: 1, reset: now + windowMs };
    } else {
      rateLimitStore[key].count += 1;
    }

    if (rateLimitStore[key].count > maxRequests) {
      const retryAfter = Math.ceil((rateLimitStore[key].reset - now) / 1000);
      res.set("Retry-After", retryAfter.toString());
      res.status(429).json({
        success: false,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      });
      return;
    }

    next();
  };
}
