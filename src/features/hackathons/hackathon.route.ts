import { Router } from "express";
import {
  createDraft,
  updateDraft,
  getDraft,
  getDrafts,
  publishHackathon,
  updateHackathon,
  getHackathon,
  getHackathons,
} from "./hackathon.controller";
import { protect } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import {
  orgIdParam,
  draftIdParam,
  hackathonIdParam,
  draftSchema,
  publishSchema,
} from "./hackathon.validators";

const router = Router();

// Draft Management Routes
router.post(
  "/:orgId/hackathons/drafts",
  protect,
  validateRequest([orgIdParam, ...draftSchema]),
  createDraft,
);

router.put(
  "/:orgId/hackathons/drafts/:draftId",
  protect,
  validateRequest([orgIdParam, draftIdParam, ...draftSchema]),
  updateDraft,
);

router.get(
  "/:orgId/hackathons/drafts/:draftId",
  protect,
  validateRequest([orgIdParam, draftIdParam]),
  getDraft,
);

router.get(
  "/:orgId/hackathons/drafts",
  protect,
  validateRequest([orgIdParam]),
  getDrafts,
);

// Publish & Management Routes
router.post(
  "/:orgId/hackathons",
  protect,
  validateRequest([orgIdParam, ...publishSchema]),
  publishHackathon,
);

router.put(
  "/:orgId/hackathons/:hackathonId",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...draftSchema]),
  updateHackathon,
);

router.get(
  "/:orgId/hackathons/:hackathonId",
  protect,
  validateRequest([orgIdParam, hackathonIdParam]),
  getHackathon,
);

router.get(
  "/:orgId/hackathons",
  protect,
  validateRequest([orgIdParam]),
  getHackathons,
);

export default router;
