/**
 * Migration script to fix users with null or empty usernames
 * Run this script to fix existing users in the database
 *
 * Usage: npx ts-node scripts/fix-null-usernames.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/user.model";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

/**
 * Generate a unique username from email
 */
async function generateUniqueUsername(email: string): Promise<string> {
  const emailPrefix = email.split("@")[0];
  let baseUsername = emailPrefix.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  if (!baseUsername || baseUsername.trim() === "") {
    const emailHash = Buffer.from(email)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 8);
    baseUsername = `user${emailHash}`;
  }

  let username = baseUsername;
  let counter = 1;

  while (await User.findOne({ "profile.username": username })) {
    username = `${baseUsername}${counter}`;
    counter++;
    if (counter > 10000) {
      username = `${baseUsername}${Date.now()}`;
      break;
    }
  }

  return username;
}

async function fixNullUsernames() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI environment variable is not set");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Find all users with null or empty usernames
    const usersWithNullUsername = await User.find({
      $or: [
        { "profile.username": { $exists: false } },
        { "profile.username": null },
        { "profile.username": "" },
      ],
    });

    console.log(
      `Found ${usersWithNullUsername.length} users with null or empty usernames`,
    );

    if (usersWithNullUsername.length === 0) {
      console.log("No users to fix. Exiting.");
      await mongoose.disconnect();
      return;
    }

    // Fix each user
    let fixedCount = 0;
    let errorCount = 0;

    for (const user of usersWithNullUsername) {
      try {
        if (!user.email) {
          console.error(`User ${user._id} has no email, skipping`);
          errorCount++;
          continue;
        }

        const username = await generateUniqueUsername(user.email.toLowerCase());
        user.profile.username = username;
        await user.save();

        console.log(`Fixed user ${user.email}: username = ${username}`);
        fixedCount++;
      } catch (error: any) {
        console.error(`Error fixing user ${user.email}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\nMigration complete:`);
    console.log(`- Fixed: ${fixedCount} users`);
    console.log(`- Errors: ${errorCount} users`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
fixNullUsernames()
  .then(() => {
    console.log("Migration script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exit(1);
  });
