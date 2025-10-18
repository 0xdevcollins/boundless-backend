import { Router } from "express";
import {
  prepareCrowdfundingProject,
  confirmCrowdfundingProject,
  fundCrowdfundingProject,
  confirmCrowdfundingProjectFunding,
  getCrowdfundingProjects,
  getCrowdfundingProject,
  updateCrowdfundingProject,
  deleteCrowdfundingProject,
  adminReviewCrowdfundingProject,
} from "../controllers/crowdfunding.controller";
import {
  validateCrowdfundingProject,
  validateCrowdfundingUpdate,
} from "../middleware/validateCrowdfunding";
import { protect } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CrowdfundingProject:
 *       type: object
 *       required:
 *         - title
 *         - logo
 *         - vision
 *         - category
 *         - details
 *         - fundingAmount
 *         - milestones
 *         - team
 *         - contact
 *         - socialLinks
 *       properties:
 *         title:
 *           type: string
 *           description: Project name
 *           example: "AI-Powered Healthcare Platform"
 *         logo:
 *           type: string
 *           format: uri
 *           description: Project logo/image URL
 *           example: "https://example.com/logo.png"
 *         vision:
 *           type: string
 *           description: Project vision statement
 *           example: "To revolutionize healthcare through AI-powered diagnostics"
 *         category:
 *           type: string
 *           description: Project category
 *           example: "Healthcare"
 *         details:
 *           type: string
 *           description: Detailed project description in markdown
 *           example: "# Project Overview\n\nThis project aims to..."
 *         fundingAmount:
 *           type: number
 *           description: Total funding amount needed
 *           example: 100000
 *         githubUrl:
 *           type: string
 *           format: uri
 *           description: GitHub repository URL (optional)
 *           example: "https://github.com/username/project"
 *         gitlabUrl:
 *           type: string
 *           format: uri
 *           description: GitLab repository URL (optional)
 *           example: "https://gitlab.com/username/project"
 *         bitbucketUrl:
 *           type: string
 *           format: uri
 *           description: Bitbucket repository URL (optional)
 *           example: "https://bitbucket.org/username/project"
 *         projectWebsite:
 *           type: string
 *           format: uri
 *           description: Project website URL (optional)
 *           example: "https://project-website.com"
 *         demoVideo:
 *           type: string
 *           format: uri
 *           description: Demo video URL (optional)
 *           example: "https://youtube.com/watch?v=demo"
 *         milestones:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - startDate
 *               - endDate
 *             properties:
 *               name:
 *                 type: string
 *                 description: Milestone name/title
 *                 example: "MVP Development"
 *               description:
 *                 type: string
 *                 description: Milestone description
 *                 example: "Develop and test the minimum viable product"
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Milestone start date
 *                 example: "2024-02-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: Milestone end date
 *                 example: "2024-04-01"
 *               amount:
 *                 type: number
 *                 description: Milestone funding amount (optional)
 *                 example: 25000
 *         team:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - name
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 description: Team member name
 *                 example: "John Doe"
 *               role:
 *                 type: string
 *                 description: Team member role
 *                 example: "Lead Developer"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Team member email (optional)
 *                 example: "john@example.com"
 *               linkedin:
 *                 type: string
 *                 format: uri
 *                 description: Team member LinkedIn URL (optional)
 *                 example: "https://linkedin.com/in/johndoe"
 *               twitter:
 *                 type: string
 *                 format: uri
 *                 description: Team member Twitter URL (optional)
 *                 example: "https://twitter.com/johndoe"
 *         contact:
 *           type: object
 *           required:
 *             - primary
 *           properties:
 *             primary:
 *               type: string
 *               format: email
 *               description: Primary contact email
 *               example: "contact@project.com"
 *             backup:
 *               type: string
 *               format: email
 *               description: Backup contact email (optional)
 *               example: "backup@project.com"
 *         socialLinks:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - platform
 *               - url
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [twitter, linkedin, facebook, instagram, youtube, discord, telegram, other]
 *                 description: Social media platform
 *                 example: "twitter"
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Social media profile URL
 *                 example: "https://twitter.com/project"
 *     CrowdfundingProjectResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             project:
 *               $ref: '#/components/schemas/CrowdfundingProject'
 *             crowdfund:
 *               type: object
 *               properties:
 *                 projectId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 thresholdVotes:
 *                   type: number
 *                 totalVotes:
 *                   type: number
 */

