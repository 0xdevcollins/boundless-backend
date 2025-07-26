// src/controllers/grantApplication.controller.ts

import { Request, Response } from "express";
import GrantApplication from "../models/grant-application.model";
import { sendError, sendSuccess, sendValidationError } from "../utils/apiResponse";

export const updateGrantApplicationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // Validate ID format
    if (!id || !require("mongoose").Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid application ID", 400, "Application ID must be a valid MongoDB ObjectId");
    }

    // Validate the status
    const validStatuses = ["paused", "cancelled"];
    if (!status || !validStatuses.includes(status)) {
      return sendValidationError(res, "Invalid status", {
        status: { msg: "Status must be either 'paused' or 'cancelled'" },
      });
    }

    // Validate the reason
    if (!reason || reason.trim().length === 0) {
      return sendValidationError(res, "Reason required", {
        reason: { msg: "A valid reason is required to change the status." },
      });
    }

    // Fetch the application
    const application = await GrantApplication.findById(id);
    if (!application) {
      return sendError(res, "Application not found", 404, "No application found with the provided ID");
    }

    // Update the status and reason
    application.status = status;
    application.reason = reason;  // Assuming the model has a reason field
    await application.save();

    return sendSuccess(res, "Application status updated successfully", application);
  } catch (error: any) {
    console.error("Error updating grant application status:", error);
    
    return sendError(res, "Failed to update application status", 500, error.message);
  }
};
