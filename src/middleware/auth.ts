import { Request, Response, NextFunction } from "express";
import {
  verifyToken,
  roleMiddleware,
  verifyRefreshToken,
} from "../utils/jwt.utils.js";
import User, { IUser, UserRole } from "../models/user.model.js";
import mongoose from "mongoose";
import { generateTokens } from "../utils/jwt.utils.js";
import { setAuthCookies } from "../utils/cookie.utils.js";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

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
): Promise<void> => {
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
      next();
      return;
    }

    const decoded = verifyToken(token) as { userId: string };

    const user = await User.findById(decoded.userId).select("-password");

    if (user) {
      req.user = user;
    }
    next();
  } catch (error) {
    next();
  }
};

export const admin = roleMiddleware([UserRole.ADMIN]);

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
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required" });
        return;
      }

      try {
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

        if (!user.isVerified) {
          res
            .status(401)
            .json({ success: false, message: "User not verified" });
          return;
        }

        const tokens = generateTokens({
          userId: user._id.toString(),
          email: user.email,
          roles: user.roles.map((role) => role.role),
        });

        setAuthCookies(res, tokens);

        req.user = user;
        next();
      } catch (refreshTokenError) {
        res
          .status(401)
          .json({ success: false, message: "Not authorized, token failed" });
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Auth error:", error);
    }
    res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};
