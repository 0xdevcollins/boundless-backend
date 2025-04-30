import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser, UserRole } from "../models/user.model";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "7d",
  });
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key",
      ) as { userId: string };

      // Get user from the token
      req.user = await User.findById(decoded.userId).select("-password");

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

export const admin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.roles.some((role) => role.role === UserRole.ADMIN)) {
    next();
  } else {
    res.status(401).json({ message: "Not authorized as an admin" });
  }
};
