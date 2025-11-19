import { body, param, query, ValidationChain } from "express-validator";

export const hackathonIdOrSlugParam: ValidationChain = param(
  "hackathonSlugOrId",
)
  .notEmpty()
  .withMessage("Hackathon ID or slug is required");

export const discussionIdParam: ValidationChain = param("discussionId")
  .isMongoId()
  .withMessage("Invalid discussion ID");

export const parentCommentIdParam: ValidationChain = param("parentCommentId")
  .isMongoId()
  .withMessage("Invalid parent comment ID");

export const createDiscussionSchema: ValidationChain[] = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Content must be between 1 and 2000 characters"),
  body("parentCommentId")
    .optional()
    .isMongoId()
    .withMessage("Parent comment ID must be a valid MongoDB ObjectId"),
];

export const updateDiscussionSchema: ValidationChain[] = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Content must be between 1 and 2000 characters"),
];

export const reportDiscussionSchema: ValidationChain[] = [
  body("reason")
    .isIn(["spam", "inappropriate", "harassment", "misinformation", "other"])
    .withMessage(
      "Reason must be one of: spam, inappropriate, harassment, misinformation, other",
    ),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
];

export const getDiscussionsQuerySchema: ValidationChain[] = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "totalReactions"])
    .withMessage(
      "Sort by must be one of: createdAt, updatedAt, totalReactions",
    ),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];
