import { Router } from "express";
import {
  createCampaign,
  backCampaign,
  approveCampaignV2,
  getCampaignById,
} from "../controllers/campaign.controller";
import { updateMilestoneStatus } from "../controllers/milestone.controller";
import { authMiddleware } from "../utils/jwt.utils";
import { validateRequest } from "../middleware/validateRequest";
import { body, param } from "express-validator";

const router = Router();

// GET /api/campaigns/:id
router.get("/:id", getCampaignById);

// POST /api/campaigns
router.post("/", authMiddleware, createCampaign);

// POST /api/campaigns/:id/back
router.post("/:id/back", authMiddleware, backCampaign);

// PATCH /api/campaigns/:id/approve
router.patch("/:id/approve", authMiddleware, approveCampaignV2);

// PATCH /api/campaigns/:id/milestones/:milestoneId/status
router.patch(
  "/:id/milestones/:milestoneId/status",
  authMiddleware,
  validateRequest([
    param("id").isMongoId().withMessage("Invalid campaign ID"),
    param("milestoneId").isMongoId().withMessage("Invalid milestone ID"),
    body("status")
      .isIn(["approved", "released", "rejected", "disputed"])
      .withMessage("Invalid status value"),
    body("disputeReason").optional().isString().isLength({ max: 1000 }),
  ]),
  updateMilestoneStatus,
);

export default router;
