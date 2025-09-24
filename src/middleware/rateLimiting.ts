import rateLimit from "express-rate-limit";
import { Request } from "express";

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
    error: "Rate limit exceeded",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const votingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many vote attempts, please try again later",
    error: "Voting rate limit exceeded",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.user?._id?.toString() || req.ip || "";
  },
});

export const commentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many comment attempts, please try again later",
    error: "Comment rate limit exceeded",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.user?._id?.toString() || req.ip || "";
  },
});

export const projectCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many project creation attempts, please try again later",
    error: "Project creation rate limit exceeded",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.user?._id?.toString() || req.ip || "";
  },
});

export const reportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many report attempts, please try again later",
    error: "Report rate limit exceeded",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.user?._id?.toString() || req.ip || "";
  },
});