/**
 * @swagger
 * /api/crowdfunding/projects/prepare:
 *   post:
 *     summary: "Step 1: Prepare crowdfunding project and create escrow"
 *     description: Validates project data and creates escrow, returns unsigned XDR for frontend to sign
 *     tags: [Crowdfunding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrowdfundingProject'
 *     responses:
 *       200:
 *         description: Project prepared successfully, unsigned XDR returned
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
 *                   type: object
 *                   properties:
 *                     unsignedXdr:
 *                       type: string
 *                       description: Unsigned transaction XDR for frontend to sign
 *                     escrowAddress:
 *                       type: string
 *                       description: Generated escrow address
 *                     network:
 *                       type: string
 *                       description: Network identifier
 *                     projectData:
 *                       type: object
 *                       description: Prepared project data
 *       400:
 *         description: Validation error or bad request
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post(
  "/projects/prepare",
  protect,
  validateRequest(validateCrowdfundingProject),
  prepareCrowdfundingProject,
);

/**
 * @swagger
 * /api/crowdfunding/projects/confirm:
 *   post:
 *     summary: "Step 2: Submit signed transaction and create project"
 *     description: Submits the signed transaction and creates the project in the database
 *     tags: [Crowdfunding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signedXdr
 *               - escrowAddress
 *               - projectData
 *             properties:
 *               signedXdr:
 *                 type: string
 *                 description: Signed transaction XDR from frontend
 *               escrowAddress:
 *                 type: string
 *                 description: Escrow address from step 1
 *               projectData:
 *                 type: object
 *                 description: Project data from step 1
 *               mappedMilestones:
 *                 type: array
 *                 description: Mapped milestones from step 1
 *               mappedTeam:
 *                 type: array
 *                 description: Mapped team from step 1
 *     responses:
 *       201:
 *         description: Crowdfunding project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CrowdfundingProjectResponse'
 *       400:
 *         description: Validation error or bad request
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post("/projects/confirm", protect, confirmCrowdfundingProject);

/**
 * @swagger
 * /api/crowdfunding/projects:
 *   get:
 *     summary: Get all crowdfunding projects
 *     description: Retrieve a paginated list of all crowdfunding projects with optional filtering
 *     tags: [Crowdfunding]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of projects per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by project category
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [idea, reviewing, rejected, validated, campaigning, live, completed, draft, awaiting_boundless_verification, pending_deployment, voting, funding, funded, cancelled, paused, refund_pending]
 *         description: Filter by project status
 *     responses:
 *       200:
 *         description: Crowdfunding projects retrieved successfully
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
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CrowdfundingProject'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         current:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *                         total:
 *                           type: integer
 *       500:
 *         description: Internal server error
 */
router.get("/projects", getCrowdfundingProjects);

/**
 * @swagger
 * /api/crowdfunding/projects/{id}:
 *   get:
 *     summary: Get a single crowdfunding project
 *     description: Retrieve detailed information about a specific crowdfunding project
 *     tags: [Crowdfunding]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Crowdfunding project retrieved successfully
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
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: '#/components/schemas/CrowdfundingProject'
 *                     crowdfund:
 *                       type: object
 *       400:
 *         description: Invalid project ID or project not found
 *       500:
 *         description: Internal server error
 */
router.get("/projects/:id", getCrowdfundingProject);

