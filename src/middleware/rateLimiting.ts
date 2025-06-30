import rateLimit from "express-rate-limit";
import { Request } from "express";

// General API rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
    error: "Rate limit exceeded",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for voting
export const votingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 votes per windowMs
  message: {
    success: false,
    message: "Too many vote attempts, please try again later",
    error: "Voting rate limit exceeded",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP, and fallback to empty string if neither
    return req.user?._id?.toString() || req.ip || "";
  },
});

// Rate limiting for comments
export const commentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 comments per windowMs
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

// Rate limiting for project creation
export const projectCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each user to 5 project creations per hour
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

// Rate limiting for reporting
export const reportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 reports per hour
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
