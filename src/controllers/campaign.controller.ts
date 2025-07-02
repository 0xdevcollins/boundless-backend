import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign from "../models/campaign.model";
import Milestone from "../models/milestone.model";
import Project from "../models/project.model";
import { UserRole } from "../models/user.model";
import Funding from "../models/funding.model";

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
      res.status(403).json({ message: "Only creators can create campaigns." });
      return;
    }

    const errors = validateCampaignInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const { projectId, goalAmount, deadline, milestones } = req.body;

    // Check project exists and is validated
    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found." });
      return;
    }
    if (project.status !== "validated") {
      res.status(400).json({
        message: "Project must be validated before launching a campaign.",
      });
      return;
    }
    // Check user is project owner
    if (project.owner.toString() !== user._id.toString()) {
      res
        .status(403)
        .json({ message: "You are not the owner of this project." });
      return;
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

      res.status(201).json({
        message: "Campaign and milestones created. Pending admin approval.",
        campaign: campaignDoc,
      });
      return;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const approveCampaign = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.roles.some((r) => r.role === UserRole.ADMIN)) {
      res.status(403).json({ message: "Only admins can approve campaigns." });
      return;
    }
    const { campaignId } = req.params;
    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      res.status(400).json({ message: "Valid campaignId is required." });
      return;
    }
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }
    if (campaign.status !== "pending_approval") {
      res.status(400).json({ message: "Campaign is not pending approval." });
      return;
    }
    // Placeholder: Deploy to Soroban smart contract
    // In real implementation, integrate with Soroban SDK/API
    const deployedAddress = `soroban_contract_${campaign._id}`; // Placeholder
    campaign.status = "live";
    campaign.smartContractAddress = deployedAddress;
    await campaign.save();
    res.status(200).json({
      message: "Campaign approved and deployed to Soroban.",
      campaign,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const backCampaign = async (req: Request, res: Response) => {
  try {
    console.log("backCampaign req.user:", req.user);
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }
    const { id } = req.params;
    const { amount, txHash } = req.body;
    // Validate input
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Valid campaignId is required." });
      return;
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ message: "Valid amount is required." });
      return;
    }
    if (!txHash || typeof txHash !== "string") {
      res.status(400).json({ message: "Valid txHash is required." });
      return;
    }
    // Find campaign
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }
    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Log funding
      const funding = await Funding.create(
        [
          {
            userId: user._id,
            campaignId: campaign._id,
            amount,
            txHash,
          },
        ],
        { session },
      );
      // Update campaign fundsRaised
      campaign.fundsRaised += amount;
      await campaign.save({ session });
      await session.commitTransaction();
      session.endSession();
      res.status(201).json({
        message: "Funding successful.",
        funding: funding[0],
        campaign,
      });
      return;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};
