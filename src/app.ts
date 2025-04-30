import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import connectDB from "./config/db";
import authRoutes from "./routes/auth.route";
import router from "./routes/user.routes";
import { protect } from "./middleware/auth";
import notificationRoutes from "./routes/notification.route";
import blockchainRoutes from "./routes/blockchain.route";
// import blockchainRoutes from "./routes/blockchain.route";
import { validateSorobanConfig } from "./config/soroban";

dotenv.config();

connectDB();
validateSorobanConfig();

const app: Application = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", router);
app.use("/api/notifications", protect, notificationRoutes);
app.use("/api/blockchain", blockchainRoutes);
// app.use("/api/blockchain", blockchainRoutes);

export default app;
