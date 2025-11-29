import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { adminAuth, AdminSession } from "../lib/admin-auth.js";
import Admin, {
  IAdmin,
  AdminRole,
  AdminStatus,
} from "../models/admin.model.js";

/**
 * Extend Express Request to include admin user
 */
declare global {
  namespace Express {
    interface Request {
      admin?: IAdmin;
      adminSession?: AdminSession;
    }
  }
}

/**
 * Protect admin route - requires admin authentication via passkey
 * Uses the separate admin Better Auth instance
 */
export const protectAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await adminAuth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      res.status(401).json({
        success: false,
        message: "Admin authentication required",
        code: "ADMIN_AUTH_REQUIRED",
      });
      return;
    }

    // Get admin from our Admin model
    let admin = await Admin.findOne({
      email: session.user.email,
    });

    if (!admin) {
      // Admin exists in Better Auth but not in our Admin model
      // This means they haven't been properly onboarded
      res.status(403).json({
        success: false,
        message: "Admin account not found. Please contact a super admin.",
        code: "ADMIN_NOT_FOUND",
      });
      return;
    }

    // Check admin status
    if (admin.status !== AdminStatus.ACTIVE) {
      res.status(403).json({
        success: false,
        message: `Admin account is ${admin.status.toLowerCase()}. Please contact a super admin.`,
        code: "ADMIN_INACTIVE",
      });
      return;
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Attach admin and session to request
    req.admin = admin;
    req.adminSession = session;
    next();
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Admin auth error:", error);
    }
    res.status(401).json({
      success: false,
      message: "Admin authentication failed",
      code: "ADMIN_AUTH_FAILED",
    });
  }
};

/**
 * Require specific admin role(s)
 * Must be used after protectAdmin middleware
 */
export const requireAdminRole = (...roles: AdminRole[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Admin authentication required",
        code: "ADMIN_AUTH_REQUIRED",
      });
      return;
    }

    if (!roles.includes(req.admin.role)) {
      res.status(403).json({
        success: false,
        message: `This action requires one of the following roles: ${roles.join(", ")}`,
        code: "INSUFFICIENT_ADMIN_ROLE",
      });
      return;
    }

    next();
  };
};

/**
 * Require specific admin permission(s)
 * Must be used after protectAdmin middleware
 */
export const requireAdminPermission = (...permissions: string[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        message: "Admin authentication required",
        code: "ADMIN_AUTH_REQUIRED",
      });
      return;
    }

    // Super admins have all permissions
    if (req.admin.role === AdminRole.SUPER_ADMIN) {
      return next();
    }

    const hasPermission = permissions.every((permission) =>
      req.admin?.permissions.includes(permission),
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: `This action requires the following permissions: ${permissions.join(", ")}`,
        code: "INSUFFICIENT_ADMIN_PERMISSIONS",
      });
      return;
    }

    next();
  };
};

/**
 * Super admin only middleware
 * Must be used after protectAdmin middleware
 */
export const superAdminOnly = requireAdminRole(AdminRole.SUPER_ADMIN);

/**
 * Admin or Super Admin middleware
 * Must be used after protectAdmin middleware
 */
export const adminOrSuperAdmin = requireAdminRole(
  AdminRole.ADMIN,
  AdminRole.SUPER_ADMIN,
);
