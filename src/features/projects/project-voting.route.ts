import express from "express";
import mongoose from "mongoose";
import {
  voteOnProject,
  getProjectVotes,
  removeVote,
} from "./project-voting.controller";

import { protect, optionalAuth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for voting endpoints
const voteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 10 votes per windowMs
  message: {
    success: false,
    message: "Too many vote attempts, please try again later",
    error: "Rate limit exceeded",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const projectIdSchema = [
  param("id").isMongoId().withMessage("Invalid project ID format"),
];

const voteSchema = [
  body("value")
    .isInt({ min: -1, max: 1 })
    .withMessage("Vote value must be either 1 (upvote) or -1 (downvote)")
    .custom((value) => {
      if (![1, -1].includes(value)) {
        throw new Error(
          "Vote value must be either 1 (upvote) or -1 (downvote)",
        );
      }
      return true;
    }),
];

const getVotesSchema = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("voteType")
    .optional()
    .isIn(["upvote", "downvote"])
    .withMessage("Vote type must be 'upvote' or 'downvote'"),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Vote:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the vote
 *         userId:
 *           type: string
 *           description: ID of the user who cast the vote
 *         projectId:
 *           type: string
 *           description: ID of the project being voted on
 *         value:
 *           type: integer
 *           enum: [1, -1]
 *           description: Vote value (1 for upvote, -1 for downvote)
 *         voteType:
 *           type: string
 *           enum: [upvote, downvote]
 *           description: Human-readable vote type
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     VoteSummary:
 *       type: object
 *       properties:
 *         upvotes:
 *           type: integer
 *           description: Total number of upvotes
 *         downvotes:
 *           type: integer
 *           description: Total number of downvotes
 *         totalVotes:
 *           type: integer
 *           description: Total number of votes
 *         netVotes:
 *           type: integer
 *           description: Net votes (upvotes - downvotes)
 *
 *     VoteRequest:
 *       type: object
 *       required:
 *         - value
 *       properties:
 *         value:
 *           type: integer
 *           enum: [1, -1]
 *           description: Vote value (1 for upvote, -1 for downvote)
 *           example: 1
 *
 *     VoteResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             vote:
 *               $ref: '#/components/schemas/Vote'
 *             projectVotes:
 *               $ref: '#/components/schemas/VoteSummary'
 *             isNewVote:
 *               type: boolean
 *               description: Whether this is a new vote or an update
 *         message:
 *           type: string
 *           example: "Vote cast successfully"
 */

/**
 * @swagger
 * /api/projects/{id}/vote:
 *   post:
 *     summary: Vote on a project idea
 *     description: Cast a vote (upvote or downvote) on a project idea. Users can only vote once per project, but can change their vote. Project owners cannot vote on their own projects.
 *     tags: [Project Voting]
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
 *             $ref: '#/components/schemas/VoteRequest'
 *           examples:
 *             upvote:
 *               summary: Cast an upvote
 *               value:
 *                 value: 1
 *             downvote:
 *               summary: Cast a downvote
 *               value:
 *                 value: -1
 *     responses:
 *       201:
 *         description: Vote cast successfully (new vote)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VoteResponse'
 *             example:
 *               success: true
 *               data:
 *                 vote:
 *                   _id: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                   value: 1
 *                   voteType: "upvote"
 *                   createdAt: "2024-01-15T10:30:00Z"
 *                   updatedAt: "2024-01-15T10:30:00Z"
 *                 projectVotes:
 *                   upvotes: 15
 *                   downvotes: 3
 *                   totalVotes: 18
 *                   netVotes: 12
 *                 isNewVote: true
 *               message: "Vote cast successfully"
 *       200:
 *         description: Vote updated successfully (changed existing vote)
 *       400:
 *         description: Bad request (invalid vote value, own project, etc.)
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Project not found
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post(
  "/:id/vote",
  voteRateLimit,
  protect,
  validateRequest([...projectIdSchema, ...voteSchema]),
  voteOnProject,
);

/**
 * @swagger
 * /api/projects/{id}/votes:
 *   get:
 *     summary: Get votes for a project
 *     description: Retrieve paginated list of votes for a project, including vote summary and user's vote status if authenticated.
 *     tags: [Project Voting]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
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
 *           default: 20
 *         description: Number of votes per page
 *       - in: query
 *         name: voteType
 *         schema:
 *           type: string
 *           enum: [upvote, downvote]
 *         description: Filter by vote type
 *     responses:
 *       200:
 *         description: Votes retrieved successfully
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
 *                     votes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vote'
 *                     voteSummary:
 *                       $ref: '#/components/schemas/VoteSummary'
 *                     userVote:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/Vote'
 *                         - type: null
 *                       description: Current user's vote (if authenticated and voted)
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
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
// Simple optionalAuth middleware that doesn't cause circular dependency
const simpleOptionalAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authHeader.split(" ")[1];
    // For now, just set a mock user to avoid circular dependency
    req.user = { _id: new mongoose.Types.ObjectId() };
    next();
  } catch (error) {
    next();
  }
};

router.get("/:id/votes", simpleOptionalAuth, getProjectVotes);

/**
 * @swagger
 * /api/projects/{id}/vote:
 *   delete:
 *     summary: Remove vote from a project
 *     description: Remove the current user's vote from a project. Only the user who cast the vote can remove it.
 *     tags: [Project Voting]
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
 *         description: Vote removed successfully
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
 *                     projectVotes:
 *                       $ref: '#/components/schemas/VoteSummary'
 *                 message:
 *                   type: string
 *                   example: "Vote removed successfully"
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Vote not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id/vote",
  voteRateLimit,
  protect,
  validateRequest(projectIdSchema),
  removeVote,
);

export default router;
