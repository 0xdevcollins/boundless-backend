import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import User, { IUser, UserRole } from "../models/user.model";

// Always read the JWT secret from process.env at runtime
const getJwtSecret = () => process.env.JWT_SECRET || "fallback_secret";
const getRefreshTokenSecret = () =>
  process.env.JWT_REFRESH_TOKEN_SECRET || "fallback_refresh_secret";

export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
}

export const generateTokens = (payload: JwtPayload) => {
  const secret = getJwtSecret();
  const refreshSecret = getRefreshTokenSecret();
  const accessToken = jwt.sign(payload, secret, { expiresIn: "1h" });
  const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

export const verifyToken = (token: string) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};

export const verifyRefreshToken = (token: string) => {
  const refreshSecret = getRefreshTokenSecret();
  return jwt.verify(token, refreshSecret);
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Not authorized, no token" });
      return;
    }
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ message: "Not authorized, user not found" });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

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
      req.user?.roles.some((r) => r.role === (role as UserRole)),
    );
    if (!hasRole) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
};
