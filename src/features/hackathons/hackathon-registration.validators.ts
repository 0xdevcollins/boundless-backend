import { body, param, ValidationChain } from "express-validator";

export const hackathonIdOrSlugParam: ValidationChain = param(
  "hackathonSlugOrId",
)
  .notEmpty()
  .withMessage("Hackathon ID or slug is required");

export const registerSchema: ValidationChain[] = [
  body("participationType")
    .isIn(["individual", "team"])
    .withMessage("Participation type must be 'individual' or 'team'"),
  body("teamName")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Team name must be between 1 and 100 characters")
    .custom((value, { req }) => {
      if (req.body.participationType === "team" && !value) {
        throw new Error("Team name is required for team participation");
      }
      return true;
    }),
  body("teamMembers")
    .optional()
    .isArray()
    .withMessage("Team members must be an array")
    .custom((value, { req }) => {
      if (req.body.participationType === "team" && value) {
        if (value.length > 10) {
          throw new Error("Team members cannot exceed 10");
        }
      }
      return true;
    }),
  body("teamMembers.*")
    .optional()
    .isEmail()
    .withMessage("Each team member must be a valid email address"),
];
