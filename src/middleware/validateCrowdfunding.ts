import { body } from "express-validator";

/**
 * Validation middleware for crowdfunding project creation
 */
export const validateCrowdfundingProject = [
  // Required fields validation
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Project name is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Project name must be between 3 and 200 characters"),

  body("logo")
    .trim()
    .notEmpty()
    .withMessage("Logo/Image is required")
    .isURL()
    .withMessage("Logo must be a valid URL"),

  body("vision")
    .trim()
    .notEmpty()
    .withMessage("Vision is required")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Vision must be between 10 and 1000 characters"),

  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),

  body("details")
    .trim()
    .notEmpty()
    .withMessage("Details (markdown) is required")
    .isLength({ min: 50, max: 10000 })
    .withMessage("Details must be between 50 and 10000 characters"),

  body("fundingAmount")
    .isNumeric()
    .withMessage("Funding amount must be a number")
    .isFloat({ min: 1 })
    .withMessage("Funding amount must be at least 1"),

  // Optional URL fields validation
  body("githubUrl")
    .optional()
    .isURL()
    .withMessage("GitHub URL must be a valid URL"),

  body("gitlabUrl")
    .optional()
    .isURL()
    .withMessage("GitLab URL must be a valid URL"),

  body("bitbucketUrl")
    .optional()
    .isURL()
    .withMessage("Bitbucket URL must be a valid URL"),

  body("projectWebsite")
    .optional()
    .isURL()
    .withMessage("Project website must be a valid URL"),

  body("demoVideo")
    .optional()
    .isURL()
    .withMessage("Demo video must be a valid URL"),

  // Milestones validation
  body("milestones")
    .isArray({ min: 1 })
    .withMessage("At least one milestone is required"),

  body("milestones.*.name")
    .trim()
    .notEmpty()
    .withMessage("Milestone name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Milestone name must be between 3 and 100 characters"),

  body("milestones.*.description")
    .trim()
    .notEmpty()
    .withMessage("Milestone description is required")
    .isLength({ min: 10, max: 500 })
    .withMessage("Milestone description must be between 10 and 500 characters"),

  body("milestones.*.startDate")
    .isISO8601()
    .withMessage("Milestone start date must be a valid date")
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error("Milestone start date must be in the future");
      }
      return true;
    }),

  body("milestones.*.endDate")
    .isISO8601()
    .withMessage("Milestone end date must be a valid date")
    .custom((value, { req, path }) => {
      const milestoneIndex = parseInt(path.split(".")[1]);
      const startDate = req.body.milestones[milestoneIndex]?.startDate;

      if (startDate && new Date(value) <= new Date(startDate)) {
        throw new Error("Milestone end date must be after start date");
      }
      return true;
    }),

  body("milestones.*.amount")
    .optional()
    .isNumeric()
    .withMessage("Milestone amount must be a number")
    .isFloat({ min: 0 })
    .withMessage("Milestone amount must be non-negative"),

  // Team validation
  body("team")
    .isArray({ min: 1 })
    .withMessage("At least one team member is required"),

  body("team.*.name")
    .trim()
    .notEmpty()
    .withMessage("Team member name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Team member name must be between 2 and 100 characters"),

  body("team.*.role")
    .trim()
    .notEmpty()
    .withMessage("Team member role is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Team member role must be between 2 and 100 characters"),

  body("team.*.email")
    .optional()
    .isEmail()
    .withMessage("Team member email must be a valid email address"),

  body("team.*.linkedin")
    .optional()
    .isURL()
    .withMessage("Team member LinkedIn must be a valid URL"),

  body("team.*.twitter")
    .optional()
    .isURL()
    .withMessage("Team member Twitter must be a valid URL"),

  // Contact validation
  body("contact.primary")
    .trim()
    .notEmpty()
    .withMessage("Primary contact is required")
    .matches(/^@?[a-zA-Z0-9_]{5,32}$/)
    .withMessage(
      "Primary contact must be a valid Telegram username (5-32 characters, alphanumeric and underscores only)",
    ),

  body("contact.backup")
    .optional()
    .custom((value) => {
      if (!value) return true;

      // Check if it's a Discord username (username#1234 or @username)
      const discordPattern =
        /^(?:@?[a-zA-Z0-9_.]{2,32}#\d{4}|@?[a-zA-Z0-9_.]{2,32})$/;
      // Check if it's a WhatsApp number (international format)
      const whatsappPattern = /^\+[1-9]\d{1,14}$/;

      if (discordPattern.test(value) || whatsappPattern.test(value)) {
        return true;
      }

      throw new Error(
        "Backup contact must be a valid Discord username or WhatsApp number",
      );
    }),

  // Social links validation
  body("socialLinks")
    .isArray({ min: 1 })
    .withMessage("At least one social link is required"),

  body("socialLinks.*.platform")
    .trim()
    .notEmpty()
    .withMessage("Social link platform is required")
    .isIn([
      "twitter",
      "linkedin",
      "facebook",
      "instagram",
      "youtube",
      "discord",
      "telegram",
      "other",
    ])
    .withMessage("Invalid social platform"),

  body("socialLinks.*.url")
    .trim()
    .notEmpty()
    .withMessage("Social link URL is required")
    .isURL()
    .withMessage("Social link URL must be a valid URL"),

  // Custom validation for milestone dates
  body().custom((body) => {
    if (body.milestones && Array.isArray(body.milestones)) {
      for (let i = 0; i < body.milestones.length; i++) {
        const milestone = body.milestones[i];
        if (milestone.startDate && milestone.endDate) {
          if (new Date(milestone.startDate) >= new Date(milestone.endDate)) {
            throw new Error(
              `Milestone ${i + 1}: Start date must be before end date`,
            );
          }
        }
      }
    }
    return true;
  }),

  // Custom validation for social links uniqueness
  body().custom((body) => {
    if (body.socialLinks && Array.isArray(body.socialLinks)) {
      const platforms = body.socialLinks.map((link: any) => link.platform);
      const uniquePlatforms = [...new Set(platforms)];
      if (platforms.length !== uniquePlatforms.length) {
        throw new Error("Social links must have unique platforms");
      }
    }
    return true;
  }),
];

/**
 * Validation middleware for updating crowdfunding project
 */
export const validateCrowdfundingUpdate = [
  // Optional fields validation (all fields are optional for updates)
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Project name must be between 3 and 200 characters"),

  body("logo").optional().isURL().withMessage("Logo must be a valid URL"),

  body("vision")
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Vision must be between 10 and 1000 characters"),

  body("category")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),

  body("details")
    .optional()
    .trim()
    .isLength({ min: 50, max: 10000 })
    .withMessage("Details must be between 50 and 10000 characters"),

  body("fundingAmount")
    .optional()
    .isNumeric()
    .withMessage("Funding amount must be a number")
    .isFloat({ min: 1 })
    .withMessage("Funding amount must be at least 1"),

  // Optional URL fields validation
  body("githubUrl")
    .optional()
    .isURL()
    .withMessage("GitHub URL must be a valid URL"),

  body("gitlabUrl")
    .optional()
    .isURL()
    .withMessage("GitLab URL must be a valid URL"),

  body("bitbucketUrl")
    .optional()
    .isURL()
    .withMessage("Bitbucket URL must be a valid URL"),

  body("projectWebsite")
    .optional()
    .isURL()
    .withMessage("Project website must be a valid URL"),

  body("demoVideo")
    .optional()
    .isURL()
    .withMessage("Demo video must be a valid URL"),
];
