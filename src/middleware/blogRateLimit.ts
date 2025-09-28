import rateLimit from "express-rate-limit";

// Rate limiting for blog endpoints
export const blogRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More restrictive rate limiting for search endpoints
export const searchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 search requests per windowMs
  message: {
    success: false,
    message: "Too many search requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for blog creation/editing (admin endpoints)
export const blogAdminRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 blog operations per hour
  message: {
    success: false,
    message: "Too many blog operations from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
