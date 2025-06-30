import "./models";
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
import rateLimit from "express-rate-limit";

import connectDB from "./config/db";
import { setupSwagger } from "./config/swagger";
import { sendError } from "./utils/apiResponse";
import { authMiddleware } from "./utils/jwt.utils";

// Routes
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.routes";
import projectRoutes from "./routes/project.route";
import projectIdeaRoutes from "./routes/project-idea.route";
import projectVotingRoutes from "./routes/project-voting.route";
import projectCommentRoutes from "./routes/project-comment.route";
import blogRoutes from "./routes/blog.route";
import commentRoutes from "./routes/comment.route";
import adminRoutes from "./routes/admin.route";
import adminFundingRoutes from "./routes/admin.funding.route";
import analyticsRoutes from "./routes/analytics.route";
import reportRoutes from "./routes/report.route";
import notificationRoutes from "./routes/notification.route";
import { config } from "./config/main.config";

dotenv.config();

if (config.NODE_ENV !== "test") {
  connectDB();
}

const app: Application = express();

// Middlewares
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
    credentials: config.cors.credentials,
  }),
);
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());

if (config.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

// Root
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", projectIdeaRoutes);
app.use("/api/projects", projectVotingRoutes);
app.use("/api/projects", projectCommentRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/funding", adminFundingRoutes); // Assuming this is for funding, else move to admin
app.use("/api/admin", authMiddleware, adminRoutes);
app.use("/api/admin/funding", adminFundingRoutes);
app.use("/api/analytics", authMiddleware, analyticsRoutes);
app.use("/api/reports", authMiddleware, reportRoutes);
app.use("/api/notifications", authMiddleware, notificationRoutes);

// Swagger Docs
setupSwagger(app);

// 404 Handler
app.use("*", (req, res) => {
  sendError(res, `Route ${req.originalUrl} not found`, 404);
});

// Global Error Handler
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
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
