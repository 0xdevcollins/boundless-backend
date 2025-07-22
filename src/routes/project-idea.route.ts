import express from "express";
import {
  createProjectIdea,
  getProjectIdeas,
  getProjectIdeaById,
  updateProjectIdea,
  deleteProjectIdea,
} from "../controllers/project-idea.controller";
import { protect } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import { body, query, param } from "express-validator";

const router = express.Router();

// Validation schemas
const createProjectIdeaSchema = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Title must be between 3 and 100 characters")
    .trim(),
  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters")
    .trim(),
  body("tagline")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Tagline cannot exceed 200 characters")
    .trim(),
  body("type")
    .optional()
    .isIn(["crowdfund", "grant"])
    .withMessage("Type must be either 'crowdfund' or 'grant'"),
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ max: 50 })
    .withMessage("Category cannot exceed 50 characters")
    .trim(),
  body("fundAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Fund amount must be a positive number"),
  body("whitepaperUrl")
    .optional()
    .isURL({ protocols: ["http", "https"] })
    .withMessage("Whitepaper URL must be a valid URL"),
  body("thumbnail")
    .optional()
    .isURL({ protocols: ["http", "https"] })
    .withMessage("Thumbnail URL must be a valid URL"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("tags.*")
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be between 1 and 50 characters"),
];

const updateProjectIdeaSchema = [
  body("title")
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage("Title must be between 3 and 100 characters")
    .trim(),
  body("description")
    .optional()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters")
    .trim(),
  body("tagline")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Tagline cannot exceed 200 characters")
    .trim(),
  body("category")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Category cannot exceed 50 characters")
    .trim(),
  body("fundAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Fund amount must be a positive number"),
  body("whitepaperUrl")
    .optional()
    .custom((value) => {
      if (value && value.trim() !== "") {
        try {
          new URL(value);
          return true;
        } catch {
          throw new Error("Whitepaper URL must be a valid URL");
        }
      }
      return true;
    }),
  body("thumbnail")
    .optional()
    .custom((value) => {
      if (value && value.trim() !== "") {
        try {
          new URL(value);
          return true;
        } catch {
          throw new Error("Thumbnail URL must be a valid URL");
        }
      }
      return true;
    }),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("tags.*")
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be between 1 and 50 characters"),
];

const getProjectIdeasSchema = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("status")
    .optional()
    .custom((value) => {
      const validStatuses = [
        "idea",
        "reviewing",
        "rejected",
        "validated",
        "campaigning",
        "live",
        "completed",
      ];
      if (Array.isArray(value)) {
        return value.every((status) => validStatuses.includes(status));
      }
      return validStatuses.includes(value);
    })
    .withMessage("Invalid status value"),
  query("type")
    .optional()
    .isIn(["crowdfund", "grant"])
    .withMessage("Type must be either 'crowdfund' or 'grant'"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "votes", "title"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),
];

