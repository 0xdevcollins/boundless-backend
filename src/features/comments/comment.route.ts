import express from "express";
import { protect } from "../../middleware/better-auth.middleware";
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  reportComment,
} from "./comment.controller";
import * as reactionController from "./reaction.controller";

const router = express.Router();

/**
 * @swagger
 * /projects/{id}/comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 description: Comment content
 *               parentCommentId:
 *                 type: string
 *                 description: ID of the parent comment for replies
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post("/projects/:id/comments", protect, createComment);

/**
 * @swagger
 * /projects/{id}/comments:
 *   get:
 *     summary: Get comments for a project
 *     tags: [Comments]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - name: parentId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter comments by parent ID
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           enum: [createdAt, -createdAt, updatedAt, -updatedAt, reactionCounts.LIKE, -reactionCounts.LIKE]
 *           default: -createdAt
 *         description: Sort field and direction
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Comment'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get("/projects/:id/comments", getComments);

/**
 * @swagger
 * /projects/{id}/comments/{commentId}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - name: commentId
 *         in: path
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
 *                 maxLength: 5000
 *                 description: Updated comment content
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Not authorized to update this comment
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.put("/projects/:id/comments/:commentId", protect, updateComment);

/**
 * @swagger
 * /projects/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - name: commentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       403:
 *         description: Not authorized to delete this comment
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.delete("/projects/:id/comments/:commentId", protect, deleteComment);

/**
 * @swagger
 * /projects/{id}/comments/{commentId}/report:
 *   post:
 *     summary: Report a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - name: commentId
 *         in: path
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for reporting
 *               description:
 *                 type: string
 *                 description: Additional details about the report
 *     responses:
 *       200:
 *         description: Comment reported successfully
 *       400:
 *         description: Already reported this comment
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.post("/projects/:id/comments/:commentId/report", protect, reportComment);

/**
 * @swagger
 * /projects/{id}/comments/{commentId}/reactions:
 *   post:
 *     summary: Add a reaction to a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - name: commentId
 *         in: path
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
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [LIKE, DISLIKE, HELPFUL, SPAM]
 *                 description: Type of reaction
 *     responses:
 *       200:
 *         description: Reaction added successfully
 *       400:
 *         description: Invalid reaction type
 *       500:
 *         description: Server error
 */
router.post(
  "/projects/:id/comments/:commentId/reactions",
  protect,
  reactionController.addReaction,
);

/**
 * @swagger
 * /projects/{id}/comments/{commentId}/reactions:
 *   delete:
 *     summary: Remove a reaction from a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - name: commentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Reaction removed successfully
 *       404:
 *         description: Reaction not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/projects/:id/comments/:commentId/reactions",
  protect,
  reactionController.removeReaction,
);

/**
 * @swagger
 * /projects/{id}/comments/{commentId}/reactions:
 *   get:
 *     summary: Get reactions for a comment
 *     tags: [Comments]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - name: commentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of reactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Reaction'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get(
  "/projects/:id/comments/:commentId/reactions",
  reactionController.getReactions,
);

export default router;
