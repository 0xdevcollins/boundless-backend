import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import connectDB from "./config/db";
dotenv.config({ path: ".env.local" });
import authRoutes from "./routes/auth.route";

dotenv.config();

connectDB();

const app: Application = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/auth", authRoutes);

export default app;
