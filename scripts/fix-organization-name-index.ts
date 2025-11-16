/**
 * Script to check and fix the organization name index
 *
 * Options:
 * 1. Make it unique (if organization names should be unique)
 * 2. Remove uniqueness (if organizations can have the same name)
 *
 * Usage: npx ts-node scripts/fix-organization-name-index.ts [unique|non-unique]
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

async function fixOrganizationNameIndex(makeUnique: boolean = true) {
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

    const collection = db.collection("organizations");

    // List existing indexes
    const existingIndexes = await collection.indexes();
    console.log("\nExisting indexes on organizations collection:");
    existingIndexes.forEach((index: any) => {
      console.log(
        `  - ${index.name}: ${JSON.stringify(index.key)} (unique: ${index.unique || false})`,
      );
    });

    // Find the name index
    const nameIndex = existingIndexes.find(
      (idx: any) => idx.name === "name_1" || idx.key?.name === 1,
    );

    if (nameIndex) {
      try {
        await collection.dropIndex(nameIndex.name);
        console.log(`\nDropped existing name index: ${nameIndex.name}`);
      } catch (error: any) {
        console.warn(`Error dropping index: ${error.message}`);
      }
    } else {
      console.log("\nNo existing name index found");
    }

    // Create new index based on preference
    if (makeUnique) {
      await collection.createIndex(
        { name: 1 },
        {
          unique: true,
          name: "name_1",
        },
      );
      console.log("\nCreated unique index on name field");
      console.log("Organization names must now be unique");
    } else {
      await collection.createIndex(
        { name: 1 },
        {
          unique: false,
          name: "name_1",
        },
      );
      console.log("\nCreated non-unique index on name field");
      console.log("Organizations can now have the same name");
    }

    // Verify the new index
    const newIndexes = await collection.indexes();
    const newIndex = newIndexes.find((idx: any) => idx.name === "name_1");
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

// Get command line argument
const makeUnique = process.argv[2] !== "non-unique";

console.log(
  `\n${makeUnique ? "Making" : "Removing uniqueness from"} organization name index...`,
);

// Run the script
fixOrganizationNameIndex(makeUnique)
  .then(() => {
    console.log("\nIndex fix completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Index fix failed:", error);
    process.exit(1);
  });
