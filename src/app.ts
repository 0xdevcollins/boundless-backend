import "./models";
import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db";
import authRoutes from "./routes/auth.routes";
import router from "./routes/user.routes";
import { authMiddleware } from "./utils/jwt.utils";
import notificationRoutes from "./routes/notification.route";
import commentRoutes from "./routes/comment.route";
import { config } from "./config";
import { setupSwagger } from "./config/swagger";
import projectRoutes from "./routes.archive/project.route";
import projectIdeaRoutes from "./routes/project-idea.route";

import blogRoutes from "./routes/blog.route";

dotenv.config();

if (process.env.NODE_ENV !== "test") {
  connectDB();
}

const app: Application = express();

// Middleware
app.use(express.json());
app.use(cors(config.cors));
app.use(helmet());
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
  }),
);

app.get("/", (req, res) => {
  res.send("API is running...");
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/users", router);
app.use("/api/notifications", authMiddleware, notificationRoutes);
// app.use("/api/analytics", authMiddleware, analyticsRoutes);
// app.use("/api/reports", authMiddleware, reportsRoutes);
// app.use("/api/comments", authMiddleware, commentRoutes);
// app.use("/api/projects", authMiddleware, projectRoutes);
app.use("/api/projects", projectIdeaRoutes);

// app.use("/api/admin/funding", adminFundingRoutes);

// app.use("/api/admin", authMiddleware, adminRoutes);

// app.use("/api/admin/blogs", blogRoutes);

// Setup Swagger
setupSwagger(app);

export default app;
