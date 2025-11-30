import { Router } from "express";
import { getAdminOverview } from "./admin-overview.controller.js";
import {
  getAdminUsers,
  getAdminUserById,
  updateUserStatus,
} from "./admin-users.controller.js";
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

export default router;
