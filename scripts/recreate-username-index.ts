/**
 * Script to recreate the username index with proper partial filter expression
 * This ensures the index excludes null/empty values from uniqueness constraint
 *
 * Usage: npx ts-node scripts/recreate-username-index.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

async function recreateUsernameIndex() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI environment variable is not set");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not available");
    }

    const collection = db.collection("users");

    // Drop existing index if it exists
    try {
      await collection.dropIndex("profile.username_1");
      console.log("Dropped existing username index");
    } catch (error: any) {
      if (error.codeName === "IndexNotFound") {
        console.log("No existing username index found");
      } else {
        console.warn("Error dropping index (may not exist):", error.message);
      }
    }

    // Create new index with partial filter expression
    // Using $type: "string" instead of $ne: null because MongoDB partial indexes don't support $ne: null
    await collection.createIndex(
      { "profile.username": 1 },
      {
        unique: true,
        sparse: true,
        name: "profile.username_1",
        partialFilterExpression: {
          "profile.username": { $type: "string", $ne: "" },
        },
      },
    );

    console.log(
      "Successfully created username index with partial filter expression",
    );
    console.log(
      "The index now excludes null/empty values from uniqueness constraint",
    );

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

// Run the script
recreateUsernameIndex()
  .then(() => {
    console.log("Index recreation completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Index recreation failed:", error);
    process.exit(1);
  });
