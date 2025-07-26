import { Router } from "express";
import { lockEscrow } from "../controllers/grant-application.controller";
import { protect } from "../middleware/auth";
const router = Router();

// PATCH /api/grant-applications/:id/escrow
router.patch("/:id/escrow", protect, lockEscrow);

export default router;
