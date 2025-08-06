import { Router } from "express";
import {
  createCampaign,
  backCampaign,
  approveCampaignV2,
  fundEscrow,
  approveMilestone,
  markMilestoneComplete,
  releaseMilestoneFunds,
  getEscrowDetails,
} from "../controllers/campaign.controller";
import { authMiddleware } from "../utils/jwt.utils";

const router = Router();

// POST /api/campaigns
router.post("/", authMiddleware, createCampaign);

// POST /api/campaigns/:id/back
router.post("/:id/back", authMiddleware, backCampaign);

// PATCH /api/campaigns/:id/approve
router.patch("/:id/approve", authMiddleware, approveCampaignV2);

// Trustless Work integration endpoints
// POST /api/campaigns/:campaignId/fund-escrow
router.post("/:campaignId/fund-escrow", authMiddleware, fundEscrow);

// POST /api/campaigns/:campaignId/milestones/:milestoneIndex/approve
router.post(
  "/:campaignId/milestones/:milestoneIndex/approve",
  authMiddleware,
  approveMilestone,
);

// POST /api/campaigns/:campaignId/milestones/:milestoneIndex/complete
router.post(
  "/:campaignId/milestones/:milestoneIndex/complete",
  authMiddleware,
  markMilestoneComplete,
);

// POST /api/campaigns/:campaignId/milestones/:milestoneIndex/release
router.post(
  "/:campaignId/milestones/:milestoneIndex/release",
  authMiddleware,
  releaseMilestoneFunds,
);

// GET /api/campaigns/:campaignId/escrow-details
router.get("/:campaignId/escrow-details", authMiddleware, getEscrowDetails);

export default router;
