import express from "express";
import notificationController from "../controllers/notification.controller";

const router = express.Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       500:
 *         description: Internal server error
 */
router.get("/", notificationController.getNotifications);

/**
 * @swagger
 * /notifications/read:
 *   put:
 *     summary: Mark notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of notification IDs to mark as read
 *               all:
 *                 type: boolean
 *                 description: Mark all notifications as read
 *     responses:
 *       200:
 *         description: Notifications marked as read successfully
 *       500:
 *         description: Internal server error
 */
router.put("/read", notificationController.markAsRead);

/**
 * @swagger
 * /notifications/preference:
 *   put:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: boolean
 *                 description: Enable/disable email notifications
 *               push:
 *                 type: boolean
 *                 description: Enable/disable push notifications
 *               inApp:
 *                 type: boolean
 *                 description: Enable/disable in-app notifications
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 *       500:
 *         description: Internal server error
 */
router.put("/preference", notificationController.updatePreference);

export default router;
