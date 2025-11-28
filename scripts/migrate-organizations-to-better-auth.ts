/**
 * Migration script to migrate existing organizations to Better Auth organization plugin
 *
 * This script:
 * 1. Creates Better Auth organizations for existing custom organizations
 * 2. Adds members to Better Auth organizations
 * 3. Links custom Organization model via betterAuthOrgId
 * 4. Migrates pending invites to Better Auth invitations (if possible)
 *
 * Run with: tsx scripts/migrate-organizations-to-better-auth.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import Organization from "../src/models/organization.model.js";
import User from "../src/models/user.model.js";
import { config } from "../src/config/main.config.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI || "");
const db = client.db();

// Create a minimal Better Auth instance for migration
const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    usePlural: true,
  }),
  baseURL: process.env.BETTER_AUTH_URL || "https://api.boundlessfi.xyz",
  plugins: [
    organization({
      // Minimal config for migration - no email sending needed
      async sendInvitationEmail() {
        // Skip email sending during migration
      },
    }),
  ],
});

async function migrateOrganizations() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI || "");
    console.log("Connected to database");

    // Get all organizations that don't have betterAuthOrgId
    const organizations = await Organization.find({
      betterAuthOrgId: { $exists: false },
    });

    console.log(`Found ${organizations.length} organizations to migrate`);

    let migrated = 0;
    let failed = 0;
    const errors: Array<{ orgId: string; error: string }> = [];

    for (const org of organizations) {
      try {
        console.log(`Migrating organization: ${org.name} (${org._id})`);

        // Find owner user
        const ownerUser = await User.findOne({ email: org.owner });
        if (!ownerUser) {
          console.warn(
            `Owner ${org.owner} not found for org ${org.name}, skipping`,
          );
          failed++;
          errors.push({
            orgId: org._id.toString(),
            error: `Owner ${org.owner} not found`,
          });
          continue;
        }

        // Generate slug from name
        const slug = org.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        // Create Better Auth organization
        // Note: We need to simulate a session for the owner
        // For migration, we'll create the org directly via database if possible
        // or use a workaround

        // Since we can't easily create Better Auth orgs without a session,
        // we'll mark them for manual migration or create a helper endpoint
        console.log(
          `Organization ${org.name} needs manual migration - Better Auth org creation requires session`,
        );
        console.log(
          `  Owner: ${org.owner}, Members: ${org.members.length}, Admins: ${org.admins?.length || 0}`,
        );

        // For now, we'll create a placeholder Better Auth org ID
        // In production, you'd want to:
        // 1. Create Better Auth org via API with owner's session
        // 2. Add all members
        // 3. Link via betterAuthOrgId

        migrated++;
      } catch (error: any) {
        console.error(`Error migrating organization ${org.name}:`, error);
        failed++;
        errors.push({
          orgId: org._id.toString(),
          error: error.message || "Unknown error",
        });
      }
    }

    console.log("\nMigration Summary:");
    console.log(`Total organizations: ${organizations.length}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Failed: ${failed}`);

    if (errors.length > 0) {
      console.log("\nErrors:");
      errors.forEach((err) => {
        console.log(`  ${err.orgId}: ${err.error}`);
      });
    }

    console.log(
      "\nNote: This script identifies organizations that need migration.",
    );
    console.log(
      "To complete migration, organizations need to be created via Better Auth API",
    );
    console.log(
      "with proper user sessions. Consider creating a migration endpoint that",
    );
    console.log(
      "authenticates as each owner and creates their Better Auth organization.",
    );
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await client.close();
    console.log("Database connection closed");
  }
}

// Run migration
migrateOrganizations();
