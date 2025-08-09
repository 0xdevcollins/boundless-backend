import { Request, Response, NextFunction } from "express";
import {
  verifyToken,
  roleMiddleware,
  verifyRefreshToken,
} from "../utils/jwt.utils";
import User, { IUser, UserRole } from "../models/user.model";
import mongoose from "mongoose";
import { generateTokens } from "../utils/jwt.utils";
import { setAuthCookies } from "../utils/cookie.utils";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// Helper function to extract token from request
const extractToken = (req: Request): string | null => {
  // First check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  // Then check cookies
  const tokenFromCookie = req.cookies?.token || req.cookies?.accessToken;
  if (tokenFromCookie) {
    return tokenFromCookie;
  }

  return null;
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const decoded = verifyToken(token) as { userId: string };
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      res
        .status(401)
        .json({ success: false, message: "Not authorized, user not found" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    // Only log auth errors in non-test environments
    if (process.env.NODE_ENV !== "test") {
      console.error("Auth error:", error);
    }
    res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const decoded = verifyToken(token) as { userId: string };

    // Use the already imported User model instead of dynamic import
    const user = await User.findById(decoded.userId).select("-password");

    if (user) {
      req.user = user;
    }
    // Continue even if user is not found (invalid token)
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

export const admin = roleMiddleware([UserRole.ADMIN]);

// Enhanced protect middleware with automatic token refresh
export const protectWithRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    try {
      // Try to verify the access token
      const decoded = verifyToken(token) as { userId: string };
      const user = await User.findById(decoded.userId).select("-password");

      if (!user) {
        res
          .status(401)
          .json({ success: false, message: "Not authorized, user not found" });
        return;
      }

      req.user = user;
      next();
    } catch (accessTokenError) {
      // Access token is invalid or expired, try to refresh
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      try {
        // Verify refresh token
        const refreshDecoded = verifyRefreshToken(refreshToken) as {
          userId: string;
        };
        const user = await User.findById(refreshDecoded.userId).select(
          "-password",
        );

        if (!user) {
          res.status(401).json({
            success: false,
            message: "Not authorized, user not found",
          });
          return;
        }

        // Check if user is still verified
        if (!user.isVerified) {
          res
            .status(401)
            .json({ success: false, message: "User not verified" });
          return;
        }

        // Generate new tokens
        const tokens = generateTokens({
          userId: user._id.toString(),
          email: user.email,
          roles: user.roles.map((role) => role.role),
        });

        // Set new cookies
        setAuthCookies(res, tokens);

        req.user = user;
        next();
      } catch (refreshTokenError) {
        // Refresh token is also invalid
        res
          .status(401)
          .json({ success: false, message: "Not authorized, token failed" });
      }
    }
  } catch (error) {
    // Only log auth errors in non-test environments
    if (process.env.NODE_ENV !== "test") {
      console.error("Auth error:", error);
    }
    res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};
