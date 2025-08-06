import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign from "../models/campaign.model";
import Milestone from "../models/milestone.model";
import Project from "../models/project.model";
import { UserRole } from "../models/user.model";
import Funding from "../models/funding.model";
import {
  createTrustlessWorkService,
  TrustlessWorkEscrowRequest,
} from "../services/trustless-work.service";

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
      if (
        m.payoutPercentage !== undefined &&
        (typeof m.payoutPercentage !== "number" ||
          m.payoutPercentage < 0 ||
          m.payoutPercentage > 100)
      ) {
        errors.push(
          `Milestone ${idx + 1}: payoutPercentage must be a number between 0 and 100.`,
        );
      }
    });
  }

  // Validate stakeholders if provided
  if (body.stakeholders) {
    const requiredRoles = [
      "marker",
      "approver",
      "releaser",
      "resolver",
      "receiver",
    ];
    requiredRoles.forEach((role) => {
      if (
        !body.stakeholders[role] ||
        typeof body.stakeholders[role] !== "string"
      ) {
        errors.push(`Stakeholder ${role} address is required.`);
      }
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

    const {
      projectId,
      goalAmount,
      deadline,
      milestones,
      stakeholders,
      currency = "USDC",
    } = req.body;

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
            documents: project.documents,
            currency,
            stakeholders,
            trustlessWorkStatus: "pending",
          },
        ],
        { session },
      );
      const campaignDoc = campaign[0];

      // Create milestones with payout percentages
      const milestoneDocs = milestones.map((m: any, idx: number) => ({
        campaignId: campaignDoc._id,
        title: m.title,
        description: m.description,
        index: idx,
        payoutPercentage: m.payoutPercentage || 100 / milestones.length, // Default equal distribution
        amount:
          m.amount ||
          (goalAmount * (m.payoutPercentage || 100 / milestones.length)) / 100,
        trustlessMilestoneIndex: idx,
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

    // Validate stakeholders if Trustless Work integration is enabled
    if (!campaign.stakeholders) {
      res.status(400).json({
        message:
          "Campaign must have stakeholders defined for Trustless Work integration.",
      });
      return;
    }

    const requiredStakeholders = [
      "marker",
      "approver",
      "releaser",
      "resolver",
      "receiver",
    ] as const;
    for (const role of requiredStakeholders) {
      if (!campaign.stakeholders?.[role]) {
        res.status(400).json({
          message: `Missing required stakeholder: ${role}`,
        });
        return;
      }
    }

    // Validate milestone payout percentages
    const totalPayoutPercentage = milestones.reduce(
      (sum, milestone) => sum + (milestone.payoutPercentage || 0),
      0,
    );
    if (Math.abs(totalPayoutPercentage - 100) > 0.01) {
      // Allow for small floating point errors
      res.status(400).json({
        message: `Total milestone payout percentages must equal 100%. Current total: ${totalPayoutPercentage}%`,
      });
      return;
    }

    try {
      // Initialize Trustless Work service
      const trustlessWorkService = createTrustlessWorkService();

      // Create Trustless Work escrow request
      const escrowRequest: TrustlessWorkEscrowRequest = {
        engagementId: campaign._id?.toString() || "",
        title: `Campaign: ${campaign._id}`,
        description: `Escrow for campaign ${campaign._id}`,
        roles: campaign.stakeholders,
        platformFee: 2.5, // 2.5% platform fee
        trustline: {
          address:
            process.env.USDC_TOKEN_ADDRESS ||
            "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVBL4NKB3EKEPJXBLTNP", // USDC testnet address
          decimals: 6,
        },
        milestones: milestones.map((milestone) => ({
          description: milestone.description,
          amount:
            milestone.amount ||
            (campaign.goalAmount * (milestone.payoutPercentage || 0)) / 100,
          payoutPercentage: milestone.payoutPercentage || 0,
        })),
      };

      // Deploy escrow contract
      const escrowResponse =
        await trustlessWorkService.deployMultiReleaseEscrow(escrowRequest);

      // Update campaign with Trustless Work details
      campaign.status = "live";
      campaign.approvedBy = user._id;
      campaign.approvedAt = new Date();
      campaign.trustlessCampaignId = campaign._id?.toString() || "";
      campaign.escrowAddress = escrowResponse.escrowAddress;
      campaign.escrowType = "multi";
      campaign.trustlessWorkStatus = "deployed";
      campaign.smartContractAddress = escrowResponse.escrowAddress; // Use escrow address as smart contract address

      await campaign.save();

      // Log approval for audit
      console.log(
        `Campaign ${campaign._id} approved by admin ${user._id} at ${campaign.approvedAt}. Trustless Work escrow deployed at ${escrowResponse.escrowAddress}`,
      );

      res.status(200).json({
        message:
          "Campaign approved and Trustless Work escrow deployed successfully.",
        campaign,
        escrowAddress: escrowResponse.escrowAddress,
        xdr: escrowResponse.xdr,
      });
    } catch (trustlessError: unknown) {
      console.error("Trustless Work integration failed:", trustlessError);

      // Fallback to traditional approval without Trustless Work
      campaign.status = "live";
      campaign.approvedBy = user._id;
      campaign.approvedAt = new Date();
      campaign.trustlessWorkStatus = "failed";
      campaign.smartContractAddress = `soroban_contract_${campaign._id}`; // Fallback placeholder

      await campaign.save();

      res.status(200).json({
        message:
          "Campaign approved but Trustless Work integration failed. Using fallback deployment.",
        campaign,
        warning:
          "Trustless Work escrow deployment failed. Campaign approved with fallback deployment.",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const fundEscrow = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    const { campaignId } = req.params;
    const { amount } = req.body;

    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      res.status(400).json({ message: "Valid campaignId is required." });
      return;
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ message: "Valid amount is required." });
      return;
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }

    if (
      !campaign.escrowAddress ||
      campaign.trustlessWorkStatus !== "deployed"
    ) {
      res.status(400).json({ message: "Campaign escrow is not deployed." });
      return;
    }

    try {
      const trustlessWorkService = createTrustlessWorkService();

      const fundResponse = await trustlessWorkService.fundEscrow(
        campaign.escrowType || "multi",
        {
          escrowAddress: campaign.escrowAddress,
          amount,
        },
      );

      // Update campaign funding status
      campaign.trustlessWorkStatus = "funded";
      campaign.fundsRaised += amount;
      await campaign.save();

      res.status(200).json({
        message: "Escrow funded successfully.",
        xdr: fundResponse.xdr,
        campaign,
      });
    } catch (trustlessError: unknown) {
      console.error("Trustless Work funding failed:", trustlessError);
      res.status(500).json({
        message: "Failed to fund escrow.",
        error:
          trustlessError instanceof Error
            ? trustlessError.message
            : "Unknown error",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const approveMilestone = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    const { campaignId, milestoneIndex } = req.params;

    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      res.status(400).json({ message: "Valid campaignId is required." });
      return;
    }

    if (!milestoneIndex || isNaN(parseInt(milestoneIndex))) {
      res.status(400).json({ message: "Valid milestoneIndex is required." });
      return;
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }

    if (!campaign.escrowAddress || campaign.trustlessWorkStatus !== "funded") {
      res.status(400).json({ message: "Campaign escrow is not funded." });
      return;
    }

    // Check if user is the approver
    if (campaign.stakeholders?.approver !== user._id.toString()) {
      res
        .status(403)
        .json({ message: "Only the approver can approve milestones." });
      return;
    }

    try {
      const trustlessWorkService = createTrustlessWorkService();

      const approvalResponse = await trustlessWorkService.approveMilestone(
        campaign.escrowType || "multi",
        {
          escrowAddress: campaign.escrowAddress,
          milestoneIndex: parseInt(milestoneIndex),
        },
      );

      // Update milestone status
      const milestone = await Milestone.findOne({
        campaignId: campaign._id,
        trustlessMilestoneIndex: parseInt(milestoneIndex),
      });

      if (milestone) {
        milestone.status = "approved";
        await milestone.save();
      }

      res.status(200).json({
        message: "Milestone approved successfully.",
        xdr: approvalResponse.xdr,
        milestone,
      });
    } catch (trustlessError: unknown) {
      console.error(
        "Trustless Work milestone approval failed:",
        trustlessError,
      );
      res.status(500).json({
        message: "Failed to approve milestone.",
        error:
          trustlessError instanceof Error
            ? trustlessError.message
            : "Unknown error",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const markMilestoneComplete = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    const { campaignId, milestoneIndex } = req.params;

    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      res.status(400).json({ message: "Valid campaignId is required." });
      return;
    }

    if (!milestoneIndex || isNaN(parseInt(milestoneIndex))) {
      res.status(400).json({ message: "Valid milestoneIndex is required." });
      return;
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }

    if (!campaign.escrowAddress || campaign.trustlessWorkStatus !== "funded") {
      res.status(400).json({ message: "Campaign escrow is not funded." });
      return;
    }

    // Check if user is the marker
    if (campaign.stakeholders?.marker !== user._id.toString()) {
      res
        .status(403)
        .json({ message: "Only the marker can mark milestones as complete." });
      return;
    }

    try {
      const trustlessWorkService = createTrustlessWorkService();

      const statusResponse = await trustlessWorkService.changeMilestoneStatus(
        campaign.escrowType || "multi",
        {
          escrowAddress: campaign.escrowAddress,
          milestoneIndex: parseInt(milestoneIndex),
          status: "complete",
        },
      );

      // Update milestone status
      const milestone = await Milestone.findOne({
        campaignId: campaign._id,
        trustlessMilestoneIndex: parseInt(milestoneIndex),
      });

      if (milestone) {
        milestone.status = "completed";
        await milestone.save();
      }

      res.status(200).json({
        message: "Milestone marked as complete successfully.",
        xdr: statusResponse.xdr,
        milestone,
      });
    } catch (trustlessError: unknown) {
      console.error(
        "Trustless Work milestone status change failed:",
        trustlessError,
      );
      res.status(500).json({
        message: "Failed to mark milestone as complete.",
        error:
          trustlessError instanceof Error
            ? trustlessError.message
            : "Unknown error",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const releaseMilestoneFunds = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    const { campaignId, milestoneIndex } = req.params;

    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      res.status(400).json({ message: "Valid campaignId is required." });
      return;
    }

    if (!milestoneIndex || isNaN(parseInt(milestoneIndex))) {
      res.status(400).json({ message: "Valid milestoneIndex is required." });
      return;
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }

    if (!campaign.escrowAddress || campaign.trustlessWorkStatus !== "funded") {
      res.status(400).json({ message: "Campaign escrow is not funded." });
      return;
    }

    // Check if user is the releaser
    if (campaign.stakeholders?.releaser !== user._id.toString()) {
      res
        .status(403)
        .json({ message: "Only the releaser can release milestone funds." });
      return;
    }

    try {
      const trustlessWorkService = createTrustlessWorkService();

      const releaseResponse = await trustlessWorkService.releaseMilestoneFunds({
        escrowAddress: campaign.escrowAddress,
        milestoneIndex: parseInt(milestoneIndex),
      });

      res.status(200).json({
        message: "Milestone funds released successfully.",
        xdr: releaseResponse.xdr,
      });
    } catch (trustlessError: unknown) {
      console.error("Trustless Work fund release failed:", trustlessError);
      res.status(500).json({
        message: "Failed to release milestone funds.",
        error:
          trustlessError instanceof Error
            ? trustlessError.message
            : "Unknown error",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const getEscrowDetails = async (req: Request, res: Response) => {
  try {
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

    if (!campaign.escrowAddress) {
      res
        .status(400)
        .json({ message: "Campaign does not have an escrow address." });
      return;
    }

    try {
      const trustlessWorkService = createTrustlessWorkService();

      const escrowDetails = await trustlessWorkService.getEscrow(
        campaign.escrowType || "multi",
        campaign.escrowAddress,
      );

      res.status(200).json({
        escrowDetails,
        campaign,
      });
    } catch (trustlessError: unknown) {
      console.error(
        "Trustless Work escrow details fetch failed:",
        trustlessError,
      );
      res.status(500).json({
        message: "Failed to fetch escrow details.",
        error:
          trustlessError instanceof Error
            ? trustlessError.message
            : "Unknown error",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};
