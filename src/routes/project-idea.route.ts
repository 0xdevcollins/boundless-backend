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
  body("milestones")
    .optional()
    .isArray()
    .withMessage("Milestones must be an array"),
  body("milestones.*.title")
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage("Milestone title is required and must be a string"),
  body("milestones.*.description")
    .optional()
    .isString()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Milestone description is required and must be a string"),
  body("milestones.*.deliveryDate")
    .optional()
    .isISO8601()
    .withMessage("Milestone deliveryDate must be a valid date (YYYY-MM-DD)"),
  body("milestones.*.fundPercentage")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Milestone fundPercentage must be between 0 and 100"),
  body("milestones.*.fundAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Milestone fundAmount must be a non-negative number"),
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
 *         - description
 *         - category
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
 *         tagline:
 *           type: string
 *           maxLength: 200
 *           description: Short one-liner description
 *           example: "Revolutionizing DeFi lending"
 *         description:
 *           type: string
 *           minLength: 10
 *           maxLength: 2000
 *           description: Detailed project description
 *           example: "A decentralized finance platform that revolutionizes lending and borrowing through innovative smart contracts and user-friendly interfaces."
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
 *         thumbnail:
 *           type: string
 *           format: uri
 *           description: URL to project thumbnail image
 *           example: "https://example.com/thumbnail.jpg"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of tags for the project
 *           example: ["DeFi", "Lending", "Smart Contracts"]
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
 *         - description
 *         - category
 *       properties:
 *         title:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           description: Project title
 *           example: "Revolutionary DeFi Platform"
 *         description:
 *           type: string
 *           minLength: 10
 *           maxLength: 2000
 *           description: Detailed project description
 *           example: "A decentralized finance platform that revolutionizes lending and borrowing through innovative smart contracts and user-friendly interfaces."
 *         tagline:
 *           type: string
 *           maxLength: 200
 *           description: Short one-liner description
 *           example: "Revolutionizing DeFi lending"
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
 *         fundAmount:
 *           type: number
 *           minimum: 0
 *           description: Funding goal amount
 *           example: 50000
 *         whitepaperUrl:
 *           type: string
 *           format: uri
 *           description: URL to project whitepaper
 *           example: "https://example.com/whitepaper.pdf"
 *         thumbnail:
 *           type: string
 *           format: uri
 *           description: URL to project thumbnail image
 *           example: "https://example.com/thumbnail.jpg"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *             minLength: 1
 *             maxLength: 50
 *           description: Array of tags for the project
 *           example: ["DeFi", "Lending", "Smart Contracts"]
 *         milestones:
 *           type: array
 *           description: Milestones for the project idea
 *           items:
 *             type: object
 *             required: [title, description, deliveryDate, fundAmount]
 *             properties:
 *               title:
 *                 type: string
 *                 description: Milestone title
 *               description:
 *                 type: string
 *                 description: Milestone description
 *               deliveryDate:
 *                 type: string
 *                 format: date
 *                 description: Expected delivery date (YYYY-MM-DD)
 *               fundPercentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Percentage of total funds allocated to this milestone
 *               fundAmount:
 *                 type: number
 *                 minimum: 0
 *                 description: Amount allocated to this milestone
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
 *                 description: "A decentralized finance platform that revolutionizes lending and borrowing through innovative smart contracts and user-friendly interfaces."
 *                 tagline: "Revolutionizing DeFi lending"
 *                 type: "crowdfund"
 *                 category: "DeFi"
 *                 fundAmount: 50000
 *                 whitepaperUrl: "https://example.com/whitepaper.pdf"
 *                 thumbnail: "https://example.com/thumbnail.jpg"
 *                 tags: ["DeFi", "Lending", "Smart Contracts"]
 *                 milestones:
 *                   - title: "MVP Delivery"
 *                     description: "Deliver the minimum viable product"
 *                     deliveryDate: "2025-03-01"
 *                     fundPercentage: 40
 *                     fundAmount: 20000
 *                   - title: "Public Launch"
 *                     description: "Launch to the public with marketing"
 *                     deliveryDate: "2025-06-01"
 *                     fundPercentage: 60
 *                     fundAmount: 30000
 *             grant_project:
 *               summary: Grant Project Example
 *               value:
 *                 title: "Open Source Blockchain Tools"
 *                 description: "Development of open source tools for blockchain developers to accelerate the adoption of blockchain technology."
 *                 tagline: "Empowering blockchain developers"
 *                 type: "grant"
 *                 category: "Developer Tools"
 *                 fundAmount: 25000
 *                 whitepaperUrl: "https://example.com/tools-whitepaper.pdf"
 *                 thumbnail: "https://example.com/tools-thumbnail.jpg"
 *                 tags: ["Developer Tools", "Open Source", "Blockchain"]
 *                 milestones:
 *                   - title: "Research Phase"
 *                     description: "Complete initial research and planning"
 *                     deliveryDate: "2025-02-15"
 *                     fundPercentage: 20
 *                     fundAmount: 5000
 *                   - title: "Prototype"
 *                     description: "Build a working prototype"
 *                     deliveryDate: "2025-04-15"
 *                     fundPercentage: 40
 *                     fundAmount: 10000
 *                   - title: "Documentation & Release"
 *                     description: "Complete docs and publish release"
 *                     deliveryDate: "2025-06-15"
 *                     fundPercentage: 40
 *                     fundAmount: 10000
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
 *                       tagline: "Revolutionizing DeFi lending"
 *                       description: "A decentralized finance platform that revolutionizes lending and borrowing through innovative smart contracts and user-friendly interfaces."
 *                       type: "crowdfund"
 *                       category: "DeFi"
 *                       status: "idea"
 *                       whitepaperUrl: "https://example.com/whitepaper.pdf"
 *                       thumbnail: "https://example.com/thumbnail.jpg"
 *                       tags: ["DeFi", "Lending", "Smart Contracts"]
 *                       votes: 0
 *                       owner:
 *                         type: "60f7b3b3b3b3b3b3b3b3b3b5"
 *                         ref: "User"
 *                       createdAt: "2024-01-15T10:30:00Z"
 *                       updatedAt: "2024-01-15T10:30:00Z"
 *                     crowdfund:
 *                       _id: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                       thresholdVotes: 100
 *                       voteDeadline: "2024-02-14T10:30:00Z"
 *                       totalVotes: 0
 *                       status: "pending"
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
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *               tagline:
 *                 type: string
 *                 maxLength: 200
 *               category:
 *                 type: string
 *                 maxLength: 50
 *               fundAmount:
 *                 type: number
 *                 minimum: 0
 *               whitepaperUrl:
 *                 type: string
 *                 format: uri
 *               thumbnail:
 *                 type: string
 *                 format: uri
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
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
