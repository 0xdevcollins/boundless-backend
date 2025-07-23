import { Request, Response } from "express";
import Project from "../models/project.model";
import { sendSuccess, sendError } from "../utils/apiResponse";
import ContractService from "../services/contract.service";
import mongoose from "mongoose";
import Account from "../models/account.model";

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
    if (!project) {
      return sendError(res, "Grant application not found", 404);
    }
    const application = project.grant.applications.id(id);
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
    const contractService = new ContractService();
    try {
      await contractService.fundProject({
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
