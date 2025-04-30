import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import connectDB from "./config/db";
dotenv.config({ path: ".env.local" });
import authRoutes from "./routes/auth.route";
import router from "./routes/user.routes";
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
// app.use("/api/blockchain", blockchainRoutes);

export default app;
