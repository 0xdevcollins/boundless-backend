import { body, param, ValidationChain } from "express-validator";

export const hackathonIdOrSlugParam: ValidationChain = param(
  "hackathonSlugOrId",
)
  .notEmpty()
  .withMessage("Hackathon ID or slug is required");

export const memberIdParam: ValidationChain = param("memberId")
  .isMongoId()
  .withMessage("Invalid member ID");

export const inviteTeamMemberSchema: ValidationChain[] = [
  body("email")
    .isEmail()
    .withMessage("Valid email address is required")
    .normalizeEmail(),
  body("role")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Role must be between 1 and 50 characters"),
];

export const addTeamMemberSchema: ValidationChain[] = [
  body("email")
    .isEmail()
    .withMessage("Valid email address is required")
    .normalizeEmail(),
];

export const acceptInvitationSchema: ValidationChain[] = [
  body("token")
    .notEmpty()
    .withMessage("Invitation token is required")
    .isLength({ min: 32 })
    .withMessage("Invalid invitation token format"),
];
