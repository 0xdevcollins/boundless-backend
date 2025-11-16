import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import User, { IUser } from "../models/user.model";
import { updateUserLastLogin } from "../lib/auth-sync";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Protect route - requires authentication
 * Uses Better Auth session to authenticate users
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    // Get or sync user from our User model
    let user = await User.findOne({ email: session.user.email });

    if (!user) {
      // User exists in Better Auth but not in our User model
      // This shouldn't happen if sync is working, but handle it gracefully
      res.status(401).json({
        success: false,
        message: "User profile not found. Please contact support.",
      });
      return;
    }

    // Update last login
    await updateUserLastLogin(session.user.email);

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Auth error:", error);
    }
    res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};

/**
 * Optional authentication - doesn't require auth but attaches user if available
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session && session.user) {
      // Get user from our User model
      const user = await User.findOne({ email: session.user.email });

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
};

/**
 * Role-based middleware factory
 * Reuses the existing roleMiddleware pattern but with Better Auth
 */
export const roleMiddleware = (roles: string[]) => {
  return async (
    req: Request & { user?: IUser },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const hasRole = roles.some((role) =>
      req.user?.roles.some((r) => r.role === role),
    );
    if (!hasRole) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
};

// Export admin middleware for convenience
import { UserRole } from "../models/user.model";
export const admin = roleMiddleware([UserRole.ADMIN]);
