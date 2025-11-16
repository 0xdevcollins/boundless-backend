/**
 * Script to fix the Better Auth accounts collection index
 * The accounts collection has a unique index on provider + providerAccountId
 * that needs to exclude null values to prevent duplicate key errors
 *
 * Usage: npx ts-node scripts/fix-accounts-index.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

async function fixAccountsIndex() {
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

    const collection = db.collection("accounts");

    // List existing indexes
    const existingIndexes = await collection.indexes();
    console.log("Existing indexes on accounts collection:");
    existingIndexes.forEach((index: any) => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Find and drop the problematic index
    const problematicIndex = existingIndexes.find(
      (idx: any) =>
        idx.name === "provider_1_providerAccountId_1" ||
        (idx.key?.provider === 1 && idx.key?.providerAccountId === 1),
    );

    if (problematicIndex && problematicIndex.name) {
      try {
        await collection.dropIndex(problematicIndex.name);
        console.log(`\nDropped existing index: ${problematicIndex.name}`);
      } catch (error: any) {
        console.warn(`Error dropping index: ${error.message}`);
      }
    } else {
      console.log("\nNo existing provider_1_providerAccountId_1 index found");
    }

    // Create new index with partial filter expression to exclude null values
    // MongoDB partial indexes don't support $ne: null, so we use $type to ensure they're strings
    await collection.createIndex(
      { provider: 1, providerAccountId: 1 },
      {
        unique: true,
        name: "provider_1_providerAccountId_1",
        partialFilterExpression: {
          $and: [
            { provider: { $type: "string" } },
            { providerAccountId: { $type: "string" } },
          ],
        },
      },
    );

    console.log(
      "\nSuccessfully created accounts index with partial filter expression",
    );
    console.log(
      "The index now excludes null values from uniqueness constraint",
    );

    // Verify the new index
    const newIndexes = await collection.indexes();
    const newIndex = newIndexes.find(
      (idx: any) => idx.name === "provider_1_providerAccountId_1",
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
fixAccountsIndex()
  .then(() => {
    console.log("\nIndex fix completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Index fix failed:", error);
    process.exit(1);
  });
