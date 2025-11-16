import { Router } from "express";
import { lockEscrow, updateMilestones } from "./grant-application.controller";
import { protect } from "../../middleware/better-auth.middleware";
const router = Router();

// PATCH /api/grant-applications/:id/escrow
router.patch("/:id/escrow", protect, lockEscrow);
router.patch("/:id/milestones", protect, updateMilestones);

export default router;
