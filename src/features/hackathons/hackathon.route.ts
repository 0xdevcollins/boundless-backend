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
import {
  protect,
  optionalAuth,
} from "../../middleware/better-auth.middleware.js";
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
import {
  createSubmission,
  updateSubmission,
  getMySubmission,
  getSubmissionDetails,
  getAllSubmissions,
  voteOnSubmission,
  removeVote,
} from "./hackathon-submission.controller.js";
import {
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  getDiscussions,
  replyToDiscussion,
  reportDiscussion,
} from "./hackathon-discussion.controller.js";
import { getResources } from "./hackathon-resource.controller.js";
import {
  registerForHackathon,
  checkRegistrationStatus,
} from "./hackathon-registration.controller.js";
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  voteSubmissionSchema,
  getSubmissionsQuerySchema,
  submissionIdParam,
} from "./hackathon-submission.validators.js";
import {
  createDiscussionSchema,
  updateDiscussionSchema,
  reportDiscussionSchema,
  getDiscussionsQuerySchema,
  discussionIdParam,
  parentCommentIdParam,
} from "./hackathon-discussion.validators.js";
import { registerSchema } from "./hackathon-registration.validators.js";
import {
  inviteTeamMember,
  addTeamMember,
  removeTeamMember,
  leaveHackathon,
  acceptTeamInvitation,
} from "./hackathon-team.controller.js";
import {
  inviteTeamMemberSchema,
  addTeamMemberSchema,
  acceptInvitationSchema,
  memberIdParam,
} from "./hackathon-team.validators.js";
import {
  createTeamPost,
  getTeamPosts,
  getTeamPostDetails,
  updateTeamPost,
  deleteTeamPost,
  trackContactClick,
} from "./hackathon-team-post.controller.js";
import {
  createTeamPostSchema,
  updateTeamPostSchema,
  getTeamPostsQuerySchema,
  postIdParam,
} from "./hackathon-team-post.validators.js";

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

// Submissions Routes
router.post(
  "/:orgId/hackathons/:hackathonId/submissions",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...createSubmissionSchema]),
  createSubmission,
);

router.put(
  "/:orgId/hackathons/:hackathonId/submissions/:submissionId",
  protect,
  validateRequest([
    orgIdParam,
    hackathonIdParam,
    submissionIdParam,
    ...updateSubmissionSchema,
  ]),
  updateSubmission,
);

router.get(
  "/:orgId/hackathons/:hackathonId/submissions/me",
  protect,
  validateRequest([orgIdParam, hackathonIdParam]),
  getMySubmission,
);

router.get(
  "/:orgId/hackathons/:hackathonId/submissions/:submissionId",
  optionalAuth,
  validateRequest([orgIdParam, hackathonIdParam, submissionIdParam]),
  getSubmissionDetails,
);

router.get(
  "/:orgId/hackathons/:hackathonId/submissions",
  optionalAuth,
  validateRequest([orgIdParam, hackathonIdParam, ...getSubmissionsQuerySchema]),
  getAllSubmissions,
);

router.post(
  "/:orgId/hackathons/:hackathonId/submissions/:submissionId/vote",
  protect,
  validateRequest([
    orgIdParam,
    hackathonIdParam,
    submissionIdParam,
    ...voteSubmissionSchema,
  ]),
  voteOnSubmission,
);

router.delete(
  "/:orgId/hackathons/:hackathonId/submissions/:submissionId/vote",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, submissionIdParam]),
  removeVote,
);

// Discussions Routes
router.get(
  "/:orgId/hackathons/:hackathonId/discussions",
  optionalAuth,
  validateRequest([orgIdParam, hackathonIdParam, ...getDiscussionsQuerySchema]),
  getDiscussions,
);

router.post(
  "/:orgId/hackathons/:hackathonId/discussions",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...createDiscussionSchema]),
  createDiscussion,
);

router.put(
  "/:orgId/hackathons/:hackathonId/discussions/:discussionId",
  protect,
  validateRequest([
    orgIdParam,
    hackathonIdParam,
    discussionIdParam,
    ...updateDiscussionSchema,
  ]),
  updateDiscussion,
);

router.delete(
  "/:orgId/hackathons/:hackathonId/discussions/:discussionId",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, discussionIdParam]),
  deleteDiscussion,
);

router.post(
  "/:orgId/hackathons/:hackathonId/discussions/:parentCommentId/replies",
  protect,
  validateRequest([
    orgIdParam,
    hackathonIdParam,
    parentCommentIdParam,
    ...createDiscussionSchema,
  ]),
  replyToDiscussion,
);

router.post(
  "/:orgId/hackathons/:hackathonId/discussions/:discussionId/report",
  protect,
  validateRequest([
    orgIdParam,
    hackathonIdParam,
    discussionIdParam,
    ...reportDiscussionSchema,
  ]),
  reportDiscussion,
);

// Resources Routes
router.get(
  "/:orgId/hackathons/:hackathonId/resources",
  optionalAuth,
  validateRequest([orgIdParam, hackathonIdParam]),
  getResources,
);

// Registration Routes
router.post(
  "/:orgId/hackathons/:hackathonId/register",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...registerSchema]),
  registerForHackathon,
);

router.get(
  "/:orgId/hackathons/:hackathonId/register/status",
  protect,
  validateRequest([orgIdParam, hackathonIdParam]),
  checkRegistrationStatus,
);

// Team Management Routes
router.post(
  "/:orgId/hackathons/:hackathonId/team/invite",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...inviteTeamMemberSchema]),
  inviteTeamMember,
);

router.post(
  "/:orgId/hackathons/:hackathonId/team/members",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...addTeamMemberSchema]),
  addTeamMember,
);

router.delete(
  "/:orgId/hackathons/:hackathonId/team/members/:memberId",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, memberIdParam]),
  removeTeamMember,
);

router.delete(
  "/:orgId/hackathons/:hackathonId/register",
  protect,
  validateRequest([orgIdParam, hackathonIdParam]),
  leaveHackathon,
);

// Team Recruitment Posts Routes
router.post(
  "/:orgId/hackathons/:hackathonId/team-posts",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, ...createTeamPostSchema]),
  createTeamPost,
);

router.get(
  "/:orgId/hackathons/:hackathonId/team-posts",
  optionalAuth,
  validateRequest([orgIdParam, hackathonIdParam, ...getTeamPostsQuerySchema]),
  getTeamPosts,
);

router.get(
  "/:orgId/hackathons/:hackathonId/team-posts/:postId",
  optionalAuth,
  validateRequest([orgIdParam, hackathonIdParam, postIdParam]),
  getTeamPostDetails,
);

router.put(
  "/:orgId/hackathons/:hackathonId/team-posts/:postId",
  protect,
  validateRequest([
    orgIdParam,
    hackathonIdParam,
    postIdParam,
    ...updateTeamPostSchema,
  ]),
  updateTeamPost,
);

router.delete(
  "/:orgId/hackathons/:hackathonId/team-posts/:postId",
  protect,
  validateRequest([orgIdParam, hackathonIdParam, postIdParam]),
  deleteTeamPost,
);

router.post(
  "/:orgId/hackathons/:hackathonId/team-posts/:postId/contact",
  optionalAuth,
  validateRequest([orgIdParam, hackathonIdParam, postIdParam]),
  trackContactClick,
);

export default router;
