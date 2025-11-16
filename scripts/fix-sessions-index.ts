/**
 * Script to fix the Better Auth sessions collection index
 * The sessions collection has a unique index on sessionToken
 * that needs to exclude null values to prevent duplicate key errors
 *
 * Usage: npx ts-node scripts/fix-sessions-index.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

async function fixSessionsIndex() {
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

    const collection = db.collection("sessions");

    // List existing indexes
    const existingIndexes = await collection.indexes();
    console.log("\nExisting indexes on sessions collection:");
    existingIndexes.forEach((index: any) => {
      console.log(
        `  - ${index.name}: ${JSON.stringify(index.key)} (unique: ${index.unique || false})`,
      );
    });

    // Find and drop the problematic index
    const problematicIndex = existingIndexes.find(
      (idx: any) =>
        idx.name === "sessionToken_1" || idx.key?.sessionToken === 1,
    );

    if (problematicIndex && problematicIndex.name) {
      try {
        await collection.dropIndex(problematicIndex.name);
        console.log(`\nDropped existing index: ${problematicIndex.name}`);
      } catch (error: any) {
        console.warn(`Error dropping index: ${error.message}`);
      }
    } else {
      console.log("\nNo existing sessionToken_1 index found");
    }

    // Create new index with partial filter expression to exclude null values
    // Using $type: "string" instead of $ne: null because MongoDB partial indexes don't support $ne: null
    await collection.createIndex(
      { sessionToken: 1 },
      {
        unique: true,
        name: "sessionToken_1",
        partialFilterExpression: {
          sessionToken: { $type: "string" },
        },
      },
    );

    console.log(
      "\nSuccessfully created sessions index with partial filter expression",
    );
    console.log(
      "The index now excludes null values from uniqueness constraint",
    );

    // Verify the new index
    const newIndexes = await collection.indexes();
    const newIndex = newIndexes.find(
      (idx: any) => idx.name === "sessionToken_1",
    );
    if (newIndex) {
      console.log("\nNew index configuration:");
      console.log(JSON.stringify(newIndex, null, 2));
    }

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

// Run the script
fixSessionsIndex()
  .then(() => {
    console.log("\nIndex fix completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Index fix failed:", error);
    process.exit(1);
  });
