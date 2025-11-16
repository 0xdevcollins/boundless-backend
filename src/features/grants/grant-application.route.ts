import { Router } from "express";
import {
  lockEscrow,
  updateMilestones,
} from "./grant-application.controller.js";
import { protect } from "../../middleware/better-auth.middleware.js";
const router = Router();

// PATCH /api/grant-applications/:id/escrow
router.patch("/:id/escrow", protect, lockEscrow);
router.patch("/:id/milestones", protect, updateMilestones);

export default router;
