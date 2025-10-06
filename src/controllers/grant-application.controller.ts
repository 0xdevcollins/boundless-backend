import { Request, Response } from "express";
import mongoose from "mongoose";
import GrantApplication from "../models/grant-application.model";
import { sendError, sendValidationError } from "../utils/apiResponse";
import { sendSuccess } from "../utils/apiResponse";
import Project from "../models/project.model";
// import { ContractService } from "../services/contract.service";
import Account from "../models/account.model";

enum ApplicationStatus {
  Submitted = "SUBMITTED",
  Paused = "PAUSED",
  Cancelled = "CANCELLED",
  AwaitingFinalApproval = "AWAITING_FINAL_APPROVAL",
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

    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(
        res,
        "Invalid application ID",
        400,
        "Application ID must be a valid MongoDB ObjectId",
      );
    }

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

    if (!reason || reason.trim().length === 0) {
      return sendValidationError(res, "Reason required", {
        reason: { msg: "A valid reason is required to change the status." },
      });
    }

    const application = await GrantApplication.findById(id);
    if (!application) {
      return sendError(
        res,
        "Application not found",
        404,
        "No application found with the provided ID",
      );
    }

    if (!isValidTransition(application.status, status)) {
      return sendError(
        res,
        "Invalid status transition",
        400,
        `Cannot change status from '${application.status}' to '${status}'.`,
      );
    }
    application.status = status;
    await application.save();
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

export const lockEscrow = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, txHash, amount } = req.body;

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
    try {
      // await ContractService.fundProject({
      //   projectId: project._id.toString(),
      //   amount,
      //   walletAddress,
      //   transactionHash: txHash,
      // });
    } catch (err: any) {
      return sendError(
        res,
        "Failed to lock funds in Soroban escrow",
        500,
        err.message,
      );
    }
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
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(
        res,
        "Invalid application ID",
        400,
        "Application ID must be a valid MongoDB ObjectId",
      );
    }
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
    if (!req.user || req.user.id !== project.creator.toString()) {
      return sendError(
        res,
        "Unauthorized: Only grant creators can modify milestones",
        403,
      );
    }
    application.milestones = milestones.map((m: any) => ({
      title: m.title,
      description: m.description,
      amount: m.expectedPayout,
    }));
    application.status = ApplicationStatus.AwaitingFinalApproval;

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
