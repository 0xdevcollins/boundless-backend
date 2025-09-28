import { body, param, query } from "express-validator";

// Blog post validation
export const createBlogValidation = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 5, max: 200 })
    .withMessage("Title must be between 5 and 200 characters"),
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ min: 100 })
    .withMessage("Content must be at least 100 characters"),
  body("excerpt")
    .notEmpty()
    .withMessage("Excerpt is required")
    .isLength({ min: 20, max: 500 })
    .withMessage("Excerpt must be between 20 and 500 characters"),
  body("category").isMongoId().withMessage("Valid category ID is required"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("tags.*")
    .optional()
    .isMongoId()
    .withMessage("Each tag must be a valid ID"),
  body("authors")
    .isArray({ min: 1 })
    .withMessage("At least one author is required"),
  body("authors.*").isMongoId().withMessage("Each author must be a valid ID"),
  body("status")
    .optional()
    .isIn(["draft", "published"])
    .withMessage("Status must be either 'draft' or 'published'"),
  body("seo.metaTitle")
    .optional()
    .isLength({ max: 60 })
    .withMessage("SEO meta title must be 60 characters or less"),
  body("seo.metaDescription")
    .optional()
    .isLength({ max: 160 })
    .withMessage("SEO meta description must be 160 characters or less"),
];

export const updateBlogValidation = [
  body("title")
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage("Title must be between 5 and 200 characters"),
  body("content")
    .optional()
    .isLength({ min: 100 })
    .withMessage("Content must be at least 100 characters"),
  body("excerpt")
    .optional()
    .isLength({ min: 20, max: 500 })
    .withMessage("Excerpt must be between 20 and 500 characters"),
  body("category")
    .optional()
    .isMongoId()
    .withMessage("Valid category ID is required"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("tags.*")
    .optional()
    .isMongoId()
    .withMessage("Each tag must be a valid ID"),
  body("authors")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one author is required"),
  body("authors.*")
    .optional()
    .isMongoId()
    .withMessage("Each author must be a valid ID"),
  body("status")
    .optional()
    .isIn(["draft", "published", "archived"])
    .withMessage("Status must be 'draft', 'published', or 'archived'"),
  body("seo.metaTitle")
    .optional()
    .isLength({ max: 60 })
    .withMessage("SEO meta title must be 60 characters or less"),
  body("seo.metaDescription")
    .optional()
    .isLength({ max: 160 })
    .withMessage("SEO meta description must be 160 characters or less"),
];

export const blogIdValidation = [
  param("id").isMongoId().withMessage("Valid blog ID is required"),
];

export const deleteBlogValidation = [
  body("reason")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Reason must be 500 characters or less"),
  body("permanent")
    .optional()
    .isBoolean()
    .withMessage("Permanent must be a boolean"),
  body("redirectUrl")
    .optional()
    .isURL()
    .withMessage("Redirect URL must be a valid URL"),
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
    .withMessage("Status must be 'draft', 'published', or 'archived'"),
  query("category")
    .optional()
    .isMongoId()
    .withMessage("Category must be a valid ID"),
  query("tag").optional().isMongoId().withMessage("Tag must be a valid ID"),
  query("author")
    .optional()
    .isMongoId()
    .withMessage("Author must be a valid ID"),
  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "publishedAt", "views", "likes"])
    .withMessage("Sort by must be a valid field"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
  query("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),
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
    .withMessage("Period must be 'daily', 'weekly', or 'monthly'"),
];

// Public blog validation
export const publicBlogListValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
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
    .isIn(["latest", "oldest", "popular"])
    .withMessage("Sort must be 'latest', 'oldest', or 'popular'"),
  query("tags")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        return value.split(",").every((tag) => tag.trim().length > 0);
      }
      if (Array.isArray(value)) {
        return value.every(
          (tag) => typeof tag === "string" && tag.trim().length > 0,
        );
      }
      return false;
    })
    .withMessage("Tags must be a comma-separated string or array of strings"),
];

export const publicBlogSearchValidation = [
  query("q")
    .notEmpty()
    .withMessage("Search query is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("category")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Category must be between 1 and 100 characters"),
  query("tags")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        return value.split(",").every((tag) => tag.trim().length > 0);
      }
      if (Array.isArray(value)) {
        return value.every(
          (tag) => typeof tag === "string" && tag.trim().length > 0,
        );
      }
      return false;
    })
    .withMessage("Tags must be a comma-separated string or array of strings"),
];

export const slugValidation = [
  param("slug")
    .notEmpty()
    .withMessage("Slug is required")
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
];

export const relatedPostsValidation = [
  param("slug")
    .notEmpty()
    .withMessage("Slug is required")
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage("Limit must be between 1 and 10"),
];