const projectIdSchema = [
  param("id").isMongoId().withMessage("Invalid project ID format"),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     ProjectIdea:
 *       type: object
 *       required:
 *         - title
 *         - type
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the project
 *         title:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           description: Project title
 *           example: "Revolutionary DeFi Platform"
 *         summary:
 *           type: string
 *           maxLength: 500
 *           description: Brief project summary
 *           example: "A decentralized finance platform that revolutionizes lending"
 *         type:
 *           type: string
 *           enum: [crowdfund, grant]
 *           description: Project type
 *           example: "crowdfund"
 *         category:
 *           type: string
 *           maxLength: 50
 *           description: Project category
 *           example: "DeFi"
 *         status:
 *           type: string
 *           enum: [idea, reviewing, rejected, validated, campaigning, live, completed]
 *           description: Current project status
 *           example: "idea"
 *         whitepaperUrl:
 *           type: string
 *           format: uri
 *           description: URL to project whitepaper
 *           example: "https://example.com/whitepaper.pdf"
 *         pitchVideoUrl:
 *           type: string
 *           format: uri
 *           description: URL to project pitch video
 *           example: "https://youtube.com/watch?v=example"
 *         votes:
 *           type: number
 *           minimum: 0
 *           description: Number of votes received
 *           example: 42
 *         owner:
 *           type: object
 *           description: Project owner information
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Project creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *
 *     Crowdfund:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the crowdfund
 *         projectId:
 *           type: string
 *           description: Associated project ID
 *         thresholdVotes:
 *           type: number
 *           minimum: 1
 *           maximum: 10000
 *           default: 100
 *           description: Minimum votes needed for validation
 *           example: 100
 *         voteDeadline:
 *           type: string
 *           format: date-time
 *           description: Voting deadline
 *         totalVotes:
 *           type: number
 *           minimum: 0
 *           description: Total votes received
 *           example: 75
 *         status:
 *           type: string
 *           enum: [pending, under_review, validated, rejected]
 *           description: Crowdfund status
 *           example: "pending"
 *         validatedAt:
 *           type: string
 *           format: date-time
 *           description: Validation timestamp
 *         rejectedReason:
 *           type: string
 *           maxLength: 500
 *           description: Reason for rejection
 *         isVotingActive:
 *           type: boolean
 *           description: Whether voting is still active
 *         voteProgress:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           description: Vote progress percentage
 *
 *     CreateProjectIdeaRequest:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         title:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           description: Project title
 *           example: "Revolutionary DeFi Platform"
 *         summary:
 *           type: string
 *           maxLength: 500
 *           description: Brief project summary
 *           example: "A decentralized finance platform that revolutionizes lending"
 *         type:
 *           type: string
 *           enum: [crowdfund, grant]
 *           default: "crowdfund"
 *           description: Project type
 *           example: "crowdfund"
 *         category:
 *           type: string
 *           maxLength: 50
 *           description: Project category
 *           example: "DeFi"
 *         whitepaperUrl:
 *           type: string
 *           format: uri
 *           description: URL to project whitepaper
 *           example: "https://example.com/whitepaper.pdf"
 *         pitchVideoUrl:
 *           type: string
 *           format: uri
 *           description: URL to project pitch video
 *           example: "https://youtube.com/watch?v=example"
 *
 *     ProjectIdeaResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             project:
 *               $ref: '#/components/schemas/ProjectIdea'
 *             crowdfund:
 *               $ref: '#/components/schemas/Crowdfund'
 *         message:
 *           type: string
 *           example: "Project idea created successfully"
 */

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new Project Idea
 *     description: Creates a new project idea that will receive feedback and votes before becoming a full campaign. Automatically creates an associated Crowdfund record for crowdfund-type projects.
 *     tags: [Project Ideas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProjectIdeaRequest'
 *           examples:
 *             crowdfund_project:
 *               summary: Crowdfund Project Example
 *               value:
 *                 title: "Revolutionary DeFi Platform"
 *                 summary: "A decentralized finance platform that revolutionizes lending and borrowing"
 *                 type: "crowdfund"
 *                 category: "DeFi"
 *                 whitepaperUrl: "https://example.com/whitepaper.pdf"
 *                 pitchVideoUrl: "https://youtube.com/watch?v=example"
 *             grant_project:
 *               summary: Grant Project Example
 *               value:
 *                 title: "Open Source Blockchain Tools"
 *                 summary: "Development of open source tools for blockchain developers"
 *                 type: "grant"
 *                 category: "Developer Tools"
 *     responses:
 *       201:
 *         description: Project idea created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectIdeaResponse'
 *             examples:
 *               success:
 *                 summary: Successful creation
 *                 value:
 *                   success: true
 *                   data:
 *                     project:
 *                       _id: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                       title: "Revolutionary DeFi Platform"
 *                       summary: "A decentralized finance platform that revolutionizes lending"
 *                       type: "crowdfund"
 *                       category: "DeFi"
 *                       status: "idea"
 *                       votes: 0
 *                       createdAt: "2024-01-15T10:30:00Z"
 *                     crowdfund:
 *                       _id: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                       thresholdVotes: 100
 *                       totalVotes: 0
 *                       status: "pending"
 *                       isVotingActive: true
 *                       voteProgress: 0
 *                   message: "Project idea created successfully"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Title is required"
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  protect,
  validateRequest(createProjectIdeaSchema),
  createProjectIdea,
);

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all project ideas with filtering and pagination
 *     description: Retrieves a paginated list of project ideas with optional filtering by status, type, category, and search functionality.
 *     tags: [Project Ideas]
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
 *           maximum: 50
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [idea, reviewing, rejected, validated, campaigning, live, completed]
 *         description: Filter by project status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [crowdfund, grant]
 *         description: Filter by project type
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category (case-insensitive partial match)
 *       - in: query
 *         name: creatorId
 *         schema:
 *           type: string
 *         description: Filter by creator ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, votes, title]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         description: Search in title, summary, and description
 *     responses:
 *       200:
 *         description: Project ideas retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ProjectIdea'
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
 *                     filters:
 *                       type: object
 *                       description: Applied filters
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */
router.get("/", validateRequest(getProjectIdeasSchema), getProjectIdeas);

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get a single project idea by ID
 *     description: Retrieves detailed information about a specific project idea, including associated crowdfund data if applicable.
 *     tags: [Project Ideas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project idea retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectIdeaResponse'
 *       400:
 *         description: Invalid project ID format
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", validateRequest(projectIdSchema), getProjectIdeaById);

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Update a project idea
 *     description: Updates a project idea. Only the project owner can update their project, and only when the project is in 'idea' or 'rejected' status.
 *     tags: [Project Ideas]
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
 *                 minLength: 3
 *                 maxLength: 100
 *               summary:
 *                 type: string
 *                 maxLength: 500
 *               category:
 *                 type: string
 *                 maxLength: 50
 *               whitepaperUrl:
 *                 type: string
 *                 format: uri
 *               pitchVideoUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Project idea updated successfully
 *       400:
 *         description: Validation error or invalid project status
 *       401:
 *         description: Unauthorized - Not the project owner
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id",
  protect,
  validateRequest([...projectIdSchema, ...updateProjectIdeaSchema]),
  updateProjectIdea,
);

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete a project idea
 *     description: Deletes a project idea and its associated crowdfund record. Only the project owner can delete their project, and only when the project is in 'idea' or 'rejected' status.
 *     tags: [Project Ideas]
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
 *         description: Project idea deleted successfully
 *       400:
 *         description: Invalid project ID or project status
 *       401:
 *         description: Unauthorized - Not the project owner
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id",
  protect,
  validateRequest(projectIdSchema),
  deleteProjectIdea,
);

export default router;
