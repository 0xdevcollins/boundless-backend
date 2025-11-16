import { Request, Response, NextFunction } from "express";
import { sendTooManyRequests } from "../utils/apiResponse.js";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (in production, use Redis)
const store: RateLimitStore = {};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 60000); // Clean up every minute

export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later",
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = getRateLimitKey(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Initialize or get existing entry
    if (!store[key]) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    const entry = store[key];

    // Reset counter if window has expired
    if (entry.resetTime < now) {
      entry.count = 0;
      entry.resetTime = now + windowMs;
    }

    // Check if limit exceeded
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.set("Retry-After", retryAfter.toString());
      sendTooManyRequests(res, message);
      return;
    }

    // Increment counter
    entry.count++;

    // Store the original send function to check response status
    const originalSend = res.send;
    res.send = function (body: any) {
      const statusCode = res.statusCode;

      // Only count requests based on skip options
      if (
        (skipSuccessfulRequests && statusCode < 400) ||
        (skipFailedRequests && statusCode >= 400)
      ) {
        entry.count = Math.max(0, entry.count - 1);
      }

      return originalSend.call(this, body);
    };

    next();
  };
};

// Generate rate limit key based on IP and user ID
const getRateLimitKey = (req: Request): string => {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const userId = req.user?._id?.toString() || "anonymous";
  return `${ip}:${userId}`;
};

// Predefined rate limiters for common use cases
export const commentRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 comments per 15 minutes
  message: "Too many comments, please wait before posting again",
});

export const reportRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 reports per hour
  message: "Too many reports, please wait before reporting again",
});

export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: "Too many requests, please slow down",
});

// Strict rate limiter for sensitive operations
export const strictRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 requests per 5 minutes
  message: "Rate limit exceeded for sensitive operations",
});
