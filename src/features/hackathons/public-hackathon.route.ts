import { Router } from "express";
import {
  getHackathonBySlug,
  getHackathonsList,
  getHackathonParticipants,
  getHackathonSubmissions,
} from "./public-hackathon.controller.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { slugValidation } from "../../utils/blog.validation.util.js";
import {
  publicHackathonListValidation,
  publicHackathonParticipantsValidation,
  publicHackathonSubmissionsValidation,
} from "../../utils/hackathon.validation.util.js";
import {
  protect,
  optionalAuth,
} from "../../middleware/better-auth.middleware.js";
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
  hackathonIdOrSlugParam,
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

// GET /api/hackathons - Public endpoint to get list of hackathons
router.get(
  "/",
  validateRequest(publicHackathonListValidation),
  getHackathonsList,
);

// GET /api/hackathons/:slug/participants - Public endpoint to get hackathon participants
router.get(
  "/:slug/participants",
  validateRequest(publicHackathonParticipantsValidation),
  getHackathonParticipants,
);

// GET /api/hackathons/:slug/submissions - Public endpoint to get hackathon submissions
router.get(
  "/:slug/submissions",
  validateRequest(publicHackathonSubmissionsValidation),
  getHackathonSubmissions,
);

// GET /api/hackathons/:slug - Public endpoint to get hackathon by slug
router.get("/:slug", validateRequest(slugValidation), getHackathonBySlug);

// Submissions Routes (public - supports both slug and ID)
router.post(
  "/:hackathonSlugOrId/submissions",
  protect,
  validateRequest([hackathonIdOrSlugParam, ...createSubmissionSchema]),
  createSubmission,
);

router.put(
  "/:hackathonSlugOrId/submissions/:submissionId",
  protect,
  validateRequest([
    hackathonIdOrSlugParam,
    submissionIdParam,
    ...updateSubmissionSchema,
  ]),
  updateSubmission,
);

router.get(
  "/:hackathonSlugOrId/submissions/me",
  protect,
  validateRequest([hackathonIdOrSlugParam]),
  getMySubmission,
);

router.get(
  "/:hackathonSlugOrId/submissions/:submissionId",
  optionalAuth,
  validateRequest([hackathonIdOrSlugParam, submissionIdParam]),
  getSubmissionDetails,
);

router.get(
  "/:hackathonSlugOrId/submissions",
  optionalAuth,
  validateRequest([hackathonIdOrSlugParam, ...getSubmissionsQuerySchema]),
  getAllSubmissions,
);

router.post(
  "/:hackathonSlugOrId/submissions/:submissionId/vote",
  protect,
  validateRequest([
    hackathonIdOrSlugParam,
    submissionIdParam,
    ...voteSubmissionSchema,
  ]),
  voteOnSubmission,
);

router.delete(
  "/:hackathonSlugOrId/submissions/:submissionId/vote",
  protect,
  validateRequest([hackathonIdOrSlugParam, submissionIdParam]),
  removeVote,
);

// Discussions Routes (public - supports both slug and ID)
router.get(
  "/:hackathonSlugOrId/discussions",
  optionalAuth,
  validateRequest([hackathonIdOrSlugParam, ...getDiscussionsQuerySchema]),
  getDiscussions,
);

router.post(
  "/:hackathonSlugOrId/discussions",
  protect,
  validateRequest([hackathonIdOrSlugParam, ...createDiscussionSchema]),
  createDiscussion,
);

router.put(
  "/:hackathonSlugOrId/discussions/:discussionId",
  protect,
  validateRequest([
    hackathonIdOrSlugParam,
    discussionIdParam,
    ...updateDiscussionSchema,
  ]),
  updateDiscussion,
);

router.delete(
  "/:hackathonSlugOrId/discussions/:discussionId",
  protect,
  validateRequest([hackathonIdOrSlugParam, discussionIdParam]),
  deleteDiscussion,
);

router.post(
  "/:hackathonSlugOrId/discussions/:parentCommentId/replies",
  protect,
  validateRequest([
    hackathonIdOrSlugParam,
    parentCommentIdParam,
    ...createDiscussionSchema,
  ]),
  replyToDiscussion,
);

router.post(
  "/:hackathonSlugOrId/discussions/:discussionId/report",
  protect,
  validateRequest([
    hackathonIdOrSlugParam,
    discussionIdParam,
    ...reportDiscussionSchema,
  ]),
  reportDiscussion,
);

// Resources Routes (public - supports both slug and ID)
router.get(
  "/:hackathonSlugOrId/resources",
  optionalAuth,
  validateRequest([hackathonIdOrSlugParam]),
  getResources,
);

// Registration Routes (public - supports both slug and ID)
router.post(
  "/:hackathonSlugOrId/register",
  protect,
  validateRequest([hackathonIdOrSlugParam, ...registerSchema]),
  registerForHackathon,
);

router.get(
  "/:hackathonSlugOrId/register/status",
  protect,
  validateRequest([hackathonIdOrSlugParam]),
  checkRegistrationStatus,
);

// Team Management Routes (public - supports both slug and ID)
router.post(
  "/:hackathonSlugOrId/team/invite",
  protect,
  validateRequest([hackathonIdOrSlugParam, ...inviteTeamMemberSchema]),
  inviteTeamMember,
);

router.post(
  "/:hackathonSlugOrId/team/members",
  protect,
  validateRequest([hackathonIdOrSlugParam, ...addTeamMemberSchema]),
  addTeamMember,
);

router.delete(
  "/:hackathonSlugOrId/team/members/:memberId",
  protect,
  validateRequest([hackathonIdOrSlugParam, memberIdParam]),
  removeTeamMember,
);

router.delete(
  "/:hackathonSlugOrId/register",
  protect,
  validateRequest([hackathonIdOrSlugParam]),
  leaveHackathon,
);

router.post(
  "/:hackathonSlugOrId/team/accept",
  protect,
  validateRequest([hackathonIdOrSlugParam, ...acceptInvitationSchema]),
  acceptTeamInvitation,
);

// Team Recruitment Posts Routes (public - supports both slug and ID)
router.post(
  "/:hackathonSlugOrId/team-posts",
  protect,
  validateRequest([hackathonIdOrSlugParam, ...createTeamPostSchema]),
  createTeamPost,
);

router.get(
  "/:hackathonSlugOrId/team-posts",
  optionalAuth,
  validateRequest([hackathonIdOrSlugParam, ...getTeamPostsQuerySchema]),
  getTeamPosts,
);

router.get(
  "/:hackathonSlugOrId/team-posts/:postId",
  optionalAuth,
  validateRequest([hackathonIdOrSlugParam, postIdParam]),
  getTeamPostDetails,
);

router.put(
  "/:hackathonSlugOrId/team-posts/:postId",
  protect,
  validateRequest([
    hackathonIdOrSlugParam,
    postIdParam,
    ...updateTeamPostSchema,
  ]),
  updateTeamPost,
);

router.delete(
  "/:hackathonSlugOrId/team-posts/:postId",
  protect,
  validateRequest([hackathonIdOrSlugParam, postIdParam]),
  deleteTeamPost,
);

router.post(
  "/:hackathonSlugOrId/team-posts/:postId/contact",
  optionalAuth,
  validateRequest([hackathonIdOrSlugParam, postIdParam]),
  trackContactClick,
);

export default router;
