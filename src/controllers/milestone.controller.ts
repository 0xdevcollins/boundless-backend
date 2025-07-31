import { Request, Response } from "express";
import Milestone from "../models/milestone.model";
import Campaign from "../models/campaign.model";
import { triggerSorobanPayout } from "../services/contract.service";

export const submitMilestoneProof = async (req: Request, res: Response) => {
  const { milestoneId } = req.params;
  const { description, proofLinks } = req.body;
  const userId = req.user?.id;

  try {
    // Find the milestone
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      res.status(404).json({ message: "Milestone not found" });
      return;
    }

    // Fetch the campaign separately
    const campaign = await Campaign.findById(milestone.campaignId);
    if (!campaign) {
      console.log(
        "Campaign not found for ID:",
        milestone.campaignId.toString(),
      );
      res.status(404).json({ message: "Associated campaign not found" });
      return;
    }

    // Check if user owns the campaign
    if (!req.user || !userId || campaign.creatorId.toString() !== userId) {
      res
        .status(403)
        .json({ message: "Not authorized to submit proof for this milestone" });
      return;
    }

    // Check if milestone is in a submittable state
    const submittableStates = ["pending", "in-progress", "revision-requested"];
    if (!submittableStates.includes(milestone.status)) {
      res.status(409).json({
        message: "Milestone is not in a submittable state",
        currentStatus: milestone.status,
      });
      return;
    }

    // Update milestone with proof data
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

export const reviewMilestone = async (req: Request, res: Response) => {
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
      // Trigger Soroban payout asynchronously
      triggerSorobanPayout(milestone).catch((err) => {
        // Log error, but don't block response
        console.error("Soroban payout error:", err);
      });
      res.json({ message: "Milestone approved and payout triggered" });
    } else if (status === "rejected") {
      milestone.status = "revision-requested";
      if (adminNote) milestone.adminNote = adminNote;
      await milestone.save();
      res.json({
        message: "Milestone status set to revision-requested",
      });
    } else {
      res.status(400).json({ message: "Invalid status value" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
