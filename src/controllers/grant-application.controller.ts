import { Request, Response } from "express";
import mongoose from "mongoose";
import GrantApplication from "../models/grant-application.model";
import { sendError, sendValidationError } from "../utils/apiResponse";
import { sendSuccess } from "../utils/apiResponse";
import Project from "../models/project.model";
import ContractService from "../services/contract.service";
import Account from "../models/account.model";

// Define statuses - Updated to match the model's string literals
enum ApplicationStatus {
  Submitted = "SUBMITTED",
  Paused = "PAUSED",
  Cancelled = "CANCELLED",
  AwaitingFinalApproval = "AWAITING_FINAL_APPROVAL", // ✅ Fixed to match model
}

const TRANSITION_RULES: { [key in ApplicationStatus]?: ApplicationStatus[] } = {
  [ApplicationStatus.Submitted]: [
    ApplicationStatus.Paused,
    ApplicationStatus.Cancelled,
  ],
  [ApplicationStatus.Paused]: [ApplicationStatus.Cancelled],
};

function isValidTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = TRANSITION_RULES[currentStatus as ApplicationStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus as ApplicationStatus);
}

export const updateGrantApplicationStatus = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // Check if user is authenticated
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }

    // Validate ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(
        res,
        "Invalid application ID",
        400,
        "Application ID must be a valid MongoDB ObjectId",
      );
    }

    // Validate status
    if (
      !status ||
      !Object.values(ApplicationStatus).includes(status as ApplicationStatus)
    ) {
      return sendValidationError(res, "Invalid status", {
        status: {
          msg: `Status must be one of: ${Object.values(ApplicationStatus).join(", ")}`,
        },
      });
    }

    // Validate reason
    if (!reason || reason.trim().length === 0) {
      return sendValidationError(res, "Reason required", {
        reason: { msg: "A valid reason is required to change the status." },
      });
    }

    // Fetch the application
    const application = await GrantApplication.findById(id);
    if (!application) {
      return sendError(
        res,
        "Application not found",
        404,
        "No application found with the provided ID",
      );
    }

    // Check if the transition is valid
    if (!isValidTransition(application.status, status)) {
      return sendError(
        res,
        "Invalid status transition",
        400,
        `Cannot change status from '${application.status}' to '${status}'.`,
      );
    }

    // Perform update
    application.status = status;
    // Save the updated application
    await application.save();

    // Send the application as plain object (to avoid TS issues)
    return sendSuccess(res, "Application status updated successfully");
  } catch (error: any) {
    console.error("Error updating grant application status:", error);
    if (error.name === "ValidationError") {
      const validationErrors: any = {};
      Object.keys(error.errors).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });
      return sendError(res, "Validation failed", 400, validationErrors);
    }
    return sendError(
      res,
      "Failed to update application status",
      500,
      error.message,
    );
  }
};

// PATCH /api/grant-applications/:id/escrow
export const lockEscrow = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, txHash, amount } = req.body;

    // Validate input
    if (status !== "locked") {
      return sendError(res, "Status must be 'locked'", 400);
    }
    if (!txHash || typeof txHash !== "string") {
      return sendError(res, "txHash must be a valid string", 400);
    }
    if (typeof amount !== "number" || amount <= 0) {
      return sendError(res, "amount must be a valid positive number", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid grant application ID", 400);
    }

    // Find the project containing this grant application
    const project = await Project.findOne({
      "grant.applications._id": id,
      "grant.isGrant": true,
    });
    if (!project || !project.grant) {
      return sendError(res, "Grant application not found", 404);
    }
    const application = project.grant.applications.find(
      (app) => app._id?.toString() === id,
    );
    if (!application) {
      return sendError(res, "Grant application not found in project", 404);
    }

    // Get applicant's wallet address from Account model (provider: 'stellar')
    const account = await Account.findOne({
      userId: application.applicant,
      provider: "stellar",
    });
    if (!account || !account.providerAccountId) {
      return sendError(
        res,
        "Applicant does not have a Stellar wallet address on file",
        400,
      );
    }
    const walletAddress = account.providerAccountId;

    // Call Soroban/ContractService to lock funds in escrow
    // ContractService is exported as a singleton instance
    try {
      await ContractService.fundProject({
        projectId: project._id.toString(),
        amount,
        walletAddress,
        transactionHash: txHash,
      });
    } catch (err: any) {
      return sendError(
        res,
        "Failed to lock funds in Soroban escrow",
        500,
        err.message,
      );
    }

    // Update application status and escrow details
    application.status = "IN_PROGRESS";
    application.escrowedAmount = amount;
    application.txHash = txHash;
    await project.save();
    return sendSuccess(
      res,
      application,
      "Funds locked in escrow and status updated",
      200,
    );
  } catch (error: any) {
    console.error("Error locking escrow:", error);
    return sendError(res, "Failed to lock escrow", 500, error.message);
  }
};

