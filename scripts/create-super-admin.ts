/**
 * Create Super Admin Script
 *
 * This script creates the initial super admin user in the system.
 * The admin will need to register their passkey after creation.
 *
 * Usage:
 *   npx tsx scripts/create-super-admin.ts --email admin@example.com --name "Admin Name"
 *
 * Or run interactively:
 *   npx tsx scripts/create-super-admin.ts
 */

import { MongoClient, ObjectId } from "mongodb";
import mongoose from "mongoose";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config({ path: ".env.local" });

// Admin roles and status
enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
}

enum AdminStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING = "PENDING",
}

interface CreateAdminOptions {
  email: string;
  name: string;
}

// Parse command line arguments
function parseArgs(): Partial<CreateAdminOptions & { yes?: boolean }> {
  const args = process.argv.slice(2);
  const options: Partial<CreateAdminOptions & { yes?: boolean }> = {};

  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    const value = args[i + 1];

    if (key === "--email" && value) {
      options.email = value;
      i++; // Skip next arg
    } else if (key === "--name" && value) {
      options.name = value;
      i++; // Skip next arg
    } else if (key === "--yes" || key === "-y") {
      options.yes = true;
    }
  }

  return options;
}

// Prompt for input
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function createSuperAdmin(options: CreateAdminOptions): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error("❌ MONGODB_URI environment variable is not set");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db();

    // Check if admin already exists in adminUsers collection
    const existingBetterAuthUser = await db
      .collection("adminUsers")
      .findOne({ email: options.email.toLowerCase() });

    if (existingBetterAuthUser) {
      console.error(
        `❌ Admin with email ${options.email} already exists in adminUsers collection`,
      );
      process.exit(1);
    }

    // Check if admin exists in custom Admin model
    const existingAdmin = await db
      .collection("admins")
      .findOne({ email: options.email.toLowerCase() });

    if (existingAdmin) {
      console.error(
        `❌ Admin with email ${options.email} already exists in admins collection`,
      );
      process.exit(1);
    }

    const now = new Date();
    const odId = new ObjectId();

    // Create user in Better Auth's adminUsers collection
    const betterAuthUser = {
      id: odId.toString(),
      email: options.email.toLowerCase(),
      name: options.name,
      emailVerified: true,
      image: null,
      role: "super_admin",
      status: "active",
      permissions: [],
      lastLogin: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("adminUsers").insertOne(betterAuthUser);
    console.log("✅ Created Better Auth admin user");

    // Create corresponding entry in custom Admin model
    const customAdmin = {
      _id: odId,
      email: options.email.toLowerCase(),
      name: options.name,
      image: null,
      emailVerified: true,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      permissions: ["*"], // Super admin has all permissions
      needsInitialSetup: true, // New admins need initial setup
      lastLogin: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("admins").insertOne(customAdmin);
    console.log("✅ Created custom Admin model entry");

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Super Admin created successfully!");
    console.log("=".repeat(60));
    console.log(`\n📧 Email: ${options.email}`);
    console.log(`👤 Name: ${options.name}`);
    console.log(`🔑 Role: SUPER_ADMIN`);
    console.log(`✅ Status: ACTIVE`);
    console.log("\n" + "=".repeat(60));
    console.log("📝 NEXT STEPS:");
    console.log("=".repeat(60));
    console.log("\n1. Start the backend server:");
    console.log("   npm run dev\n");
    console.log("2. Navigate to your admin dashboard and register a passkey:");
    console.log("   - The admin must authenticate first (one-time setup)");
    console.log("   - Then register a passkey using the WebAuthn API\n");
    console.log("3. Example passkey registration (client-side):");
    console.log(`
   // Step 1: Initialize admin setup (creates temporary session)
   const setupResponse = await fetch('/api/admin/setup/initial-passkey', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       email: '${options.email}',
       passkeyName: 'My Admin Passkey'
     })
   });

   if (setupResponse.ok) {
     // Step 2: Register the passkey (temporary session cookie is set)
     const passkeyResponse = await fetch('/api/admin-auth/passkey/add-passkey', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include', // Important: sends the temp session cookie
       body: JSON.stringify({
         name: 'My Admin Passkey',
         authenticatorAttachment: 'platform'
       })
     });

     if (passkeyResponse.ok) {
       console.log('Passkey registered! You can now sign in normally.');
       window.location.href = '/admin/dashboard';
     }
   }
`);
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("❌ Error creating super admin:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("👋 Disconnected from MongoDB");
  }
}

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 Boundless Admin - Super Admin Creation Script");
  console.log("=".repeat(60) + "\n");

  const args = parseArgs();

  let email = args.email;
  let name = args.name;

  // Prompt for email if not provided
  if (!email) {
    email = await prompt("📧 Enter admin email: ");
  }

  if (!email || !isValidEmail(email)) {
    console.error("❌ Invalid email address");
    process.exit(1);
  }

  // Prompt for name if not provided
  if (!name) {
    name = await prompt("👤 Enter admin name: ");
  }

  if (!name || name.length < 2) {
    console.error("❌ Name must be at least 2 characters");
    process.exit(1);
  }

  // Confirm creation (unless --yes flag is used)
  const cliArgs = parseArgs();

  console.log(`\n📋 Creating super admin with:`);
  console.log(`   Email: ${email}`);
  console.log(`   Name: ${name}`);

  if (!cliArgs.yes) {
    const confirm = await prompt("\n⚠️  Proceed? (yes/no): ");

    if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
      console.log("❌ Cancelled");
      process.exit(0);
    }
  } else {
    console.log("\n⚠️  Proceeding automatically (--yes flag used)");
  }

  await createSuperAdmin({ email, name });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
