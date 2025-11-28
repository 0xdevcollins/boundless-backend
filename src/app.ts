import "./models/index.js";
import express, {
  type Application,
  Request,
  Response,
  NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";

import connectDB from "./config/db.js";
import { setupSwagger } from "./config/swagger.js";
import { sendError } from "./utils/apiResponse.js";
import { checkDatabaseHealth, getDatabaseStatus } from "./utils/db.utils.js";
import { auth } from "./lib/auth.js";

import { config } from "./config/main.config.js";

// Centralized route registry
import routes from "./routes/index.js";
import rateLimit from "express-rate-limit";

dotenv.config();

if (process.env.NODE_ENV === "test") {
  process.env.JWT_SECRET = "test_jwt_secret";
}

if (config.NODE_ENV !== "test") {
  // Initialize database connection
  connectDB().catch((error) => {
    console.error("Failed to connect to database:", error);
    if (config.NODE_ENV === "production") {
      process.exit(1);
    }
  });
}

const app: Application = express();

app.set("trust proxy", 1);

// Middlewares
// Configure CORS before other middleware
// Note: Better Auth handles CORS for /api/auth/* routes via trustedOrigins
// This CORS config is for other API routes
const allowedOrigins = [
  "https://boundlessfi.xyz",
  "https://www.boundlessfi.xyz",
  "https://staging.boundlessfi.xyz",
  "https://www.staging.boundlessfi.xyz",
  "http://localhost:3000", // For local frontend development
  "http://localhost:8000", // For local development
  "http://192.168.1.187:3000",
  "https://staging.api.boundlessfi.xyz",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log blocked origins for debugging (only in development)
        if (config.NODE_ENV !== "production") {
          console.warn(
            `CORS blocked origin: ${origin}. Allowed origins:`,
            allowedOrigins,
          );
        }
        // Return false to prevent CORS headers from being set
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Cookie",
      "Set-Cookie",
      "skip-auth-refresh",
    ],
    exposedHeaders: ["Set-Cookie"],
    credentials: true,
    preflightContinue: false, // CORS middleware handles preflight, don't continue
    optionsSuccessStatus: 204,
    maxAge: 86400, // 24 hours - cache preflight requests
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  }),
);
// app.use(
//   rateLimit({
//     windowMs: config.rateLimit.windowMs,
//     max: config.rateLimit.max,
//   }),
// );

// Mount Better Auth handler BEFORE express.json() middleware
// This is critical - Better Auth needs to handle requests before body parsing
app.all("/api/auth/*", toNodeHandler(auth));

// Mount express json middleware after Better Auth handler
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(compression());

if (config.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

app.get("/health", async (req: Request, res: Response) => {
  try {
    const dbHealthy = await checkDatabaseHealth();
    const dbStatus = getDatabaseStatus();

    const healthStatus = {
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      database: {
        healthy: dbHealthy,
        status: dbStatus,
      },
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(503).json({
      success: false,
      message: "Server health check failed",
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/", (req, res) => {
  res.send("API is running...");
});

// All routes registered through centralized registry
app.use(routes);

// Swagger Docs
setupSwagger(app);

// 404 Handler
app.use("*", (req, res) => {
  sendError(res, `Route ${req.originalUrl} not found`, 404);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
app.use((error: any, req: Request, res: Response, _next: NextFunction) => {
  console.error("Global error handler:", error);

  if (error.name === "ValidationError") {
    return sendError(res, "Validation Error", 400, error.message);
  }

  if (error.name === "CastError") {
    return sendError(res, "Invalid ID format", 400, error.message);
  }

  if (error.code === 11000) {
    return sendError(
      res,
      "Duplicate field value",
      409,
      "Resource already exists",
    );
  }

  if (error.name === "JsonWebTokenError") {
    return sendError(res, "Invalid token", 401, error.message);
  }

  if (error.name === "TokenExpiredError") {
    return sendError(res, "Token expired", 401, error.message);
  }

  sendError(
    res,
    config.NODE_ENV === "production" ? "Something went wrong" : error.message,
    error.statusCode || 500,
    config.NODE_ENV === "production" ? undefined : error.stack,
  );
});

export default app;
