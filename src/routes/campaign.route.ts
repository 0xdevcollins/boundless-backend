import { Router } from "express";
import {
  createCampaign,
  backCampaign,
  approveCampaignV2,
} from "../controllers/campaign.controller";
import { authMiddleware } from "../utils/jwt.utils";

const router = Router();

// POST /api/campaigns
router.post("/", authMiddleware, createCampaign);

// POST /api/campaigns/:id/back
router.post("/:id/back", authMiddleware, backCampaign);

// PATCH /api/campaigns/:id/approve
router.patch("/:id/approve", authMiddleware, approveCampaignV2);

export default router;