/**
 * @swagger
 * /api/crowdfunding/projects/{id}:
 *   put:
 *     summary: Update a crowdfunding project
 *     description: Update an existing crowdfunding project (only allowed for project owners and when project is in draft/idea status)
 *     tags: [Crowdfunding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               logo:
 *                 type: string
 *                 format: uri
 *               vision:
 *                 type: string
 *               category:
 *                 type: string
 *               details:
 *                 type: string
 *               fundingAmount:
 *                 type: number
 *               githubUrl:
 *                 type: string
 *                 format: uri
 *               gitlabUrl:
 *                 type: string
 *                 format: uri
 *               bitbucketUrl:
 *                 type: string
 *                 format: uri
 *               projectWebsite:
 *                 type: string
 *                 format: uri
 *               demoVideo:
 *                 type: string
 *                 format: uri
 *               socialLinks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     platform:
 *                       type: string
 *                     url:
 *                       type: string
 *                       format: uri
 *               contact:
 *                 type: object
 *                 properties:
 *                   primary:
 *                     type: string
 *                     format: email
 *                   backup:
 *                     type: string
 *                     format: email
 *     responses:
 *       200:
 *         description: Crowdfunding project updated successfully
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
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: '#/components/schemas/CrowdfundingProject'
 *       400:
 *         description: Validation error, invalid project ID, or project cannot be updated
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Only project owner can update
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/projects/:id",
  protect,
  validateRequest(validateCrowdfundingUpdate),
  updateCrowdfundingProject,
);

/**
 * @swagger
 * /api/crowdfunding/projects/{id}:
 *   delete:
 *     summary: Delete a crowdfunding project
 *     description: Delete a crowdfunding project (only allowed for project owners and when project is in draft/idea status)
 *     tags: [Crowdfunding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Crowdfunding project deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid project ID or project cannot be deleted
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Only project owner can delete
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.delete("/projects/:id", protect, deleteCrowdfundingProject);

/**
 * @swagger
 * /api/crowdfunding/projects/{id}/fund:
 *   post:
 *     summary: "Fund a crowdfunding project (Step 1: Prepare funding transaction)"
 *     description: Prepares a funding transaction for a crowdfunding project and returns unsigned XDR
 *     tags: [Crowdfunding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - signer
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Funding amount
 *                 example: 1000
 *               signer:
 *                 type: string
 *                 description: User's wallet address for signing
 *                 example: "GCRU2PL3AI4WW64E7U5SA6BXRP7ULDSLRQVNGSNW4LVSZWQD345NK57F"
 *     responses:
 *       200:
 *         description: Funding transaction prepared successfully
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
 *                   type: object
 *                   properties:
 *                     unsignedXdr:
 *                       type: string
 *                       description: Unsigned transaction XDR for frontend to sign
 *                     contractId:
 *                       type: string
 *                       description: Escrow contract ID
 *                     amount:
 *                       type: number
 *                       description: Funding amount
 *                     projectId:
 *                       type: string
 *                       description: Project ID
 *                     projectTitle:
 *                       type: string
 *                       description: Project title
 *                     currentRaised:
 *                       type: number
 *                       description: Current amount raised
 *                     fundingGoal:
 *                       type: number
 *                       description: Total funding goal
 *                     remainingGoal:
 *                       type: number
 *                       description: Remaining amount to reach goal
 *       400:
 *         description: Validation error or project not fundable
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.post("/projects/:id/fund", protect, fundCrowdfundingProject);

/**
 * @swagger
 * /api/crowdfunding/projects/{id}/fund/confirm:
 *   post:
 *     summary: "Confirm crowdfunding project funding (Step 2: Submit signed transaction)"
 *     description: Submits the signed funding transaction and updates the project
 *     tags: [Crowdfunding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signedXdr
 *               - amount
 *               - transactionHash
 *             properties:
 *               signedXdr:
 *                 type: string
 *                 description: Signed transaction XDR from frontend
 *               amount:
 *                 type: number
 *                 description: Funding amount
 *                 example: 1000
 *               transactionHash:
 *                 type: string
 *                 description: Blockchain transaction hash
 *                 example: "abc123def456..."
 *     responses:
 *       201:
 *         description: Project funding confirmed successfully
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
 *                   type: object
 *                   properties:
 *                     tx:
 *                       type: object
 *                       description: Transaction response from Trustless Work
 *                     project:
 *                       type: object
 *                       description: Updated project with new funding
 *                     funding:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: number
 *                         transactionHash:
 *                           type: string
 *                         newTotalRaised:
 *                           type: number
 *                         isFullyFunded:
 *                           type: boolean
 *                         remainingGoal:
 *                           type: number
 *       400:
 *         description: Validation error or transaction failed
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/projects/:id/fund/confirm",
  protect,
  confirmCrowdfundingProjectFunding,
);

/**
 * @swagger
 * /api/crowdfunding/projects/{id}/admin-review:
 *   patch:
 *     summary: Admin review crowdfunding project
 *     description: Admin can approve or reject a crowdfunding project for community voting
 *     tags: [Crowdfunding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Admin action - approve or reject
 *               adminNote:
 *                 type: string
 *                 description: Optional admin note explaining the decision
 *     responses:
 *       200:
 *         description: Project review completed successfully
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
 *                   type: object
 *                   properties:
 *                     project:
 *                       type: object
 *                     crowdfund:
 *                       type: object
 *                     action:
 *                       type: string
 *       400:
 *         description: Validation error or project not in reviewing status
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin privileges required
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/projects/:id/admin-review",
  protect,
  adminReviewCrowdfundingProject,
);

export default router;
