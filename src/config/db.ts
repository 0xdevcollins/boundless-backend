import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

dotenv.config();
const connectDB = async (): Promise<void> => {
  try {
    if (process.env.NODE_ENV === "test") {
      // Skip DB connection in test mode
      return;
    }
    if (!process.env.MONGODB_URI) {
      console.log(
        "MongoDB connection string not found. Running without database.",
      );
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
};

export default connectDB;
