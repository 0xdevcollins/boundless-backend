import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    if (!process.env.MONGODB_URI) {
      console.error(
        "MongoDB connection string not found. Running without database.",
      );
      return;
    }

    const options = {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 30000, // 30 seconds

      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 5, // Minimum number of connections in the pool
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity

      // Retry settings
      retryWrites: true,
      retryReads: true,

      // Buffer settings to prevent timeout errors
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering

      // Heartbeat settings
      heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds

      // Additional reliability settings
      family: 4, // Use IPv4, skip trying IPv6
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log("MongoDB Connected Successfully");

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      try {
        await mongoose.connection.close();
        console.log("MongoDB connection closed through app termination");
        process.exit(0);
      } catch (err) {
        console.error("Error closing MongoDB connection:", err);
        process.exit(1);
      }
    });
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
