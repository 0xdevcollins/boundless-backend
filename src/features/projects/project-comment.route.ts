import express from "express";
import {
  addProjectComment,
  getProjectComments,
  updateProjectComment,
  deleteProjectComment,
  reportProjectComment,
} from "./project-comment.controller";
import { protect } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for comment endpoints
const commentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 comments per windowMs
  message: {
    success: false,
    message: "Too many comment attempts, please try again later",
    error: "Rate limit exceeded",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const projectIdSchema = [
  param("id").isMongoId().withMessage("Invalid project ID format"),
];

const commentIdSchema = [
  param("commentId").isMongoId().withMessage("Invalid comment ID format"),
];

const addCommentSchema = [
  body("content")
    .notEmpty()
    .withMessage("Comment content is required")
    .isLength({ min: 1, max: 2000 })
    .withMessage("Comment content cannot exceed 2000 characters")
    .trim(),
  body("parentCommentId")
    .optional()
    .isMongoId()
    .withMessage("Invalid parent comment ID format"),
];

const updateCommentSchema = [
  body("content")
    .notEmpty()
    .withMessage("Comment content is required")
    .isLength({ min: 1, max: 2000 })
    .withMessage("Comment content must be between 1 and 2000 characters")
    .trim(),
];

const getCommentsSchema = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("parentCommentId")
    .optional()
    .isMongoId()
    .withMessage("Invalid parent comment ID format"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "totalReactions"])
    .withMessage(
      "Sort field must be one of: createdAt, updatedAt, totalReactions",
    ),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

