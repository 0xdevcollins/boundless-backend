import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import NewsletterService from "../services/newsletter.service";
import { sendCreated, sendBadRequest, sendError } from "../utils/apiResponse";
import {
  detectSourceFromRequest,
  SOURCE_CONFIGS,
} from "../utils/sourceDetector.utils";

/**
 * @route   POST /api/newsletter/subscribe
 * @desc    Subscribe to newsletter
 * @access  Public
 */
export const subscribe = async (req: Request, res: Response): Promise<void> => {
  try {
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

    const { email, name, source } = req.body;

    // Auto-detect source if not provided
    const detectedSource =
      source || detectSourceFromRequest(req, SOURCE_CONFIGS.NEWSLETTER);

    const subscriptionData = {
      email: email.toLowerCase().trim(),
      ...(name && { name: name.trim() }),
      ...(detectedSource && { source: detectedSource }),
      metadata: {
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"] || "Unknown",
      },
    };

    const subscriber = await NewsletterService.subscribe(subscriptionData);

    sendCreated(res, {
      message: "Successfully subscribed to newsletter",
      subscriber: {
        id: subscriber._id,
        email: subscriber.email,
        ...(subscriber.name && { name: subscriber.name }),
        ...(subscriber.source && { source: subscriber.source }),
        subscribedAt: subscriber.subscribedAt,
      },
    });
  } catch (error: any) {
    console.error("Newsletter subscription error:", {
      error: error.message,
      email: req.body?.email,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    if (error.message === "Email already subscribed") {
      sendError(res, "Email already subscribed", 409);
      return;
    }

    if (error.message === "Failed to subscribe to newsletter") {
      sendError(res, "Unable to process subscription at this time", 500);
      return;
    }

    sendError(
      res,
      "Error subscribing to newsletter",
      500,
      "Internal server error",
    );
  }
};

export const validateSubscribe = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email address is required")
    .isLength({ max: 254 })
    .withMessage("Email must be <= 254 characters"),
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1-100 characters")
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage(
      "Name can only contain letters, spaces, hyphens, apostrophes, and periods",
    ),
  body("source")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Source must be <= 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "Source can only contain alphanumeric characters, spaces, hyphens, and underscores",
    ),
];

export default { subscribe, validateSubscribe };
