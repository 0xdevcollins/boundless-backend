import express from "express";
import { MongoClient } from "mongodb";
import Admin, { AdminStatus } from "../../models/admin.model.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";
import { adminAuth } from "../../lib/admin-auth.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

/**
 * GET /api/admin/setup/status
 *
 * Checks if a specific admin needs initial setup
 * Query param: email
 * Returns: { needsInitialSetup: boolean, adminExists: boolean }
 */
router.get("/admin/setup/status", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== "string") {
      return sendError(res, "Email parameter is required", 400);
    }

    // Find the admin by email
    const admin = await Admin.findOne({
      email: email.toLowerCase(),
    });

    if (!admin) {
      return sendSuccess(
        res,
        {
          needsInitialSetup: false,
          adminExists: false,
          message: "Admin account not found",
        },
        "Admin not found",
      );
    }

    // Check if admin has registered passkeys
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      return sendError(res, "Database configuration error", 500);
    }

    const client = new MongoClient(mongoUri);
    await client.connect();

    try {
      const db = client.db();
      const existingPasskeys = await db
        .collection("adminPasskeys")
        .countDocuments({ userId: admin._id.toString() });

      const hasPasskeys = existingPasskeys > 0;

      // Only auto-sync if admin hasn't explicitly completed setup
      // If they completed setup via the completion endpoint, respect that
      if (admin.needsInitialSetup) {
        // Admin still needs setup - sync with passkey status
        if (hasPasskeys) {
          admin.needsInitialSetup = false;
          await admin.save();
        }
      }
      // If needsInitialSetup is false, it means they explicitly completed setup
      // Don't override this even if passkeys don't exist yet

      return sendSuccess(
        res,
        {
          needsInitialSetup: admin.needsInitialSetup,
          adminExists: true,
          admin: {
            email: admin.email,
            name: admin.name,
            role: admin.role,
            status: admin.status,
          },
        },
        admin.needsInitialSetup
          ? "Admin needs initial passkey setup"
          : "Admin is fully configured",
      );
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error("Admin setup status check error:", error);
    sendError(res, "Failed to check setup status", 500);
  }
});

/**
 * POST /api/admin/setup/send-otp
 *
 * Sends an OTP to the admin's email for initial setup verification
 */
router.post("/admin/setup/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, "Email is required", 400);
    }

    // Verify admin exists and needs setup
    const admin = await Admin.findOne({
      email: email.toLowerCase(),
      needsInitialSetup: true,
    });

    if (!admin) {
      return sendError(res, "Admin not found or already set up", 404);
    }

    // Send OTP using Better Auth's emailOTP plugin
    const result = await adminAuth.api.sendVerificationOTP({
      body: {
        email: admin.email,
        type: "sign-in", // Use sign-in type for initial authentication
      },
    });

    if (!result.success) {
      return sendError(res, "Failed to send OTP", 500);
    }

    sendSuccess(
      res,
      {
        message: "OTP sent successfully",
        email: admin.email,
      },
      "Check your email for the verification code",
    );
  } catch (error) {
    console.error("Send OTP error:", error);
    sendError(res, "Failed to send OTP", 500);
  }
});

/**
 * POST /api/admin/setup/verify-otp
 *
 * Verifies the OTP and creates a temporary session for passkey registration
 */
router.post("/admin/setup/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendError(res, "Email and OTP are required", 400);
    }

    // Sign in with OTP to create temporary session
    const signInResult = await adminAuth.api.signInEmailOTP({
      body: {
        email: email.toLowerCase(),
        otp,
      },
    });

    // signInEmailOTP returns success data or throws on error
    // Errors are caught by the outer try-catch block

    // Get the admin to confirm they need setup
    const admin = await Admin.findOne({
      email: email.toLowerCase(),
    });

    if (!admin || !admin.needsInitialSetup) {
      return sendError(res, "Admin not found or already set up", 400);
    }

    // Return success - the session cookie is already set by Better Auth
    sendSuccess(
      res,
      {
        message: "OTP verified successfully",
        admin: {
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
        nextStep:
          "Call /api/admin-auth/passkey/add-passkey to register your passkey",
      },
      "Ready for passkey registration",
    );
  } catch (error) {
    console.error("Verify OTP error:", error);
    sendError(res, "Failed to verify OTP", 500);
  }
});

/**
 * POST /api/admin/setup/complete
 *
 * Marks an admin's initial setup as complete
 * Called after successful passkey registration
 */
router.post("/admin/setup/complete", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, "Email is required", 400);
    }

    const admin = await Admin.findOneAndUpdate(
      { email: email.toLowerCase() },
      { needsInitialSetup: false },
      { new: true },
    );

    if (!admin) {
      return sendError(res, "Admin not found", 404);
    }

    sendSuccess(
      res,
      {
        admin: {
          email: admin.email,
          name: admin.name,
          needsInitialSetup: admin.needsInitialSetup,
        },
      },
      "Admin setup completed successfully",
    );
  } catch (error) {
    console.error("Admin setup completion error:", error);
    sendError(res, "Failed to complete setup", 500);
  }
});

export default router;
