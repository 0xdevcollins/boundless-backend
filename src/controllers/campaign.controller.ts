import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign from "../models/campaign.model";
import Milestone from "../models/milestone.model";
import Project from "../models/project.model";
import { UserRole } from "../models/user.model";

// Validation utility (can be moved to a separate file if needed)
const validateCampaignInput = (body: any) => {
  const errors: string[] = [];
  if (!body.projectId || !mongoose.Types.ObjectId.isValid(body.projectId)) {
    errors.push("Valid projectId is required.");
  }
  if (
    !body.goalAmount ||
    typeof body.goalAmount !== "number" ||
    body.goalAmount <= 0
  ) {
    errors.push("Valid goalAmount is required.");
  }
  if (!body.deadline || isNaN(Date.parse(body.deadline))) {
    errors.push("Valid deadline is required.");
  }
  if (!Array.isArray(body.milestones) || body.milestones.length === 0) {
    errors.push("At least one milestone is required.");
  } else {
    body.milestones.forEach((m: any, idx: number) => {
      if (!m.title || typeof m.title !== "string")
        errors.push(`Milestone ${idx + 1}: title is required.`);
      if (!m.description || typeof m.description !== "string")
        errors.push(`Milestone ${idx + 1}: description is required.`);
    });
  }
  return errors;
};

export const createCampaign = async (req: Request, res: Response) => {
  try {
    // Only creators can create campaigns
    const user = req.user;
    if (!user || !user.roles.some((r) => r.role === UserRole.CREATOR)) {
      return res
        .status(403)
        .json({ message: "Only creators can create campaigns." });
    }

    const errors = validateCampaignInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const { projectId, goalAmount, deadline, milestones } = req.body;

    // Check project exists and is validated
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }
    if (project.status !== "validated") {
      return res.status(400).json({
        message: "Project must be validated before launching a campaign.",
      });
    }
    // Check user is project owner
    if (project.owner.toString() !== user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You are not the owner of this project." });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Create campaign
      const campaign = await Campaign.create(
        [
          {
            projectId,
            creatorId: user._id,
            goalAmount,
            deadline,
            status: "draft",
          },
        ],
        { session },
      );
      const campaignDoc = campaign[0];

      // Create milestones
      const milestoneDocs = milestones.map((m: any, idx: number) => ({
        campaignId: campaignDoc._id,
        title: m.title,
        description: m.description,
        index: idx,
      }));
      await Milestone.insertMany(milestoneDocs, { session });

      // Set campaign status to pending_approval
      campaignDoc.status = "pending_approval";
      await campaignDoc.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        message: "Campaign and milestones created. Pending admin approval.",
        campaign: campaignDoc,
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const approveCampaign = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.roles.some((r) => r.role === UserRole.ADMIN)) {
      return res
        .status(403)
        .json({ message: "Only admins can approve campaigns." });
    }
    const { campaignId } = req.params;
    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: "Valid campaignId is required." });
    }
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found." });
    }
    if (campaign.status !== "pending_approval") {
      return res
        .status(400)
        .json({ message: "Campaign is not pending approval." });
    }
    // Placeholder: Deploy to Soroban smart contract
    // In real implementation, integrate with Soroban SDK/API
    const deployedAddress = `soroban_contract_${campaign._id}`; // Placeholder
    campaign.status = "live";
    campaign.smartContractAddress = deployedAddress;
    await campaign.save();
    return res.status(200).json({
      message: "Campaign approved and deployed to Soroban.",
      campaign,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export { createCampaign };
