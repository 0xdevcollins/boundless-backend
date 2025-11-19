import { body, param, query, ValidationChain } from "express-validator";
import { HackathonCategory } from "../../models/hackathon.model.js";

export const hackathonIdOrSlugParam: ValidationChain = param(
  "hackathonSlugOrId",
)
  .notEmpty()
  .withMessage("Hackathon ID or slug is required");

export const submissionIdParam: ValidationChain = param("submissionId")
  .isMongoId()
  .withMessage("Invalid submission ID");

export const createSubmissionSchema: ValidationChain[] = [
  body("projectName")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Project name must be between 3 and 200 characters"),
  body("category")
    .trim()
    .isIn(Object.values(HackathonCategory))
    .withMessage(
      `Category must be one of: ${Object.values(HackathonCategory).join(", ")}`,
    ),
  body("description")
    .trim()
    .isLength({ min: 50, max: 5000 })
    .withMessage("Description must be between 50 and 5000 characters"),
  body("logo").optional().isURL().withMessage("Logo must be a valid URL"),
  body("videoUrl")
    .optional()
    .isURL()
    .withMessage("Video URL must be a valid URL"),
  body("introduction")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Introduction cannot exceed 2000 characters"),
  body("links").optional().isArray().withMessage("Links must be an array"),
  body("links.*.type")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Link type is required"),
  body("links.*.url")
    .optional()
    .isURL()
    .withMessage("Link URL must be a valid URL"),
];

export const updateSubmissionSchema: ValidationChain[] = [
  body("category")
    .optional()
    .trim()
    .isIn(Object.values(HackathonCategory))
    .withMessage(
      `Category must be one of: ${Object.values(HackathonCategory).join(", ")}`,
    ),
  body("description")
    .optional()
    .trim()
    .isLength({ min: 50, max: 5000 })
    .withMessage("Description must be between 50 and 5000 characters"),
  body("logo").optional().isURL().withMessage("Logo must be a valid URL"),
  body("videoUrl")
    .optional()
    .isURL()
    .withMessage("Video URL must be a valid URL"),
  body("introduction")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Introduction cannot exceed 2000 characters"),
  body("links").optional().isArray().withMessage("Links must be an array"),
  body("links.*.type")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Link type is required"),
  body("links.*.url")
    .optional()
    .isURL()
    .withMessage("Link URL must be a valid URL"),
];

export const voteSubmissionSchema: ValidationChain[] = [
  body("voteType").isIn(["upvote"]).withMessage("Vote type must be 'upvote'"),
];

export const getSubmissionsQuerySchema: ValidationChain[] = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("status")
    .optional()
    .isIn(["submitted", "shortlisted", "disqualified"])
    .withMessage("Status must be one of: submitted, shortlisted, disqualified"),
  query("category")
    .optional()
    .trim()
    .isIn(Object.values(HackathonCategory))
    .withMessage(
      `Category must be one of: ${Object.values(HackathonCategory).join(", ")}`,
    ),
  query("search")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Search query must not be empty"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "votes", "comments"])
    .withMessage("Sort by must be one of: createdAt, votes, comments"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];
