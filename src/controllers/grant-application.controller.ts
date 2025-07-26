import { Request, Response } from "express";
import mongoose from "mongoose"; // Import mongoose for ObjectId validation
import GrantApplication from "../models/grant-application.model";
import { sendError, sendValidationError } from "../utils/apiResponse";
import { sendSuccess} from "../utils/apiResponse";


// Define statuses
enum ApplicationStatus {
  Submitted = "submitted",
  Paused = "paused",
  Cancelled = "cancelled",
}

const TRANSITION_RULES: { [key in ApplicationStatus]?: ApplicationStatus[] } = {
  [ApplicationStatus.Submitted]: [ApplicationStatus.Paused, ApplicationStatus.Cancelled],
  [ApplicationStatus.Paused]: [ApplicationStatus.Cancelled],
};


function isValidTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = TRANSITION_RULES[currentStatus as ApplicationStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus as ApplicationStatus);
}

export const updateGrantApplicationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // Check if user is authenticated
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }

    // Validate ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid application ID", 400, "Application ID must be a valid MongoDB ObjectId");
    }

    // Validate status
    if (
      !status ||
      !Object.values(ApplicationStatus).includes(status as ApplicationStatus)
    ) {
      return sendValidationError(res, "Invalid status", {
        status: { msg: `Status must be one of: ${Object.values(ApplicationStatus).join(', ')}` },
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
      return sendError(res, "Application not found", 404, "No application found with the provided ID");
    }

    // Check if the transition is valid
    if (!isValidTransition(application.status, status)) {
      return sendError(res, "Invalid status transition", 400, 
        `Cannot change status from '${application.status}' to '${status}'.`
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
    return sendError(res, "Failed to update application status", 500, error.message);
  }
};