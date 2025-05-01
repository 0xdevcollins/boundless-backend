import jwt, { SignOptions } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import User, { IUser, UserRole } from "../models/user.model";
import { config } from "../config";

export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
}

export const generateTokens = (payload: JwtPayload) => {
  const signOptions: SignOptions = {
    expiresIn: "15m" as const,
  };

  const accessToken = jwt.sign(
    payload,
    config.jwt.accessTokenSecret,
    signOptions,
  );

  const refreshToken = jwt.sign(
    payload,
    config.jwt.refreshTokenSecret,
    signOptions,
  );

  return { accessToken, refreshToken };
};

export const verifyToken = (token: string, secret: string): JwtPayload => {
  return jwt.verify(token, secret) as JwtPayload;
};

export const authMiddleware = async (
  req: Request & { user?: IUser },
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token, config.jwt.accessTokenSecret);

    const user = await User.findById(decoded.userId);
    req.user = user as IUser;
    if (!req.user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
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