export const updateMilestones = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { milestones } = req.body;

    // 1. Validate ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(
        res,
        "Invalid application ID",
        400,
        "Application ID must be a valid MongoDB ObjectId",
      );
    }

    // 2. Validate milestones array and its items
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return sendValidationError(
        res,
        "Milestones array is required and cannot be empty",
        {
          milestones: {
            msg: "Milestones array must be a non-empty array of objects.",
          },
        },
      );
    }

    for (const milestone of milestones) {
      if (typeof milestone !== "object" || milestone === null) {
        return sendValidationError(res, "Invalid milestone format", {
          milestones: { msg: "Each milestone must be an object." },
        });
      }
      if (
        typeof milestone.title !== "string" ||
        milestone.title.trim().length === 0
      ) {
        return sendValidationError(res, "Milestone title is required", {
          title: { msg: "Milestone title must be a non-empty string." },
        });
      }
      if (
        typeof milestone.description !== "string" ||
        milestone.description.trim().length === 0
      ) {
        return sendValidationError(res, "Milestone description is required", {
          description: {
            msg: "Milestone description must be a non-empty string.",
          },
        });
      }
      if (
        typeof milestone.expectedPayout !== "number" ||
        milestone.expectedPayout <= 0
      ) {
        return sendValidationError(
          res,
          "Milestone expectedPayout is required and must be a positive number",
          {
            expectedPayout: {
              msg: "Milestone expectedPayout must be a positive number.",
            },
          },
        );
      }
    }

    // 3. Find the project containing this grant application
    const project = await Project.findOne({
      "grant.applications._id": id,
      "grant.isGrant": true,
    });

    if (!project || !project.grant) {
      return sendError(res, "Grant application not found", 404);
    }

    const application = project.grant.applications.find(
      (app) => app._id?.toString() === id,
    );

    if (!application) {
      return sendError(res, "Grant application not found in project", 404);
    }

    // 4. Authorization check: Ensure the user is a grant creator
    // Assuming req.user contains the authenticated user's ID and role
    // This is a placeholder. You'll need to implement actual role-based authorization.
    // For example, check if req.user.role === 'grant_creator' or if req.user.id is associated with the grant creator.
    if (!req.user || req.user.id !== project.creator.toString()) {
      return sendError(
        res,
        "Unauthorized: Only grant creators can modify milestones",
        403,
      );
    }

    // 5. Update milestones and status - ✅ Fixed property mapping
    application.milestones = milestones.map((m: any) => ({
      title: m.title,
      description: m.description,
      amount: m.expectedPayout, // ✅ Map expectedPayout to amount
    }));
    application.status = ApplicationStatus.AwaitingFinalApproval; // ✅ Now matches model

    await project.save();

    return sendSuccess(
      res,
      application,
      "Milestones updated and application status set to awaiting-final-approval",
      200,
    );
  } catch (error: any) {
    console.error("Error updating milestones:", error);
    if (error.name === "ValidationError") {
      const validationErrors: any = {};
      Object.keys(error.errors).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });
      return sendError(res, "Validation failed", 400, validationErrors);
    }
    return sendError(res, "Failed to update milestones", 500, error.message);
  }
};
