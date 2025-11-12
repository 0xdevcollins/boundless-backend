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
  getHackathonStatistics,
  getHackathonAnalytics,
  getParticipants,
  shortlistSubmission,
  disqualifySubmission,
} from "./hackathon.controller";
import { protect } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import {
  orgIdParam,
  draftIdParam,
  hackathonIdParam,
  draftSchema,
  publishSchema,
  analyticsQuerySchema,
  participantIdParam,
  disqualifySchema,
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

// Statistics and Analytics Routes
router.get(
  "/:orgId/hackathons/:hackathonId/statistics",
  protect,
  validateRequest([orgIdParam, hackathonIdParam]),
  getHackathonStatistics,
);

router.get(
  "/:orgId/hackathons/:hackathonId/analytics",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...analyticsQuerySchema]),
  getHackathonAnalytics,
);

router.get(
  "/:orgId/hackathons/:hackathonId/participants",
  protect,
  validateRequest([orgIdParam, hackathonIdParam]),
  getParticipants,
);

// Submission Review Routes
router.post(
  "/:orgId/hackathons/:hackathonId/participants/:participantId/shortlist",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, participantIdParam]),
  shortlistSubmission,
);

router.post(
  "/:orgId/hackathons/:hackathonId/participants/:participantId/disqualify",
  protect,
  validateRequest([
    orgIdParam,
    hackathonIdParam,
    participantIdParam,
    ...disqualifySchema,
  ]),
  disqualifySubmission,
);

export default router;
