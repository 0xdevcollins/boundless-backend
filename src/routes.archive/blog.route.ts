import { Router } from "express";
import { BlogController } from "../controllers/blog.controller";
import { validateRequestMarkdown } from "../middleware/validateRequest";
import { protect } from "../middleware/auth";
import { roleMiddleware } from "../utils/jwt.utils";
import {
  analyticsValidation,
  blogIdValidation,
  createBlogValidation,
  deleteBlogValidation,
  listBlogsValidation,
  updateBlogValidation,
} from "../utils/blog.validations.util";

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
  [...blogIdValidation, ...updateBlogValidation],
  validateRequestMarkdown,
  BlogController.updateBlog,
);

router.delete(
  "/:id",
  deleteBlogValidation,
  validateRequestMarkdown,
  BlogController.deleteBlog,
);

export default router;
