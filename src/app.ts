import express, { Application } from "express";
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
import { protect } from "./middleware/auth";
import analyticsRoutes from "./routes/analytics.route";
import reportsRoutes from "./routes/report.route";
import projectRoutes from "./routes/project.route";
import adminRoutes from "./routes/admin.routes";
dotenv.config();

connectDB();

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
app.use("/api/analytics", authMiddleware, analyticsRoutes);
app.use("/api/reports", authMiddleware, reportsRoutes);
app.use("/api/comments", authMiddleware, commentRoutes);
app.use("/api/projects", authMiddleware, projectRoutes);
app.use("/api/admin", authMiddleware, adminRoutes);
// Setup Swagger
setupSwagger(app);

export default app;
