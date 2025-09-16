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
      console.error(
        "MongoDB connection string not found. Running without database.",
      );
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    // In production, you might want to exit here
    if (process.env.NODE_ENV === "production") {
      console.error("Fatal: Cannot connect to database in production");
      process.exit(1);
    }
  }
};

export default connectDB;
