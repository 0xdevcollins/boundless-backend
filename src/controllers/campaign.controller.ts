import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign from "../models/campaign.model";
import Milestone from "../models/milestone.model";
import Project from "../models/project.model";
import { UserRole } from "../models/user.model";
import User from "../models/user.model";
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
    if (project.owner.type.toString() !== user._id.toString()) {
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
            documents: project.documents, // Copy documents from project
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

export const approveCampaignV2 = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user.roles.some((r) => r.role === UserRole.ADMIN)) {
      res.status(403).json({ message: "Only admins can approve campaigns." });
      return;
    }
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Valid campaignId is required." });
      return;
    }
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }
    // Validate milestones
    const milestones = await Milestone.find({ campaignId: campaign._id });
    if (!milestones.length) {
      res
        .status(400)
        .json({ message: "Campaign must have at least one milestone." });
      return;
    }
    // Validate deadline and goalAmount
    if (
      !campaign.deadline ||
      isNaN(new Date(campaign.deadline).getTime()) ||
      new Date(campaign.deadline) < new Date()
    ) {
      res
        .status(400)
        .json({ message: "Campaign deadline must be a valid future date." });
      return;
    }
    if (
      !campaign.goalAmount ||
      typeof campaign.goalAmount !== "number" ||
      campaign.goalAmount <= 0
    ) {
      res
        .status(400)
        .json({ message: "Campaign goalAmount must be a positive number." });
      return;
    }
    // Validate required documents (whitepaper or pitchDeck)
    if (
      !campaign.documents ||
      (!campaign.documents.whitepaper && !campaign.documents.pitchDeck)
    ) {
      res.status(400).json({
        message: "Campaign must have a whitepaper or pitch deck attached.",
      });
      return;
    }
    // Approve campaign
    campaign.status = "live";
    campaign.approvedBy = user._id;
    campaign.approvedAt = new Date();
    // Placeholder for Soroban deployment
    campaign.smartContractAddress = `soroban_contract_${campaign._id}`;
    await campaign.save();
    // Log approval for audit
    console.log(
      `Campaign ${campaign._id} approved by admin ${user._id} at ${campaign.approvedAt}`,
    );
    res.status(200).json({
      message: "Campaign approved and deployed to Soroban (placeholder).",
      campaign,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const getCampaignById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { include, expand, format } = req.query;

    // Validate campaign ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid campaign ID." });
    }

    // Build population options
    const populateOptions: any[] = [];
    if (expand?.toString().includes("project")) {
      populateOptions.push({
        path: "projectId",
        select: "title media documents description owner",
      });
    }
    if (expand?.toString().includes("creator")) {
      populateOptions.push({
        path: "creatorId",
        select: "name wallet roles email profile",
      });
    }

    // Fetch campaign with population
    let campaignQuery = Campaign.findById(id);
    if (populateOptions.length > 0) {
      populateOptions.forEach((pop) => {
        campaignQuery = campaignQuery.populate(pop);
      });
    }
    const campaign = await campaignQuery.lean();
    if (!campaign)
      return res.status(404).json({ message: "Campaign not found." });

    // Fetch milestones
    const milestones = await Milestone.find({ campaignId: id })
      .select(
        "title description status payoutPercentage released releasedAt index",
      )
      .sort({ index: 1 })
      .lean();

    // Funding history (optional)
    let fundingHistory: any[] = [];
    if (include?.toString().includes("contributions")) {
      fundingHistory = await Funding.find({ campaignId: id })
        .populate("userId", "name wallet profile")
        .select("userId amount txHash createdAt")
        .sort({ createdAt: -1 })
        .lean();
    }

    // Stakeholders: fallback to creator if not set
    let stakeholders = campaign.stakeholders || {};
    if ((!stakeholders || !stakeholders.creator) && campaign.creatorId) {
      const creator = await User.findById(campaign.creatorId)
        .select("profile")
        .lean();
      if (creator) {
        stakeholders = {
          ...stakeholders,
          creator: {
            wallet: creator.profile?.wallet || "",
            role: "creator",
            name: creator.profile?.firstName || "Unnamed Creator",
          },
        };
      }
    }

    // Funding progress calculation
    const fundsRaised = campaign.fundsRaised || 0;
    const goalAmount = campaign.goalAmount || 1;
    const fundingProgress = Math.min(100, (fundsRaised / goalAmount) * 100);

    // Timeline calculation
    const now = new Date();
    const deadline = new Date(campaign.deadline);
    const daysLeft = Math.max(
      0,
      Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // Minimal format
    if (format === "minimal") {
      return res.json({
        _id: campaign._id,
        title: campaign.title,
        goalAmount: campaign.goalAmount,
        fundsRaised,
        status: campaign.status,
        deadline: campaign.deadline,
        fundingProgress,
      });
    }

    // Full detail
    return res.json({
      ...campaign,
      project: campaign.projectId,
      creator: campaign.creatorId,
      milestones,
      stakeholders,
      funding: {
        goalAmount: campaign.goalAmount,
        fundsRaised,
        fundingProgress,
        fundingHistory,
      },
      timeline: {
        deadline: campaign.deadline,
        daysLeft,
        createdAt: campaign.createdAt,
      },
      trustless: {
        trustlessCampaignId: campaign.trustlessCampaignId,
        currency: campaign.currency,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error." });
  }
};
