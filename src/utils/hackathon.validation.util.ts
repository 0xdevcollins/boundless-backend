import { query, param } from "express-validator";

// Public hackathon list validation
export const publicHackathonListValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("status")
    .optional()
    .isIn(["upcoming", "ongoing", "ended"])
    .withMessage("Status must be 'upcoming', 'ongoing', or 'ended'"),
  query("category")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Category must be between 1 and 100 characters"),
  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),
  query("sort")
    .optional()
    .isIn(["latest", "oldest", "participants", "prize", "deadline"])
    .withMessage(
      "Sort must be 'latest', 'oldest', 'participants', 'prize', or 'deadline'",
    ),
  query("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),
];

// Public hackathon participants validation
export const publicHackathonParticipantsValidation = [
  param("slug")
    .notEmpty()
    .withMessage("Slug is required")
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("status")
    .optional()
    .isIn(["submitted", "not_submitted"])
    .withMessage("Status must be 'submitted' or 'not_submitted'"),
];

// Public hackathon submissions validation
export const publicHackathonSubmissionsValidation = [
  param("slug")
    .notEmpty()
    .withMessage("Slug is required")
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("status")
    .optional()
    .isIn(["submitted", "shortlisted", "disqualified"])
    .withMessage(
      "Status must be 'submitted', 'shortlisted', or 'disqualified'",
    ),
  query("sort")
    .optional()
    .isIn(["votes", "date", "score"])
    .withMessage("Sort must be 'votes', 'date', or 'score'"),
];
