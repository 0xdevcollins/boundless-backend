import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import WaitlistService, {
  CreateWaitlistData,
} from "../services/waitlist.service";
import {
  sendCreated,
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
  sendInternalServerError,
} from "../utils/apiResponse";

/**
 * @route   POST /api/waitlist/subscribe
 * @desc    Subscribe to waitlist
 * @access  Public
 */
export const subscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendBadRequest(
        res,
        "Validation failed",
        errors
          .array()
          .map((e) => e.msg)
          .join(", "),
      );
      return;
    }

    const { email, firstName, lastName, source, referrer, tags } = req.body;

    const waitlistData: CreateWaitlistData = {
      email,
      firstName,
      lastName,
      source,
      referrer,
      metadata: {
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"],
        utmSource: req.query.utm_source as string,
        utmMedium: req.query.utm_medium as string,
        utmCampaign: req.query.utm_campaign as string,
      },
      tags,
    };

    const subscriber = await WaitlistService.subscribe(waitlistData, req);

    sendCreated(
      res,
      {
        message: "Successfully subscribed to waitlist! Welcome to Boundless!",
        subscriber: {
          id: subscriber._id,
          email: subscriber.email,
          firstName: subscriber.firstName,
          lastName: subscriber.lastName,
          status: subscriber.status,
        },
      },
      "Successfully subscribed to waitlist",
    );
  } catch (error: any) {
    console.error("Waitlist subscription error:", error);

    if (error.message === "Email already subscribed to waitlist") {
      sendError(res, "Email already subscribed to waitlist", 409);
      return;
    }
    // Check for validation errors
    if (error.name === "ValidationError") {
      sendError(res, "Validation error", 400, error.message);
      return;
    }

    sendInternalServerError(res, "Error subscribing to waitlist");
  }
};

/**
 * @route   GET /api/waitlist/unsubscribe/:token
 * @desc    Unsubscribe from waitlist
 * @access  Public
 */
export const unsubscribe = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      sendBadRequest(res, "Unsubscribe token is required");
      return;
    }

    const subscriber = await WaitlistService.unsubscribe(token);

    sendSuccess(
      res,
      {
        message: "Successfully unsubscribed from waitlist",
        subscriber: {
          id: subscriber._id,
          email: subscriber.email,
          firstName: subscriber.firstName,
          lastName: subscriber.lastName,
          status: subscriber.status,
        },
      },
      "Successfully unsubscribed",
    );
  } catch (error: any) {
    console.error("Waitlist unsubscribe error:", error);

    if (error.message === "Invalid unsubscribe token") {
      sendNotFound(res, "Invalid unsubscribe token");
      return;
    }

    if (error.message === "Already unsubscribed") {
      sendError(res, "Already unsubscribed", 409);
      return;
    }

    sendInternalServerError(res, "Error unsubscribing from waitlist");
  }
};

/**
 * @route   GET /api/waitlist/stats
 * @desc    Get waitlist statistics
 * @access  Public
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await WaitlistService.getStats();

    sendSuccess(res, { stats }, "Waitlist statistics retrieved successfully");
  } catch (error) {
    console.error("Error getting waitlist stats:", error);
    sendInternalServerError(res, "Error retrieving waitlist statistics");
  }
};

/**
 * @route   GET /api/waitlist/subscribers
 * @desc    Get waitlist subscribers (admin only)
 * @access  Private (Admin)
 */
export const getSubscribers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as any;
    const tag = req.query.tag as string;
    const search = req.query.search as string;

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      sendBadRequest(res, "Invalid pagination parameters");
      return;
    }

    const result = await WaitlistService.getSubscribers(
      page,
      limit,
      status,
      tag,
      search,
    );

    sendSuccess(
      res,
      {
        subscribers: result.subscribers.map((sub) => ({
          id: sub._id,
          email: sub.email,
          firstName: sub.firstName,
          lastName: sub.lastName,
          status: sub.status,
          subscribedAt: sub.subscribedAt,
          tags: sub.tags,
          emailCount: sub.emailCount,
          lastEmailSentAt: sub.lastEmailSentAt,
        })),
        pagination: {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
      "Subscribers retrieved successfully",
    );
  } catch (error) {
    console.error("Error getting subscribers:", error);
    sendInternalServerError(res, "Error retrieving subscribers");
  }
};

/**
 * @route   POST /api/waitlist/subscribers/:id/tags
 * @desc    Add tags to subscriber (admin only)
 * @access  Private (Admin)
 */
