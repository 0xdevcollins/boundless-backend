import { Request, Response, NextFunction } from "express";
import { verifyToken, roleMiddleware } from "../utils/jwt.utils";
import User, { IUser, UserRole } from "../models/user.model";
import mongoose from "mongoose";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }

    const token = authHeader.split(" ")[1];
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const token = authHeader.split(" ")[1];
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
