import { Request, Response } from "express";
import Milestone from "../../models/milestone.model.js";
import Campaign from "../../models/campaign.model.js";
// Blockchain operations removed - frontend handles all transactions

type UserRoleAssignment = {
  role: string;
  grantedAt: Date;
  grantedBy: { type: unknown; ref: "User" };
  status: "ACTIVE" | "REVOKED";
};

export const submitMilestoneProof = async (req: Request, res: Response) => {
  const { milestoneId } = req.params;
  const { description, proofLinks } = req.body;
  const userId = req.user?.id;

  try {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      res.status(404).json({ message: "Milestone not found" });
      return;
    }

    const campaign = await Campaign.findById(milestone.campaignId);
    if (!campaign) {
      console.log(
        "Campaign not found for ID:",
        milestone.campaignId.toString(),
      );
      res.status(404).json({ message: "Associated campaign not found" });
      return;
    }

    if (!req.user || !userId || campaign.creatorId.toString() !== userId) {
      res
        .status(403)
        .json({ message: "Not authorized to submit proof for this milestone" });
      return;
    }

    const submittableStates = ["pending", "in-progress", "revision-requested"];
    if (!submittableStates.includes(milestone.status)) {
      res.status(409).json({
        message: "Milestone is not in a submittable state",
        currentStatus: milestone.status,
      });
      return;
    }

    milestone.proofDescription = description;
    milestone.proofLinks = proofLinks;
    milestone.status = "submitted";
    milestone.submittedAt = new Date();

    await milestone.save();

    res.status(201).json({
      success: true,
      data: {
        milestone: {
          _id: milestone._id,
          status: milestone.status,
          proofDescription: milestone.proofDescription,
          proofLinks: milestone.proofLinks,
          submittedAt: milestone.submittedAt,
        },
      },
      message: "Milestone proof submitted successfully",
    });
  } catch (err) {
    console.error("Error submitting milestone proof:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const reviewMilestone = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const { status, adminNote } = req.body;

  try {
    const milestone = await Milestone.findById(id);
    if (!milestone) {
      res.status(404).json({ message: "Milestone not found" });
      return;
    }

    if (status === "approved") {
      milestone.status = "approved";
      if (adminNote) milestone.adminNote = adminNote;
      await milestone.save();

      // triggerSorobanPayout(milestone).catch((err) => {
      //   console.error("Soroban payout error:", err);
      // });
      res.json({ message: "Milestone approved and payout triggered" });
      return;
    } else if (status === "rejected") {
      milestone.status = "revision-requested";
      if (adminNote) milestone.adminNote = adminNote;
      await milestone.save();
      res.json({
        message: "Milestone status set to revision-requested",
      });
      return;
    } else {
      res.status(400).json({ message: "Invalid status value" });
      return;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
    return;
  }
};

export const updateMilestoneStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id: campaignId, milestoneId } = req.params;
  const { status, disputeReason } = req.body;
  const userId = req.user?.id;
  const userRoles = req.user?.roles || [];

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }
    if (campaign.status !== "live") {
      res
        .status(400)
        .json({ message: "Can only update milestones for live campaigns" });
      return;
    }
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      res.status(404).json({ message: "Milestone not found" });
      return;
    }
    if (milestone.status === "released") {
      res.status(400).json({ message: "Cannot update a released milestone" });
      return;
    }

    const isAdmin = (userRoles as UserRoleAssignment[]).some(
      (r) => r.role === "admin",
    );
    const isMarker = campaign.marker && campaign.marker.toString() === userId;
    const isCreator = campaign.creatorId.toString() === userId;

    const currentStatus = milestone.status;
    let allowed = false;
    let update: any = {};

    if (status === "approved") {
      if ((isMarker && ["pending"].includes(currentStatus)) || isAdmin) {
        allowed = true;
        update.status = "approved";
        update.markedAt = new Date();
        update.markerId = isMarker ? userId : undefined;
        // Frontend handles approval transaction, backend just updates status
      }
    } else if (status === "released") {
      if (isAdmin && currentStatus === "approved") {
        allowed = true;
        update.status = "released";
        update.releasedAt = new Date();
        // Frontend handles fund release transaction, backend just records it
        const { transactionHash } = req.body;
        if (transactionHash) {
          update.releaseTxHash = transactionHash; // Model supports releaseTxHash
        }
      }
    } else if (status === "rejected") {
      if ((isMarker && ["pending"].includes(currentStatus)) || isAdmin) {
        allowed = true;
        update.status = "rejected";
        update.markedAt = new Date();
        update.markerId = isMarker ? userId : undefined;
      }
    } else if (status === "disputed") {
      if (isCreator && ["approved", "rejected"].includes(currentStatus)) {
        allowed = true;
        update.status = "disputed";
        update.disputedAt = new Date();
        update.disputeReason = disputeReason;
        // Frontend handles dispute transaction, backend just records status
      }
    }

    if (!allowed) {
      res.status(400).json({
        message: "Invalid status transition or insufficient permissions",
      });
      return;
    }

    Object.assign(milestone, update);
    await milestone.save();
    res.status(200).json({ success: true, milestone });
    return;
  } catch (err) {
    console.error("Error updating milestone status:", err);
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};
