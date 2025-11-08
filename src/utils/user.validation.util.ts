import { body } from "express-validator";

export const validateProfileUpdate = [
  body("firstName")
    .optional()
    .isString()
    .withMessage("First name must be a string"),
  body("lastName")
    .optional()
    .isString()
    .withMessage("Last name must be a string"),
  body("username")
    .optional()
    .isString()
    .withMessage("Username must be a string"),
  body("bio").optional().isString().withMessage("Bio must be a string"),
  body("location")
    .optional()
    .isString()
    .withMessage("Location must be a string"),
  body("website").optional().isURL().withMessage("Website must be a valid URL"),
  body("socialLinks.twitter")
    .optional()
    .isURL()
    .withMessage("Twitter link must be a valid URL"),
  body("socialLinks.linkedin")
    .optional()
    .isURL()
    .withMessage("LinkedIn link must be a valid URL"),
  body("socialLinks.github")
    .optional()
    .isURL()
    .withMessage("GitHub link must be a valid URL"),
  body("socialLinks.discord")
    .optional()
    .isString()
    .withMessage("Discord username must be a string"),
];

export const validateSettingsUpdate = [
  body("notifications.email")
    .optional()
    .isBoolean()
    .withMessage("Email notification setting must be a boolean"),
  body("notifications.push")
    .optional()
    .isBoolean()
    .withMessage("Push notification setting must be a boolean"),
  body("notifications.inApp")
    .optional()
    .isBoolean()
    .withMessage("In-app notification setting must be a boolean"),
  body("privacy.profileVisibility")
    .optional()
    .isIn(["PUBLIC", "PRIVATE", "FRIENDS_ONLY"])
    .withMessage("Invalid profile visibility setting"),
  body("privacy.showWalletAddress")
    .optional()
    .isBoolean()
    .withMessage("Show wallet address setting must be a boolean"),
  body("privacy.showContributions")
    .optional()
    .isBoolean()
    .withMessage("Show contributions setting must be a boolean"),
  body("preferences.language")
    .optional()
    .isString()
    .withMessage("Language must be a string"),
  body("preferences.timezone")
    .optional()
    .isString()
    .withMessage("Timezone must be a string"),
  body("preferences.theme")
    .optional()
    .isIn(["LIGHT", "DARK", "SYSTEM"])
    .withMessage("Invalid theme setting"),
];

export const validateSecurityUpdate = [
  body("currentPassword").exists().withMessage("Current password is required"),
  body("newPassword")
    .optional()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("twoFactorEnabled")
    .optional()
    .isBoolean()
    .withMessage("Two-factor enabled must be a boolean"),
  body("twoFactorCode")
    .optional()
    .isString()
    .withMessage("Two-factor code must be a string"),
];
