import { Router } from "express";
import {
  createCampaign,
  backCampaign,
  getCampaignById,
  fundEscrow,
  approveMilestone,
  markMilestoneComplete,
  releaseMilestoneFunds,
  getEscrowDetails,
} from "../controllers/campaign.controller";
import { updateMilestoneStatus } from "../controllers/milestone.controller";
import { authMiddleware } from "../utils/jwt.utils";
import { validateRequest } from "../middleware/validateRequest";
import { body, param } from "express-validator";

const router = Router();

router.get("/:id", getCampaignById);

router.post("/", authMiddleware, createCampaign);

router.post("/:id/back", authMiddleware, backCampaign);

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

router.post("/:campaignId/fund-escrow", authMiddleware, fundEscrow);

router.post(
  "/:campaignId/milestones/:milestoneIndex/approve",
  authMiddleware,
  approveMilestone,
);

router.post(
  "/:campaignId/milestones/:milestoneIndex/complete",
  authMiddleware,
  markMilestoneComplete,
);

router.post(
  "/:campaignId/milestones/:milestoneIndex/release",
  authMiddleware,
  releaseMilestoneFunds,
);

router.get("/:campaignId/escrow-details", authMiddleware, getEscrowDetails);

export default router;
