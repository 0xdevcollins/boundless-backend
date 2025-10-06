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

const validateCampaignInput = (body: any) => {
  const errors: string[] = [];
  if (!body.title || typeof body.title !== "string") {
    errors.push("Campaign title is required.");
  }
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
      title,
      projectId,
      goalAmount,
      deadline,
      milestones,
      stakeholders,
      currency = "USDC",
    } = req.body;

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

    if (project.owner.type.toString() !== user._id.toString()) {
      res
        .status(403)
        .json({ message: "You are not the owner of this project." });
      return;
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const campaign = await Campaign.create(
        [
          {
            title,
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
      if (stakeholders) {
        try {
          const trustlessWorkService = createTrustlessWorkService();
          const escrowRequest: TrustlessWorkEscrowRequest = {
            signer: campaignDoc.creatorId.toString(),
            engagementId: campaignDoc._id?.toString() || "",
            title: `Campaign: ${campaignDoc._id}`,
            description: `Escrow for campaign ${campaignDoc._id}`,
            roles: stakeholders,
            platformFee: Number(process.env.PLATFORM_FEE),
            trustline: {
              address:
                process.env.USDC_TOKEN_ADDRESS ||
                "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVBL4NKB3EKEPJXBLTNP",
              decimals: 6,
            },
            milestones: milestones.map(
              (milestone: {
                description: string;
                amount: number;
                payoutPercentage: number;
              }) => ({
                description: milestone.description,
                amount:
                  milestone.amount ||
                  (goalAmount *
                    (milestone.payoutPercentage || 100 / milestones.length)) /
                    100,
                payoutPercentage:
                  milestone.payoutPercentage || 100 / milestones.length,
              }),
            ),
          };

          const escrowResponse =
            await trustlessWorkService.deployMultiReleaseEscrow(escrowRequest);
          campaignDoc.trustlessCampaignId = campaignDoc._id?.toString() || "";
          campaignDoc.escrowType = "multi";
          campaignDoc.trustlessWorkStatus = "deployed";
        } catch (error) {
          console.error("Escrow initialization failed:", error);
          campaignDoc.trustlessWorkStatus = "failed";
        }
      }
      const milestoneDocs = milestones.map((m: any, idx: number) => ({
        campaignId: campaignDoc._id,
        title: m.title,
        description: m.description,
        index: idx,
        payoutPercentage: m.payoutPercentage || 100 / milestones.length,
        amount:
          m.amount ||
          (goalAmount * (m.payoutPercentage || 100 / milestones.length)) / 100,
        trustlessMilestoneIndex: idx,
      }));
      await Milestone.insertMany(milestoneDocs, { session });
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
    const deployedAddress = `soroban_contract_${campaign._id}`;
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
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
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
          signer: campaign.escrowAddress,
          contractId: campaign.escrowAddress,
          amount,
        },
      );
      campaign.trustlessWorkStatus = "funded";
      campaign.fundsRaised += amount;
      await campaign.save();

      res.status(200).json({
        message: "Escrow funded successfully.",
        xdr: fundResponse.unsignedTransaction,
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

export const getCampaignById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid campaign ID." });
      return;
    }

    let query = Campaign.findById(id)
      .select(
        "goalAmount fundsRaised status deadline currency trustlessCampaignId",
      )
      .populate({
        path: "projectId",
        select: "media documents title description",
      })
      .populate({
        path: "creatorId",
        select: "walletAddress profile.username",
      })
      .lean();

    const { include, expand, format } = req.query as Record<string, string>;
    if (expand?.split(",").includes("marker")) {
      query = query.populate({ path: "marker", select: "walletAddress role" });
    }
    if (expand?.split(",").includes("releaser")) {
      query = query.populate({
        path: "releaser",
        select: "walletAddress role",
      });
    }
    if (expand?.split(",").includes("resolver")) {
      query = query.populate({
        path: "resolver",
        select: "walletAddress role",
      });
    }

    const campaign = await query;
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }

    let milestones = await Milestone.find({ campaignId: id })
      .select("title description index status payoutPercent proofUrl")
      .sort("index")
      .lean();

    const fundings =
      include === "contributions"
        ? await Funding.find({ campaignId: id })
            .select("userId amount createdAt")
            .lean()
        : [];
    const totalRaised = campaign.fundsRaised;
    const percentFunded =
      campaign.goalAmount > 0
        ? Math.min(100, (totalRaised / campaign.goalAmount) * 100)
        : 0;

    if (format === "minimal") {
      res.json({
        id,
        title: (campaign.projectId as any)?.title || "Untitled Campaign",
        status: campaign.status,
      });
      return;
    }

    const response: any = {
      ...campaign,
      title: (campaign.projectId as any)?.title || "Untitled Campaign",
      funding: {
        goal: campaign.goalAmount,
        raised: totalRaised,
        percentFunded,
        contributions: fundings,
      },
      milestones,
    };

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
};
