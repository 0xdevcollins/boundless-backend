import { Router } from "express";
import { BlogController } from "./blog.controller";
import { validateRequestMarkdown } from "../../middleware/validateRequest";
import { protect } from "../../middleware/better-auth.middleware";
import { roleMiddleware } from "../../middleware/better-auth.middleware";
import { blogAdminRateLimit } from "../../middleware/blogRateLimit";
import {
  analyticsValidation,
  blogIdValidation,
  createBlogValidation,
  deleteBlogValidation,
  listBlogsValidation,
  updateBlogValidation,
} from "../../utils/blog.validation.util";

const router = Router();

router.use(protect);
router.use(roleMiddleware(["roleMiddleware", "editor"]));

router.get(
  "/",
  listBlogsValidation,
  validateRequestMarkdown,
  BlogController.getAllBlogs,
);

router.post(
  "/",
  blogAdminRateLimit,
  createBlogValidation,
  validateRequestMarkdown,
  BlogController.createBlog,
);

router.get("/categories", BlogController.getCategories);

router.get(
  "/analytics",
  analyticsValidation,
  validateRequestMarkdown,
  BlogController.getAnalytics,
);

router.get(
  "/:id",
  blogIdValidation,
  validateRequestMarkdown,
  BlogController.getBlogById,
);

router.put(
  "/:id",
  blogAdminRateLimit,
  [...blogIdValidation, ...updateBlogValidation],
  validateRequestMarkdown,
  BlogController.updateBlog,
);

router.delete(
  "/:id",
  blogAdminRateLimit,
  deleteBlogValidation,
  validateRequestMarkdown,
  BlogController.deleteBlog,
);

export default router;
