import express from "express";
import {
  getPendingCampaigns,
  reviewCampaign,
  getCampaignAnalytics,
  deployCampaignToContract,
  getAllCampaignsForAdmin,
} from "../controllers/admin-campaign.controller";
import { protect, admin } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { body, param, query } from "express-validator";

const router = express.Router();

// Apply admin authentication to all routes
router.use(protect);
router.use(admin);

// Validation schemas
const reviewCampaignSchema = [
  param("id").isMongoId().withMessage("Invalid campaign ID format"),
  body("approved")
    .isBoolean()
    .withMessage("Approval decision must be a boolean"),
  body("rejectionReason")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Rejection reason cannot exceed 500 characters"),
  body("deployToContract")
    .optional()
    .isBoolean()
    .withMessage("Deploy to contract must be a boolean"),
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
 * /api/admin/campaigns/pending:
 *   get:
 *     summary: Get all campaigns pending approval
 *     tags: [Admin - Campaigns]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: Pending campaigns retrieved successfully
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
 *                         allOf:
 *                           - $ref: '#/components/schemas/Campaign'
 *                           - type: object
 *                             properties:
 *                               milestones:
 *                                 type: array
 *                                 items:
 *                                   $ref: '#/components/schemas/Milestone'
 *                               milestonesCount:
 *                                 type: integer
 *                     pagination:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get("/pending", validateRequest(paginationSchema), getPendingCampaigns);

/**
 * @swagger
 * /api/admin/campaigns/{id}/review:
 *   post:
 *     summary: Approve or reject a campaign
 *     tags: [Admin - Campaigns]
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
 *             required:
 *               - approved
 *             properties:
 *               approved:
 *                 type: boolean
 *                 description: Whether to approve or reject the campaign
 *               rejectionReason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for rejection (required if approved is false)
 *               deployToContract:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to deploy to smart contract upon approval
 *     responses:
 *       200:
 *         description: Campaign reviewed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Campaign'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - validation errors or invalid campaign status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/review",
  validateRequest(reviewCampaignSchema),
  reviewCampaign,
);

/**
 * @swagger
 * /api/admin/campaigns/analytics:
 *   get:
 *     summary: Get campaign analytics for admin dashboard
 *     tags: [Admin - Campaigns]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaign analytics retrieved successfully
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
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalCampaigns:
 *                           type: integer
 *                         activeCampaigns:
 *                           type: integer
 *                         pendingApproval:
 *                           type: integer
 *                         overallFundingRate:
 *                           type: number
 *                     statusStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           totalGoalAmount:
 *                             type: number
 *                           totalFundsRaised:
 *                             type: number
 *                           averageGoalAmount:
 *                             type: number
 *                           fundingRate:
 *                             type: number
 *                     creationTrends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             format: date
 *                           count:
 *                             type: integer
 *                           totalGoalAmount:
 *                             type: number
 *                     topCampaigns:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Campaign'
 *                     milestoneStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get("/analytics", getCampaignAnalytics);

/**
 * @swagger
 * /api/admin/campaigns/{id}/deploy:
 *   post:
 *     summary: Deploy campaign to smart contract manually
 *     tags: [Admin - Campaigns]
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
 *         description: Campaign deployed to smart contract successfully
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
 *                     deployResult:
 *                       type: object
 *                       properties:
 *                         contractId:
 *                           type: string
 *                         transactionHash:
 *                           type: string
 *                         status:
 *                           type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Campaign not eligible for deployment
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/deploy",
  validateRequest(campaignIdSchema),
  deployCampaignToContract,
);

/**
 * @swagger
 * /api/admin/campaigns:
 *   get:
 *     summary: Get all campaigns for admin management
 *     tags: [Admin - Campaigns]
 *     security:
 *       - bearerAuth: []
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
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending_approval, live, funded, failed, cancelled]
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get(
  "/",
  validateRequest([
    ...paginationSchema,
    query("status")
      .optional()
      .isIn([
        "draft",
        "pending_approval",
        "live",
        "funded",
        "failed",
        "cancelled",
      ])
      .withMessage("Invalid status filter"),
    query("sortBy")
      .optional()
      .isString()
      .withMessage("Sort by must be a string"),
    query("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),
  ]),
  getAllCampaignsForAdmin,
);

export default router;
