import { Request, Response } from "express";
import app from "./app.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { config } from "./config/main.config.js";
dotenv.config({ path: ".env.local" });

dotenv.config();

const PORT = config.PORT || 8000;

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Express & TypeScript Server");
});

app.get("/user", (req, res) => {
  res.send({
    name: "John",
    age: 30,
    city: "New York",
  });
});
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  connectDB().catch((_err) => {
    console.log("Database connection optional - server will continue running");
  });
});
