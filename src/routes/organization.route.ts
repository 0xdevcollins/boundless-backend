import { Router } from "express";
import { body, param } from "express-validator";
import {
  createOrganization,
  getOrganizationById,
  updateOrganizationProfile,
  updateOrganizationLinks,
  updateOrganizationMembers,
  transferOwnership,
  deleteOrganization,
  sendInvite,
  acceptInvite,
  updateOrganizationHackathons,
  updateOrganizationGrants,
} from "../controllers/organization.controller";
import { protect } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";

const router = Router();

// Validation schemas
const createOrganizationSchema: any[] = [
  // No validation needed for create as it uses dummy data
];

const getOrganizationSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
];

const updateProfileSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),
  body("logo").optional().isURL().withMessage("Logo must be a valid URL"),
  body("tagline")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Tagline cannot exceed 200 characters"),
  body("about")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("About cannot exceed 2000 characters"),
];

const updateLinksSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("website").optional().isURL().withMessage("Website must be a valid URL"),
  body("x")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("X handle cannot exceed 50 characters"),
  body("github").optional().isURL().withMessage("GitHub must be a valid URL"),
  body("others")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Others cannot exceed 200 characters"),
];

const updateMembersSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("action")
    .isIn(["add", "remove"])
    .withMessage("Action must be 'add' or 'remove'"),
  body("email").isEmail().withMessage("Valid email is required"),
];

const transferOwnershipSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("newOwnerEmail").isEmail().withMessage("Valid email is required"),
];

const deleteOrganizationSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
];

const inviteSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("email").isEmail().withMessage("Valid email is required"),
];

const acceptInviteSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
];

const hackathonsSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("action")
    .isIn(["add", "remove"])
    .withMessage("Action must be 'add' or 'remove'"),
  body("hackathonId").isMongoId().withMessage("Invalid hackathon ID"),
];

const grantsSchema = [
  param("id").isMongoId().withMessage("Invalid organization ID"),
  body("action")
    .isIn(["add", "remove"])
    .withMessage("Action must be 'add' or 'remove'"),
  body("grantId").isMongoId().withMessage("Invalid grant ID"),
];

// Routes
router.post(
  "/",
  protect,
  validateRequest(createOrganizationSchema),
  createOrganization,
);

router.get(
  "/:id",
  protect,
  validateRequest(getOrganizationSchema),
  getOrganizationById,
);

router.patch(
  "/:id/profile",
  protect,
  validateRequest(updateProfileSchema),
  updateOrganizationProfile,
);

router.patch(
  "/:id/links",
  protect,
  validateRequest(updateLinksSchema),
  updateOrganizationLinks,
);

router.patch(
  "/:id/members",
  protect,
  validateRequest(updateMembersSchema),
  updateOrganizationMembers,
);

router.patch(
  "/:id/transfer",
  protect,
  validateRequest(transferOwnershipSchema),
  transferOwnership,
);

router.delete(
  "/:id",
  protect,
  validateRequest(deleteOrganizationSchema),
  deleteOrganization,
);

// New routes for invites
router.post("/:id/invite", protect, validateRequest(inviteSchema), sendInvite);

router.post(
  "/:id/accept-invite",
  protect,
  validateRequest(acceptInviteSchema),
  acceptInvite,
);

// New routes for hackathons and grants
router.patch(
  "/:id/hackathons",
  protect,
  validateRequest(hackathonsSchema),
  updateOrganizationHackathons,
);

router.patch(
  "/:id/grants",
  protect,
  validateRequest(grantsSchema),
  updateOrganizationGrants,
);

export default router;
