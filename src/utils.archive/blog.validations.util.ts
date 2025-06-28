import { body, param, query } from "express-validator";

export const createBlogValidation = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title must be less than 200 characters"),
  body("content").notEmpty().withMessage("Content is required"),
  body("excerpt")
    .notEmpty()
    .withMessage("Excerpt is required")
    .isLength({ max: 500 })
    .withMessage("Excerpt must be less than 500 characters"),
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isMongoId()
    .withMessage("Invalid category ID"),
  body("authors")
    .isArray({ min: 1 })
    .withMessage("At least one author is required"),
  body("authors.*").isMongoId().withMessage("Invalid author ID"),
  body("status")
    .optional()
    .isIn(["draft", "published"])
    .withMessage("Status must be either draft or published"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("seo.metaTitle")
    .optional()
    .isLength({ max: 60 })
    .withMessage("Meta title must be less than 60 characters"),
  body("seo.metaDescription")
    .optional()
    .isLength({ max: 160 })
    .withMessage("Meta description must be less than 160 characters"),
  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),
  body("allowComments")
    .optional()
    .isBoolean()
    .withMessage("Allow comments must be a boolean"),
  body("scheduledAt")
    .optional()
    .isISO8601()
    .withMessage("Scheduled date must be a valid ISO 8601 date"),
];

export const updateBlogValidation = [
  body("title")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Title must be less than 200 characters"),
  body("excerpt")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Excerpt must be less than 500 characters"),
  body("category").optional().isMongoId().withMessage("Invalid category ID"),
  body("authors")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one author is required"),
  body("authors.*").optional().isMongoId().withMessage("Invalid author ID"),
  body("status")
    .optional()
    .isIn(["draft", "published", "archived"])
    .withMessage("Status must be draft, published, or archived"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("seo.metaTitle")
    .optional()
    .isLength({ max: 60 })
    .withMessage("Meta title must be less than 60 characters"),
  body("seo.metaDescription")
    .optional()
    .isLength({ max: 160 })
    .withMessage("Meta description must be less than 160 characters"),
  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),
  body("allowComments")
    .optional()
    .isBoolean()
    .withMessage("Allow comments must be a boolean"),
  body("scheduledAt")
    .optional()
    .isISO8601()
    .withMessage("Scheduled date must be a valid ISO 8601 date"),
  body("revisionNote")
    .optional()
    .isString()
    .withMessage("Revision note must be a string"),
];

export const blogIdValidation = [
  param("id").isMongoId().withMessage("Invalid blog ID"),
];

export const listBlogsValidation = [
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
    .isIn(["draft", "published", "archived"])
    .withMessage("Status must be draft, published, or archived"),
  query("category").optional().isMongoId().withMessage("Invalid category ID"),
  query("author").optional().isMongoId().withMessage("Invalid author ID"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "publishedAt", "views", "likes"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be asc or desc"),
  query("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),
];

export const deleteBlogValidation = [
  param("id").isMongoId().withMessage("Invalid blog ID"),
  body("permanent")
    .optional()
    .isBoolean()
    .withMessage("Permanent must be a boolean"),
  body("reason").optional().isString().withMessage("Reason must be a string"),
  body("redirectUrl")
    .optional()
    .isURL()
    .withMessage("Redirect URL must be a valid URL"),
];

export const analyticsValidation = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  query("period")
    .optional()
    .isIn(["daily", "weekly", "monthly"])
    .withMessage("Period must be daily, weekly, or monthly"),
];
