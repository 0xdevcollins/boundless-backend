import { Router } from "express";
import {
  uploadSingle,
  uploadMultiple,
  deleteFile,
  generateOptimizedUrl,
  generateResponsiveUrls,
  generateAvatarUrl,
  generateLogoUrl,
  generateBannerUrl,
  getFileInfo,
  searchFiles,
  getUsageStats,
  upload,
} from "./upload.controller.js";
import { protect } from "../../middleware/better-auth.middleware.js";

const router = Router();

// Upload routes (require authentication)
router.post("/single", protect, upload.single("file"), uploadSingle);
router.post("/multiple", protect, upload.array("files", 10), uploadMultiple);

// File management routes (require authentication)
router.delete("/:publicId/:resourceType?", protect, deleteFile);
router.get("/info/:publicId/:resourceType?", protect, getFileInfo);
router.get("/search", protect, searchFiles);

// URL generation routes (public access for optimization)
router.get("/optimize/:publicId", generateOptimizedUrl);
router.get("/responsive/:publicId", generateResponsiveUrls);
router.get("/avatar/:publicId", generateAvatarUrl);
router.get("/logo/:publicId", generateLogoUrl);
router.get("/banner/:publicId", generateBannerUrl);

// Statistics route (require authentication)
router.get("/stats", protect, getUsageStats);

export default router;
