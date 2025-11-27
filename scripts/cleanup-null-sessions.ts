/**
 * Script to clean up Better Auth sessions with null sessionToken
 * These sessions cause duplicate key errors due to the unique index
 *
 * Usage: npx ts-node scripts/cleanup-null-sessions.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

async function cleanupNullSessions() {
  let client: MongoClient | null = null;

  try {
    // Connect to MongoDB using native driver (Better Auth uses native driver)
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI environment variable is not set");
      process.exit(1);
    }

    client = new MongoClient(mongoUri);
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();
    const collection = db.collection("sessions");

    // Count sessions with null sessionToken
    const nullSessionCount = await collection.countDocuments({
      sessionToken: null,
    });

    console.log(`\nFound ${nullSessionCount} sessions with null sessionToken`);

    if (nullSessionCount === 0) {
      console.log("No null sessions to clean up");
      return;
    }

    // Also check for sessions with undefined or empty string sessionToken
    const undefinedSessionCount = await collection.countDocuments({
      $or: [
        { sessionToken: { $exists: false } },
        { sessionToken: "" },
        { sessionToken: null },
      ],
    });

    console.log(
      `Found ${undefinedSessionCount} sessions with null/undefined/empty sessionToken`,
    );

    // Delete all sessions with null, undefined, or empty sessionToken
    const deleteResult = await collection.deleteMany({
      $or: [
        { sessionToken: null },
        { sessionToken: { $exists: false } },
        { sessionToken: "" },
      ],
    });

    console.log(`\nDeleted ${deleteResult.deletedCount} invalid sessions`);

    // Verify cleanup
    const remainingNullCount = await collection.countDocuments({
      $or: [
        { sessionToken: null },
        { sessionToken: { $exists: false } },
        { sessionToken: "" },
      ],
    });

    console.log(`Remaining invalid sessions: ${remainingNullCount}`);

    // Also check for expired sessions that might cause issues
    const expiredSessions = await collection.countDocuments({
      expires: { $lt: new Date() },
    });

    console.log(`\nFound ${expiredSessions} expired sessions (not deleted)`);

    console.log("\nCleanup completed successfully");
  } catch (error) {
    console.error("Cleanup failed:", error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log("Disconnected from MongoDB");
    }
  }
}

// Run the script
cleanupNullSessions()
  .then(() => {
    console.log("\n✅ Null sessions cleanup completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Null sessions cleanup failed:", error);
    process.exit(1);
  });
