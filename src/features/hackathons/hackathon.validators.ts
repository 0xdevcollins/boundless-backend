import { body, param, query, ValidationChain } from "express-validator";
import {
  HackathonCategory,
  ParticipantType,
  VenueType,
} from "../../models/hackathon.model";

export const orgIdParam: ValidationChain = param("orgId")
  .isMongoId()
  .withMessage("Invalid organization ID");

export const draftIdParam: ValidationChain = param("draftId")
  .isMongoId()
  .withMessage("Invalid draft ID");

export const hackathonIdParam: ValidationChain = param("hackathonId")
  .isMongoId()
  .withMessage("Invalid hackathon ID");

export const informationTabSchema: ValidationChain[] = [
  body("information.title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Title must be between 3 and 100 characters"),
  body("information.banner")
    .optional()
    .isURL()
    .withMessage("Banner must be a valid URL"),
  body("information.description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage("Description must be between 10 and 5000 characters"),
  body("information.category")
    .optional()
    .isIn(Object.values(HackathonCategory))
    .withMessage(
      `Category must be one of: ${Object.values(HackathonCategory).join(", ")}`,
    ),
  body("information.venue.type")
    .optional()
    .isIn(Object.values(VenueType))
    .withMessage(
      `Venue type must be one of: ${Object.values(VenueType).join(", ")}`,
    ),
  body("information.venue.country")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Country is required for physical venues"),
  body("information.venue.state")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("State is required for physical venues"),
  body("information.venue.city")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("City is required for physical venues"),
  body("information.venue.venueName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Venue name is required for physical venues"),
  body("information.venue.venueAddress")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Venue address is required for physical venues"),
];

export const timelineTabSchema: ValidationChain[] = [
  body("timeline.startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  body("timeline.submissionDeadline")
    .optional()
    .isISO8601()
    .withMessage("Submission deadline must be a valid ISO 8601 date"),
  body("timeline.judgingDate")
    .optional()
    .isISO8601()
    .withMessage("Judging date must be a valid ISO 8601 date"),
  body("timeline.winnerAnnouncementDate")
    .optional()
    .isISO8601()
    .withMessage("Winner announcement date must be a valid ISO 8601 date"),
  body("timeline.timezone")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Timezone is required"),
  body("timeline.phases")
    .optional()
    .isArray()
    .withMessage("Phases must be an array"),
  body("timeline.phases.*.name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Phase name is required"),
  body("timeline.phases.*.startDate")
    .optional()
    .isISO8601()
    .withMessage("Phase start date must be a valid ISO 8601 date"),
  body("timeline.phases.*.endDate")
    .optional()
    .isISO8601()
    .withMessage("Phase end date must be a valid ISO 8601 date"),
  body("timeline.phases.*.description").optional().trim(),
];

export const participationTabSchema: ValidationChain[] = [
  body("participation.participantType")
    .optional()
    .isIn(Object.values(ParticipantType))
    .withMessage(
      `Participant type must be one of: ${Object.values(ParticipantType).join(", ")}`,
    ),
  body("participation.teamMin")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Team min must be between 1 and 20"),
  body("participation.teamMax")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Team max must be between 1 and 20"),
  body("participation.about").optional().trim(),
  body("participation.submissionRequirements.requireGithub")
    .optional()
    .isBoolean()
    .withMessage("requireGithub must be a boolean"),
  body("participation.submissionRequirements.requireDemoVideo")
    .optional()
    .isBoolean()
    .withMessage("requireDemoVideo must be a boolean"),
  body("participation.submissionRequirements.requireOtherLinks")
    .optional()
    .isBoolean()
    .withMessage("requireOtherLinks must be a boolean"),
  body("participation.tabVisibility.detailsTab")
    .optional()
    .isBoolean()
    .withMessage("detailsTab must be a boolean"),
  body("participation.tabVisibility.scheduleTab")
    .optional()
    .isBoolean()
    .withMessage("scheduleTab must be a boolean"),
  body("participation.tabVisibility.rulesTab")
    .optional()
    .isBoolean()
    .withMessage("rulesTab must be a boolean"),
  body("participation.tabVisibility.rewardTab")
    .optional()
    .isBoolean()
    .withMessage("rewardTab must be a boolean"),
  body("participation.tabVisibility.announcementsTab")
    .optional()
    .isBoolean()
    .withMessage("announcementsTab must be a boolean"),
  body("participation.tabVisibility.partnersTab")
    .optional()
    .isBoolean()
    .withMessage("partnersTab must be a boolean"),
  body("participation.tabVisibility.joinATeamTab")
    .optional()
    .isBoolean()
    .withMessage("joinATeamTab must be a boolean"),
  body("participation.tabVisibility.projectsTab")
    .optional()
    .isBoolean()
    .withMessage("projectsTab must be a boolean"),
  body("participation.tabVisibility.participantsTab")
    .optional()
    .isBoolean()
    .withMessage("participantsTab must be a boolean"),
];

export const rewardsTabSchema: ValidationChain[] = [
  body("rewards.prizeTiers")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one prize tier is required"),
  body("rewards.prizeTiers.*.position")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Prize tier position is required"),
  body("rewards.prizeTiers.*.amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Prize tier amount must be a non-negative number"),
  body("rewards.prizeTiers.*.currency").optional().trim(),
  body("rewards.prizeTiers.*.description").optional().trim(),
  body("rewards.prizeTiers.*.passMark")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Pass mark must be between 0 and 100"),
];

export const judgingTabSchema: ValidationChain[] = [
  body("judging.criteria")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one judging criterion is required"),
  body("judging.criteria.*.title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Criterion title is required"),
  body("judging.criteria.*.weight")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Criterion weight must be between 0 and 100"),
  body("judging.criteria.*.description").optional().trim(),
];

export const collaborationTabSchema: ValidationChain[] = [
  body("collaboration.contactEmail")
    .optional()
    .isEmail()
    .withMessage("Contact email must be a valid email address"),
  body("collaboration.telegram").optional().trim(),
  body("collaboration.discord").optional().trim(),
  body("collaboration.socialLinks")
    .optional()
    .isArray()
    .withMessage("Social links must be an array"),
  body("collaboration.socialLinks.*")
    .optional()
    .isURL()
    .withMessage("Each social link must be a valid URL"),
  body("collaboration.sponsorsPartners")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one sponsor/partner is required"),
  body("collaboration.sponsorsPartners.*.sponsorName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Sponsor name is required"),
  body("collaboration.sponsorsPartners.*.sponsorLogo")
    .optional()
    .isURL()
    .withMessage("Sponsor logo must be a valid URL"),
  body("collaboration.sponsorsPartners.*.partnerLink")
    .optional()
    .isURL()
    .withMessage("Partner link must be a valid URL"),
];

export const draftSchema: ValidationChain[] = [
  ...informationTabSchema,
  ...timelineTabSchema,
  ...participationTabSchema,
  ...rewardsTabSchema,
  ...judgingTabSchema,
  ...collaborationTabSchema,
];

export const publishSchema: ValidationChain[] = [
  body("information.title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Title must be between 3 and 100 characters"),
  body("information.banner").isURL().withMessage("Banner must be a valid URL"),
  body("information.description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 5000 })
    .withMessage("Description must be between 10 and 5000 characters"),
  body("information.category")
    .isIn(Object.values(HackathonCategory))
    .withMessage(
      `Category must be one of: ${Object.values(HackathonCategory).join(", ")}`,
    ),
  body("information.venue.type")
    .isIn(Object.values(VenueType))
    .withMessage(
      `Venue type must be one of: ${Object.values(VenueType).join(", ")}`,
    ),
  body("timeline.startDate")
    .isISO8601()
    .withMessage("Start date is required and must be a valid ISO 8601 date"),
  body("timeline.submissionDeadline")
    .isISO8601()
    .withMessage(
      "Submission deadline is required and must be a valid ISO 8601 date",
    ),
  body("timeline.judgingDate")
    .isISO8601()
    .withMessage("Judging date is required and must be a valid ISO 8601 date"),
  body("timeline.winnerAnnouncementDate")
    .isISO8601()
    .withMessage(
      "Winner announcement date is required and must be a valid ISO 8601 date",
    ),
  body("timeline.timezone")
    .trim()
    .notEmpty()
    .withMessage("Timezone is required"),
  body("participation.participantType")
    .isIn(Object.values(ParticipantType))
    .withMessage(
      `Participant type must be one of: ${Object.values(ParticipantType).join(", ")}`,
    ),
  body("rewards.prizeTiers")
    .isArray({ min: 1 })
    .withMessage("At least one prize tier is required"),
  body("judging.criteria")
    .isArray({ min: 1 })
    .withMessage("At least one judging criterion is required"),
  body("collaboration.contactEmail")
    .isEmail()
    .withMessage("Contact email is required and must be a valid email address"),
  body("collaboration.sponsorsPartners")
    .isArray({ min: 1 })
    .withMessage("At least one sponsor/partner is required"),
];

// Analytics query validators
export const analyticsQuerySchema: ValidationChain[] = [
  query("granularity")
    .optional()
    .isIn(["daily", "weekly"])
    .withMessage("Granularity must be either 'daily' or 'weekly'"),
];

// Participant review validators
export const participantIdParam: ValidationChain = param("participantId")
  .isMongoId()
  .withMessage("Invalid participant ID");

export const disqualifySchema: ValidationChain[] = [
  body("comment")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comment must not exceed 1000 characters"),
];

// Judging validators
export const gradeSubmissionSchema: ValidationChain[] = [
  body("scores")
    .isArray({ min: 1 })
    .withMessage("Scores must be a non-empty array"),
  body("scores.*.criterionTitle")
    .trim()
    .notEmpty()
    .withMessage("Criterion title is required"),
  body("scores.*.score")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Score must be a number between 0 and 100"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes must not exceed 1000 characters"),
];
