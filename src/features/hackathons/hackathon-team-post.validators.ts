import { body, param, query, ValidationChain } from "express-validator";
import {
  ContactMethod,
  TeamRecruitmentPostStatus,
} from "../../models/hackathon-team-recruitment-post.model.js";
import { validateContactInfo } from "./hackathon-team-post.helpers.js";

export const hackathonIdOrSlugParam: ValidationChain = param(
  "hackathonSlugOrId",
)
  .notEmpty()
  .withMessage("Hackathon ID or slug is required");

export const postIdParam: ValidationChain = param("postId")
  .isMongoId()
  .withMessage("Invalid post ID");

export const createTeamPostSchema: ValidationChain[] = [
  body("projectName")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Project name must be between 3 and 200 characters"),
  body("projectDescription")
    .trim()
    .isLength({ min: 50, max: 5000 })
    .withMessage("Project description must be between 50 and 5000 characters"),
  body("lookingFor")
    .isArray({ min: 1, max: 10 })
    .withMessage("Must have between 1 and 10 roles"),
  body("lookingFor.*.role")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Role name is required and cannot exceed 100 characters"),
  body("lookingFor.*.skills")
    .optional()
    .isArray()
    .withMessage("Skills must be an array"),
  body("lookingFor.*.skills.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each skill must be between 1 and 50 characters"),
  body("currentTeamSize")
    .isInt({ min: 1, max: 50 })
    .withMessage("Current team size must be between 1 and 50"),
  body("maxTeamSize")
    .isInt({ min: 2, max: 50 })
    .withMessage("Max team size must be between 2 and 50")
    .custom((value, { req }) => {
      const currentSize = req.body.currentTeamSize;
      if (value <= currentSize) {
        throw new Error("Max team size must be greater than current team size");
      }
      return true;
    }),
  body("contactMethod")
    .isIn(Object.values(ContactMethod))
    .withMessage(
      `Contact method must be one of: ${Object.values(ContactMethod).join(", ")}`,
    ),
  body("contactInfo")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Contact info is required and cannot exceed 500 characters")
    .custom((value, { req }) => {
      const method = req.body.contactMethod;
      if (!method) {
        return true; // Will be caught by contactMethod validation
      }
      const validation = validateContactInfo(method as ContactMethod, value);
      if (!validation.valid) {
        throw new Error(validation.message || "Invalid contact info");
      }
      return true;
    }),
];

export const updateTeamPostSchema: ValidationChain[] = [
  body("projectName")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Project name must be between 3 and 200 characters"),
  body("projectDescription")
    .optional()
    .trim()
    .isLength({ min: 50, max: 5000 })
    .withMessage("Project description must be between 50 and 5000 characters"),
  body("lookingFor")
    .optional()
    .isArray({ min: 1, max: 10 })
    .withMessage("Must have between 1 and 10 roles"),
  body("lookingFor.*.role")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Role name is required and cannot exceed 100 characters"),
  body("lookingFor.*.skills")
    .optional()
    .isArray()
    .withMessage("Skills must be an array"),
  body("lookingFor.*.skills.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Each skill must be between 1 and 50 characters"),
  body("currentTeamSize")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Current team size must be between 1 and 50"),
  body("maxTeamSize")
    .optional()
    .isInt({ min: 2, max: 50 })
    .withMessage("Max team size must be between 2 and 50")
    .custom((value, { req }) => {
      const currentSize = req.body.currentTeamSize;
      if (currentSize !== undefined && value <= currentSize) {
        throw new Error("Max team size must be greater than current team size");
      }
      return true;
    }),
  body("contactMethod")
    .optional()
    .isIn(Object.values(ContactMethod))
    .withMessage(
      `Contact method must be one of: ${Object.values(ContactMethod).join(", ")}`,
    ),
  body("contactInfo")
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Contact info cannot exceed 500 characters")
    .custom((value, { req }) => {
      const method = req.body.contactMethod;
      if (!method || !value) {
        return true;
      }
      const validation = validateContactInfo(method as ContactMethod, value);
      if (!validation.valid) {
        throw new Error(validation.message || "Invalid contact info");
      }
      return true;
    }),
  body("status")
    .optional()
    .isIn(Object.values(TeamRecruitmentPostStatus))
    .withMessage(
      `Status must be one of: ${Object.values(TeamRecruitmentPostStatus).join(", ")}`,
    ),
];

export const getTeamPostsQuerySchema: ValidationChain[] = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("role")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Role filter must not be empty"),
  query("skill")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Skill filter must not be empty"),
  query("status")
    .optional()
    .isIn([...Object.values(TeamRecruitmentPostStatus), "all"])
    .withMessage(
      `Status must be one of: ${Object.values(TeamRecruitmentPostStatus).join(", ")}, or 'all'`,
    ),
  query("search")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Search query must not be empty"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt"])
    .withMessage("Sort by must be 'createdAt' or 'updatedAt'"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];
