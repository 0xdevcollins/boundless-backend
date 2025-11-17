import express from "express";
import { protect } from "../../middleware/better-auth.middleware.js";
import waitlistController, {
  validateSubscribe,
} from "./waitlist.controller.js";

const router = express.Router();

/**
 * @route   POST /api/waitlist/subscribe
 * @desc    Subscribe to waitlist
 * @access  Public
 */
router.post("/subscribe", validateSubscribe, waitlistController.subscribe);

/**
 * @route   GET /api/waitlist/unsubscribe/:token
 * @desc    Unsubscribe from waitlist
 * @access  Public
 */
router.get("/unsubscribe/:token", waitlistController.unsubscribe);

/**
 * @route   GET /api/waitlist/stats
 * @desc    Get waitlist statistics
 * @access  Public
 */
router.get("/stats", waitlistController.getStats);

/**
 * @route   GET /api/waitlist/subscribers
 * @desc    Get waitlist subscribers with pagination and filtering
 * @access  Private (Admin)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20, max: 100)
 * @query   status - Filter by status (ACTIVE, UNSUBSCRIBED, BOUNCED, SPAM)
 * @query   tag - Filter by tag
 * @query   search - Search in email, firstName, lastName
 */
router.get("/subscribers", protect, waitlistController.getSubscribers);

/**
 * @route   POST /api/waitlist/subscribers/:id/tags
 * @desc    Add tags to subscriber
 * @access  Private (Admin)
 * @body    tags - Array of tags to add
 */
router.post("/subscribers/:id/tags", protect, waitlistController.addTags);

/**
 * @route   DELETE /api/waitlist/subscribers/:id/tags
 * @desc    Remove tags from subscriber
 * @access  Private (Admin)
 * @body    tags - Array of tags to remove
 */
router.delete("/subscribers/:id/tags", protect, waitlistController.removeTags);

/**
 * @route   GET /api/waitlist/export
 * @desc    Export subscribers for email campaigns
 * @access  Private (Admin)
 * @query   status - Filter by status
 * @query   tags - Comma-separated list of tags to filter by
 */
router.get("/export", protect, waitlistController.exportSubscribers);

/**
 * @route   POST /api/waitlist/webhook/bounce
 * @desc    Webhook for handling bounced emails from email service
 * @access  Public (from email service)
 * @body    email - Email address that bounced
 */
router.post("/webhook/bounce", waitlistController.handleBounce);

/**
 * @route   POST /api/waitlist/webhook/spam
 * @desc    Webhook for handling spam reports from email service
 * @access  Public (from email service)
 * @body    email - Email address reported as spam
 */
router.post("/webhook/spam", waitlistController.handleSpam);

export default router;
