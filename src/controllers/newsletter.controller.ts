import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import NewsletterService from "../services/newsletter.service";
import { sendCreated, sendBadRequest, sendError } from "../utils/apiResponse";

/**
 * @route   POST /api/newsletter/subscribe
 * @desc    Subscribe to newsletter
 * @access  Public
 */
export const subscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validation errors
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

    const { email, source } = req.body;

    const subscriber = await NewsletterService.subscribe({
      email,
      source,
      metadata: {
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
    });

    sendCreated(res, {
      message: "Successfully subscribed to newsletter",
      subscriber: {
        id: subscriber._id,
        email: subscriber.email,
        source: subscriber.source,
      },
    });
  } catch (error: any) {
    if (error.message === "Email already subscribed") {
      sendError(res, "Email already subscribed", 409);
      return;
    }

    sendError(res, "Error subscribing to newsletter", 500, error.message);
  }
};

// Validation middleware
export const validateSubscribe = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("source")
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage("Source must be <= 100 chars"),
];

export default { subscribe, validateSubscribe };