const reportCommentSchema = [
  body("reason")
    .notEmpty()
    .withMessage("Report reason is required")
    .isIn(["spam", "inappropriate", "harassment", "misinformation", "other"])
    .withMessage("Invalid report reason"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters")
    .trim(),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     ProjectComment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the comment
 *         userId:
 *           type: object
 *           description: User who posted the comment
 *         projectId:
 *           type: string
 *           description: ID of the project being commented on
 *         content:
 *           type: string
 *           description: Comment content
 *         parentCommentId:
 *           type: string
 *           nullable: true
 *           description: ID of parent comment (for replies)
 *         status:
 *           type: string
 *           enum: [active, deleted, flagged, hidden]
 *           description: Comment status
 *         reactionCounts:
 *           type: object
 *           properties:
 *             LIKE:
 *               type: integer
 *             DISLIKE:
 *               type: integer
 *             HELPFUL:
 *               type: integer
 *         totalReactions:
 *           type: integer
 *           description: Total number of reactions
 *         replyCount:
 *           type: integer
 *           description: Number of replies (for top-level comments)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         isSpam:
 *           type: boolean
 *           description: Whether comment was flagged as spam
 *
 *     CommentRequest:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           minLength: 1
 *           maxLength: 2000
 *           description: Comment content
 *           example: "This is a great project idea! I'd love to contribute."
 *         parentCommentId:
 *           type: string
 *           description: ID of parent comment (for replies)
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *
 *     CommentResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             comment:
 *               $ref: '#/components/schemas/ProjectComment'
 *             moderationResult:
 *               type: object
 *               properties:
 *                 flagged:
 *                   type: boolean
 *                 reason:
 *                   type: string
 *                   nullable: true
 *         message:
 *           type: string
 *           example: "Comment added successfully"
 *
 *     ReportRequest:
 *       type: object
 *       required:
 *         - reason
 *       properties:
 *         reason:
 *           type: string
 *           enum: [spam, inappropriate, harassment, misinformation, other]
 *           description: Reason for reporting
 *           example: "spam"
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: Additional details about the report
 *           example: "This comment contains promotional content unrelated to the project"
 */

/**
 * @swagger
 * /api/projects/{id}/comments:
 *   post:
 *     summary: Add a comment to a project
 *     description: Add a new comment or reply to a project. Comments are automatically moderated for spam and inappropriate content.
 *     tags: [Project Comments]
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
 *             $ref: '#/components/schemas/CommentRequest'
 *           examples:
 *             top_level_comment:
 *               summary: Top-level comment
 *               value:
 *                 content: "This is a fantastic project idea! I'd love to see this implemented."
 *             reply_comment:
 *               summary: Reply to a comment
 *               value:
 *                 content: "I completely agree with your assessment."
 *                 parentCommentId: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentResponse'
 *             example:
 *               success: true
 *               data:
 *                 comment:
 *                   _id: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                   content: "This is a fantastic project idea!"
 *                   userId:
 *                     _id: "60f7b3b3b3b3b3b3b3b3b3b5"
 *                     profile:
 *                       firstName: "John"
 *                       lastName: "Doe"
 *                       username: "johndoe"
 *                   projectId: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                   parentCommentId: null
 *                   status: "active"
 *                   reactionCounts:
 *                     LIKE: 0
 *                     DISLIKE: 0
 *                     HELPFUL: 0
 *                   totalReactions: 0
 *                   createdAt: "2024-01-15T10:30:00Z"
 *                   updatedAt: "2024-01-15T10:30:00Z"
 *                   isSpam: false
 *                 moderationResult:
 *                   flagged: false
 *                   reason: null
 *               message: "Comment added successfully"
 *       400:
 *         description: Bad request (validation errors, project not commentable, etc.)
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Project or parent comment not found
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post(
  "/:id/comments",
  commentRateLimit,
  protect,
  validateRequest([...projectIdSchema, ...addCommentSchema]),
  addProjectComment,
);

/**
 * @swagger
 * /api/projects/{id}/comments:
 *   get:
 *     summary: Get comments for a project
 *     description: Retrieve paginated list of comments for a project. Can filter by parent comment to get replies.
 *     tags: [Project Comments]
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
 *           default: 10
 *         description: Number of comments per page
 *       - in: query
 *         name: parentCommentId
 *         schema:
 *           type: string
 *         description: Filter by parent comment ID (get replies)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, totalReactions]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
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
 *                     comments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ProjectComment'
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
 *                       properties:
 *                         parentCommentId:
 *                           type: string
 *                           nullable: true
 *                         sortBy:
 *                           type: string
 *                         sortOrder:
 *                           type: string
 *       400:
 *         description: Invalid request parameters
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:id/comments",
  validateRequest([...projectIdSchema, ...getCommentsSchema]),
  getProjectComments,
);

/**
 * @swagger
 * /api/projects/{id}/comments/{commentId}:
 *   put:
 *     summary: Update a comment
 *     description: Update a comment's content. Only the comment author can update their comment, and only within 24 hours of posting.
 *     tags: [Project Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 description: Updated comment content
 *                 example: "This is my updated comment with additional thoughts."
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentResponse'
 *       400:
 *         description: Bad request (validation errors, edit time limit exceeded, etc.)
 *       401:
 *         description: Unauthorized - Not the comment author
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Internal server error
 */
router.put(
  "/:id/comments/:commentId",
  commentRateLimit,
  protect,
  validateRequest([
    ...projectIdSchema,
    ...commentIdSchema,
    ...updateCommentSchema,
  ]),
  updateProjectComment,
);

/**
 * @swagger
 * /api/projects/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     description: Soft delete a comment. Only the comment author can delete their comment. The comment content is replaced with a deletion message.
 *     tags: [Project Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: null
 *                 message:
 *                   type: string
 *                   example: "Comment deleted successfully"
 *       401:
 *         description: Unauthorized - Not the comment author
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:id/comments/:commentId",
  protect,
  validateRequest([...projectIdSchema, ...commentIdSchema]),
  deleteProjectComment,
);

/**
 * @swagger
 * /api/projects/{id}/comments/{commentId}/report:
 *   post:
 *     summary: Report a comment
 *     description: Report a comment for inappropriate content, spam, harassment, etc. Comments with multiple reports are automatically flagged for review.
 *     tags: [Project Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReportRequest'
 *           examples:
 *             spam_report:
 *               summary: Report spam
 *               value:
 *                 reason: "spam"
 *                 description: "This comment contains promotional content unrelated to the project"
 *             harassment_report:
 *               summary: Report harassment
 *               value:
 *                 reason: "harassment"
 *                 description: "This comment contains personal attacks against other users"
 *     responses:
 *       200:
 *         description: Comment reported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: null
 *                 message:
 *                   type: string
 *                   example: "Comment reported successfully"
 *       400:
 *         description: Bad request (already reported, invalid reason, etc.)
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/:id/comments/:commentId/report",
  protect,
  validateRequest([
    ...projectIdSchema,
    ...commentIdSchema,
    ...reportCommentSchema,
  ]),
  reportProjectComment,
);

export default router;
