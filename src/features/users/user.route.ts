import express from "express";
import multer from "multer";
import {
  getUserProfile,
  getMe,
  updateUserProfile,
  updateUserAvatar,
  getUserActivity,
  getUserSettings,
  updateUserSettings,
  updateUserSecurity,
  deleteUserAccount,
  getUserProfileByUsername,
  // getDashboardOverview,
} from "./user.controller.js";
import { protect } from "../../middleware/better-auth.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

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
  // @ts-ignore
  .get(asyncHandler(protect), asyncHandler(getUserProfile))
  // @ts-ignore
  .put(asyncHandler(protect), asyncHandler(updateUserProfile));

// Public profile by username route (NO authentication required)
// @ts-ignore
router.get("/profile/:username", asyncHandler(getUserProfileByUsername));

// Me route (same as profile)
// @ts-ignore
router.get("/me", asyncHandler(protect), asyncHandler(getMe));

// Avatar upload route
// @ts-ignore
router.put(
  "/avatar",
  asyncHandler(protect),
  upload.single("avatar"),
  asyncHandler(updateUserAvatar),
);

// Activity route
// @ts-ignore
router.get("/activity", asyncHandler(protect), asyncHandler(getUserActivity));

// Settings routes
router
  .route("/settings")
  // @ts-ignore
  .get(asyncHandler(protect), asyncHandler(getUserSettings))
  // @ts-ignore
  .put(asyncHandler(protect), asyncHandler(updateUserSettings));

// Security route
// @ts-ignore
router.put(
  "/security",
  asyncHandler(protect),
  asyncHandler(updateUserSecurity),
);

// Account deletion route
// @ts-ignore
router.delete(
  "/account",
  asyncHandler(protect),
  asyncHandler(deleteUserAccount),
);

// Dashboard route
// router.get(
//   "/dashboard/overview",
//   asyncHandler(protect),
//   asyncHandler(getDashboardOverview),
// );

export default router;
