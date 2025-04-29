import express from "express";
import multer from "multer";
import {
  getUserProfile,
  updateUserProfile,
  updateUserAvatar,
  getUserActivity,
  getUserSettings,
  updateUserSettings,
  updateUserSecurity,
} from "../controllers/user.controller";
import { protect } from "../middleware/auth";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Type assertion for route handlers
type RequestHandler = express.RequestHandler;
type RequestHandlerWithUpload = express.RequestHandler[];

// Profile routes
router
  .route("/profile")
  .get(protect, getUserProfile as RequestHandler)
  .put(protect, updateUserProfile as RequestHandler);

// Avatar upload route
router.put(
  "/avatar",
  protect,
  upload.single("avatar"),
  updateUserAvatar as RequestHandler,
);

// Activity route
router.get("/activity", protect, getUserActivity as RequestHandler);

// Settings routes
router
  .route("/settings")
  .get(protect, getUserSettings as RequestHandler)
  .put(protect, updateUserSettings as RequestHandler);

// Security route
router.put("/security", protect, updateUserSecurity as RequestHandler);

export default router;
