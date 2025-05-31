import { Router } from "express";
import adminController from "../controllers/admin.controller";

const router = Router();

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: List all reported content
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewed, resolved, dismissed]
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/reports", adminController.getReports);

/**
 * @swagger
 * /api/admin/reports/{id}:
 *   put:
 *     summary: Handle reported content
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, reviewed, resolved, dismissed]
 *               actionTaken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report updated successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.put("/reports/:id", adminController.handleReport);

/**
 * @swagger
 * /api/admin/comments:
 *   get:
 *     summary: List flagged comments
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [flagged, hidden]
 *     responses:
 *       200:
 *         description: Flagged comments retrieved successfully
 *       500:
 *         description: Server error
 */
router.get("/comments", adminController.getFlaggedComments);

/**
 * @swagger
 * /api/admin/comments/{id}:
 *   delete:
 *     summary: Remove inappropriate comments
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       400:
 *         description: Invalid comment ID
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Server error
 */
router.delete("/comments/:id", adminController.deleteComment);

/**
 * @swagger
 * /api/admin/content/flag:
 *   post:
 *     summary: Flag content for review
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *               - contentType
 *               - reason
 *             properties:
 *               contentId:
 *                 type: string
 *               contentType:
 *                 type: string
 *                 enum: [comment, project, user]
 *               reason:
 *                 type: string
 *                 enum: [spam, harassment, inappropriate, copyright, other]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Content flagged successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.post("/content/flag", adminController.flagContent);

export default router;
