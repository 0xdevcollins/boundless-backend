import { Router } from "express";
// Import from modular controllers (they're re-exported from hackathon.controller.ts for backward compatibility)
import {
  createDraft,
  updateDraft,
  getDraft,
  getDrafts,
  previewDraft,
  publishHackathon,
  updateHackathon,
  getHackathon,
  getHackathons,
  deleteHackathon,
  getHackathonStatistics,
  getHackathonAnalytics,
  getParticipants,
  shortlistSubmission,
  disqualifySubmission,
  getJudgingSubmissions,
  submitGrade,
  getSubmissionScores,
} from "./hackathon.controller.js";
import { protect } from "../../middleware/better-auth.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  orgIdParam,
  draftIdParam,
  hackathonIdParam,
  draftSchema,
  publishSchema,
  analyticsQuerySchema,
  participantIdParam,
  disqualifySchema,
  gradeSubmissionSchema,
  assignRanksSchema,
  createMilestonesSchema,
  announceWinnersSchema,
} from "./hackathon.validators.js";
import {
  assignRanks,
  createWinnerMilestones,
  getEscrowDetails,
  announceWinners,
} from "./hackathon-rewards.controller.js";

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

router.get(
  "/:orgId/hackathons/drafts/:draftId/preview",
  protect,
  validateRequest([orgIdParam, draftIdParam]),
  previewDraft,
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

router.delete(
  "/:orgId/hackathons/:hackathonId",
  protect,
  validateRequest([orgIdParam, hackathonIdParam]),
  deleteHackathon,
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

// Judging Routes
router.get(
  "/:orgId/hackathons/:hackathonId/judging/submissions",
  protect,
  validateRequest([orgIdParam, hackathonIdParam]),
  getJudgingSubmissions,
);

router.post(
  "/:orgId/hackathons/:hackathonId/judging/submissions/:participantId/grade",
  protect,
  validateRequest([
    orgIdParam,
    hackathonIdParam,
    participantIdParam,
    ...gradeSubmissionSchema,
  ]),
  submitGrade,
);

router.get(
  "/:orgId/hackathons/:hackathonId/judging/submissions/:participantId/scores",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, participantIdParam]),
  getSubmissionScores,
);

// Rewards Routes
router.post(
  "/:orgId/hackathons/:hackathonId/rewards/ranks",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...assignRanksSchema]),
  assignRanks,
);

router.post(
  "/:orgId/hackathons/:hackathonId/rewards/milestones",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...createMilestonesSchema]),
  createWinnerMilestones,
);

router.get(
  "/:orgId/hackathons/:hackathonId/escrow",
  protect,
  validateRequest([orgIdParam, hackathonIdParam]),
  getEscrowDetails,
);

router.post(
  "/:orgId/hackathons/:hackathonId/winners/announce",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...announceWinnersSchema]),
  announceWinners,
);

export default router;
