import { Router } from "express";
import { PublicBlogController } from "./public-blog.controller.js";
import { validateRequestMarkdown } from "../../middleware/validateRequest.js";
import {
  blogRateLimit,
  searchRateLimit,
} from "../../middleware/blogRateLimit.js";
import {
  publicBlogListValidation,
  publicBlogSearchValidation,
  slugValidation,
  relatedPostsValidation,
} from "../../utils/blog.validation.util.js";

const router = Router();

router.get(
  "/posts",
  blogRateLimit,
  publicBlogListValidation,
  validateRequestMarkdown,
  PublicBlogController.getBlogPosts,
);

router.get(
  "/posts/:slug",
  blogRateLimit,
  slugValidation,
  validateRequestMarkdown,
  PublicBlogController.getBlogPost,
);

router.get(
  "/posts/:slug/related",
  blogRateLimit,
  relatedPostsValidation,
  validateRequestMarkdown,
  PublicBlogController.getRelatedPosts,
);

router.get("/categories", blogRateLimit, PublicBlogController.getCategories);

router.get("/tags", blogRateLimit, PublicBlogController.getTags);

router.get(
  "/search",
  searchRateLimit,
  publicBlogSearchValidation,
  validateRequestMarkdown,
  PublicBlogController.searchPosts,
);

export default router;
