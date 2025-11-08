import { Router } from "express";
import { PublicBlogController } from "./public-blog.controller";
import { validateRequestMarkdown } from "../../middleware/validateRequest";
import { blogRateLimit, searchRateLimit } from "../../middleware/blogRateLimit";
import {
  publicBlogListValidation,
  publicBlogSearchValidation,
  slugValidation,
  relatedPostsValidation,
} from "../../utils/blog.validation.util";

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