export const addTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      sendBadRequest(res, "Tags array is required");
      return;
    }

    const subscriber = await WaitlistService.addTags(id, tags);

    sendSuccess(
      res,
      {
        message: "Tags added successfully",
        subscriber: {
          id: subscriber._id,
          email: subscriber.email,
          tags: subscriber.tags,
        },
      },
      "Tags added successfully",
    );
  } catch (error: any) {
    console.error("Error adding tags:", error);

    if (error.message === "Subscriber not found") {
      sendNotFound(res, "Subscriber not found");
      return;
    }

    sendInternalServerError(res, "Error adding tags");
  }
};

/**
 * @route   DELETE /api/waitlist/subscribers/:id/tags
 * @desc    Remove tags from subscriber (admin only)
 * @access  Private (Admin)
 */
export const removeTags = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      sendBadRequest(res, "Tags array is required");
      return;
    }

    const subscriber = await WaitlistService.removeTags(id, tags);

    sendSuccess(
      res,
      {
        message: "Tags removed successfully",
        subscriber: {
          id: subscriber._id,
          email: subscriber.email,
          tags: subscriber.tags,
        },
      },
      "Tags removed successfully",
    );
  } catch (error: any) {
    console.error("Error removing tags:", error);

    if (error.message === "Subscriber not found") {
      sendNotFound(res, "Subscriber not found");
      return;
    }

    sendInternalServerError(res, "Error removing tags");
  }
};

/**
 * @route   GET /api/waitlist/export
 * @desc    Export subscribers for email campaigns (admin only)
 * @access  Private (Admin)
 */
export const exportSubscribers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const status = req.query.status as any;
    const tags = req.query.tags
      ? (req.query.tags as string).split(",")
      : undefined;

    const subscribers = await WaitlistService.exportSubscribers(status, tags);

    // Set headers for CSV download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="waitlist-export-${new Date().toISOString().split("T")[0]}.csv"`,
    );

    // Create CSV content
    const csvHeader = "Email,First Name,Last Name,Status,Subscribed At,Tags\n";
    const csvContent = subscribers
      .map(
        (sub) =>
          `"${sub.email}","${sub.firstName || ""}","${sub.lastName || ""}","${sub.status}","${sub.subscribedAt.toISOString()}","${(sub.tags || []).join(";")}"`,
      )
      .join("\n");

    res.send(csvHeader + csvContent);
  } catch (error) {
    console.error("Error exporting subscribers:", error);
    sendInternalServerError(res, "Error exporting subscribers");
  }
};

/**
 * @route   POST /api/waitlist/webhook/bounce
 * @desc    Webhook for handling bounced emails
 * @access  Public (from email service)
 */
export const handleBounce = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      sendBadRequest(res, "Email is required");
      return;
    }

    await WaitlistService.markAsBounced(email);

    sendSuccess(
      res,
      { message: "Email marked as bounced" },
      "Bounce handled successfully",
    );
  } catch (error) {
    console.error("Error handling bounce:", error);
    sendInternalServerError(res, "Error handling bounce");
  }
};

/**
 * @route   POST /api/waitlist/webhook/spam
 * @desc    Webhook for handling spam reports
 * @access  Public (from email service)
 */
export const handleSpam = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      sendBadRequest(res, "Email is required");
      return;
    }

    await WaitlistService.markAsSpam(email);

    sendSuccess(
      res,
      { message: "Email marked as spam" },
      "Spam report handled successfully",
    );
  } catch (error) {
    console.error("Error handling spam report:", error);
    sendInternalServerError(res, "Error handling spam report");
  }
};

// Validation middleware for subscribe endpoint
export const validateSubscribe = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("firstName")
    .optional()
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage("First name must be between 1 and 50 characters"),
  body("lastName")
    .optional({ checkFalsy: true })
    .isLength({ max: 50 })
    .trim()
    .withMessage("Last name must be 50 characters or fewer"),
  body("source")
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage("Source must be between 1 and 100 characters"),
  body("referrer")
    .optional()
    .isLength({ min: 1, max: 500 })
    .trim()
    .withMessage("Referrer must be between 1 and 500 characters"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("tags.*")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each tag must be between 1 and 50 characters"),
];

export default {
  subscribe,
  unsubscribe,
  getStats,
  getSubscribers,
  addTags,
  removeTags,
  exportSubscribers,
  handleBounce,
  handleSpam,
  validateSubscribe,
};
