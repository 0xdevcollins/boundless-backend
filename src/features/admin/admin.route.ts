import { Router } from "express";
import { getAdminOverview } from "./admin-overview.controller.js";
import {
  getAdminUsers,
  getAdminUserById,
  updateUserStatus,
} from "./admin-users.controller.js";
import {
  getAdminHackathons,
  getAdminHackathonById,
  emailHackathonParticipants,
  contactHackathonOrganizers,
  releaseParticipantFunds,
} from "./admin-hackathons.controller.js";
import { protectAdmin } from "../../middleware/admin-auth.middleware.js";
import { adminOrSuperAdmin } from "../../middleware/admin-auth.middleware.js";

const router = Router();

// All admin routes require authentication and admin/super-admin role
router.use(protectAdmin);
router.use(adminOrSuperAdmin);

/**
 * @route   GET /api/admin/overview
 * @desc    Get admin dashboard overview metrics
 * @access  Private/Admin
 */
router.get("/overview", getAdminOverview);

/**
 * @route   GET /api/admin/users
 * @desc    Get paginated list of users
 * @access  Private/Admin
 * @query   page, limit, search, status, role
 */
router.get("/users", getAdminUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get detailed user information
 * @access  Private/Admin
 */
router.get("/users/:id", getAdminUserById);

/**
 * @route   PATCH /api/admin/users/:id/status
 * @desc    Update user status
 * @access  Private/Admin
 */
router.patch("/users/:id/status", updateUserStatus);

/**
 * @route   GET /api/admin/hackathons
 * @desc    Get paginated list of hackathons with filtering
 * @access  Private/Admin
 * @query   page, limit, search, status, organization, startDate, endDate
 */
router.get("/hackathons", getAdminHackathons);

/**
 * @route   GET /api/admin/hackathons/:id
 * @desc    Get detailed hackathon information
 * @access  Private/Admin
 */
router.get("/hackathons/:id", getAdminHackathonById);

/**
 * @route   POST /api/admin/hackathons/:id/email-participants
 * @desc    Send email to hackathon participants
 * @access  Private/Admin
 */
router.post("/hackathons/:id/email-participants", emailHackathonParticipants);

/**
 * @route   POST /api/admin/hackathons/:id/contact-organizers
 * @desc    Send email to hackathon organizers
 * @access  Private/Admin
 */
router.post("/hackathons/:id/contact-organizers", contactHackathonOrganizers);

/**
 * @route   POST /api/admin/hackathons/:hackathonId/participants/:participantId/release-funds
 * @desc    Release funds to awarded participant
 * @access  Private/Admin
 */
router.post(
  "/hackathons/:hackathonId/participants/:participantId/release-funds",
  releaseParticipantFunds,
);

export default router;
