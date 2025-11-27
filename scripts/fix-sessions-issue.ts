/**
 * Combined script to fix Better Auth sessions issues:
 * 1. Clean up sessions with null sessionToken
 * 2. Fix the sessions index to allow multiple null values
 *
 * Usage: npx ts-node scripts/fix-sessions-issue.ts
 */

import dotenv from "dotenv";
import { MongoClient } from "mongodb";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

async function fixSessionsIssue() {
  let client: MongoClient | null = null;

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI environment variable is not set");
      process.exit(1);
    }

    client = new MongoClient(mongoUri);
    await client.connect();
    console.log("✅ Connected to MongoDB\n");

    const db = client.db();
    const collection = db.collection("sessions");

    // Step 1: Clean up null sessions
    console.log("Step 1: Cleaning up sessions with null sessionToken...");
    const nullSessionCount = await collection.countDocuments({
      $or: [
        { sessionToken: null },
        { sessionToken: { $exists: false } },
        { sessionToken: "" },
      ],
    });

    console.log(
      `Found ${nullSessionCount} sessions with null/undefined/empty sessionToken`,
    );

    if (nullSessionCount > 0) {
      const deleteResult = await collection.deleteMany({
        $or: [
          { sessionToken: null },
          { sessionToken: { $exists: false } },
          { sessionToken: "" },
        ],
      });
      console.log(`✅ Deleted ${deleteResult.deletedCount} invalid sessions\n`);
    } else {
      console.log("✅ No null sessions to clean up\n");
    }

    // Step 2: Fix the index
    console.log("Step 2: Fixing sessions index...");

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
        console.log(`\n✅ Dropped existing index: ${problematicIndex.name}`);
      } catch (error: any) {
        console.warn(`⚠️  Error dropping index: ${error.message}`);
        // Continue anyway - might already be dropped
      }
    } else {
      console.log("\nℹ️  No existing sessionToken_1 index found");
    }

    // Create new index with partial filter expression to exclude null values
    // This allows multiple null values while maintaining uniqueness for non-null values
    try {
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
        "\n✅ Successfully created sessions index with partial filter expression",
      );
      console.log(
        "   The index now excludes null values from uniqueness constraint",
      );
    } catch (error: any) {
      // Index might already exist with correct configuration
      if (error.code === 85 || error.codeName === "IndexOptionsConflict") {
        console.log(
          "\nℹ️  Index already exists with different options. Checking current configuration...",
        );
      } else {
        throw error;
      }
    }

    // Verify the new index
    const newIndexes = await collection.indexes();
    const newIndex = newIndexes.find(
      (idx: any) => idx.name === "sessionToken_1",
    );
    if (newIndex) {
      console.log("\n📋 Current index configuration:");
      console.log(JSON.stringify(newIndex, null, 2));
    }

    console.log("\n✅ All fixes completed successfully!");
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log("\n🔌 Disconnected from MongoDB");
    }
  }
}

// Run the script
fixSessionsIssue()
  .then(() => {
    console.log("\n🎉 Sessions issue fix completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Sessions issue fix failed:", error);
    process.exit(1);
  });
