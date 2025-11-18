/**
 * Hackathon Controller - Main Export File
 *
 * This file re-exports all controller functions from the modular controller files.
 * The actual implementations are split across multiple files for better organization:
 *
 * - hackathon.helpers.ts: Shared helper functions and types
 * - hackathon-draft.controller.ts: Draft management operations
 * - hackathon-crud.controller.ts: Basic CRUD operations (publish, update, get, list)
 * - hackathon-analytics.controller.ts: Statistics and analytics endpoints
 * - hackathon-participants.controller.ts: Participant management
 * - hackathon-review.controller.ts: Submission review (shortlist/disqualify)
 * - hackathon-judging.controller.ts: Judging system operations
 */

// Re-export helper types
export type { AuthenticatedRequest } from "./hackathon.helpers.js";

// Re-export draft controllers
export {
  createDraft,
  updateDraft,
  getDraft,
  getDrafts,
  previewDraft,
} from "./hackathon-draft.controller.js";

// Re-export CRUD controllers
export {
  publishHackathon,
  updateHackathon,
  getHackathon,
  getHackathons,
  deleteHackathon,
} from "./hackathon-crud.controller.js";

// Re-export analytics controllers
export {
  getHackathonStatistics,
  getHackathonAnalytics,
} from "./hackathon-analytics.controller.js";

// Re-export participant controllers
export { getParticipants } from "./hackathon-participants.controller.js";

// Re-export review controllers
export {
  shortlistSubmission,
  disqualifySubmission,
} from "./hackathon-review.controller.js";

// Re-export judging controllers
export {
  getJudgingSubmissions,
  submitGrade,
  getSubmissionScores,
} from "./hackathon-judging.controller.js";
