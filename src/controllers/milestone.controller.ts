import { Request, Response } from "express";
import Milestone from "../models/milestone.model";
import Campaign from "../models/campaign.model";
import contractService from "../services/contract.service";
import mongoose from "mongoose";
import { trustlessWorkAction } from "../services/trustless-work.service";
import { UserRole, MilestoneUpdate } from "../types/milestone";

export const updateMilestoneStatus = async (req: Request, res: Response) => {
  const { id: campaignId, milestoneId } = req.params;
  const { status, disputeReason } = req.body;
  const userId = req.user?._id;
  const userRoles: UserRole[] = req.user?.roles || [];

  try {
    //  Load campaign and milestone
    const campaign = await Campaign.findById(campaignId);
    if (!campaign)
      return res.status(404).json({ message: "Campaign not found" });
    if (campaign.status !== "live")
      return res
        .status(400)
        .json({ message: "Only live campaigns can update milestones" });

    const milestone = await Milestone.findById(milestoneId);
    if (!milestone)
      return res.status(404).json({ message: "Milestone not found" });

    //  Prevent updates on released milestones
    if (milestone.status === "released")
      return res.status(400).json({ message: "Milestone already released" });

    //  Role-based authorization
    const isAdmin = userRoles.some((r: UserRole) => r.role === "ADMIN");
    const isCreator = campaign.creatorId.equals(userId);
    // Marker logic: for demo, assume markerId is assigned to milestone
    const isMarker = milestone.markerId && milestone.markerId.equals(userId);

    //  Status transition logic
    const currentStatus = milestone.status;
    let allowed = false;
    let update: MilestoneUpdate = {};

    if (status === "approved" && ["pending"].includes(currentStatus)) {
      if (isAdmin || isMarker) {
        allowed = true;
        update.status = "approved";
        update.markedAt = new Date();
        update.markerId = isMarker ? userId : milestone.markerId;
        // Optionally, call Trustless Work to mark as approved
        try {
          await trustlessWorkAction("approve", { milestoneId });
        } catch (err) {
          return res
            .status(502)
            .json({ message: "Trustless Work API failure (approve)" });
        }
      }
    } else if (status === "released" && currentStatus === "approved") {
      if (isAdmin) {
        allowed = true;
        update.status = "released";
        update.releasedAt = new Date();
        // Call Trustless Work to release funds
        let txHash;
        try {
          const result = await trustlessWorkAction("release", { milestoneId });
          txHash = result.txHash;
        } catch (err) {
          return res
            .status(502)
            .json({ message: "Trustless Work API failure (release)" });
        }
        update.releaseTxHash = txHash;
      }
    } else if (status === "rejected" && ["pending"].includes(currentStatus)) {
      if (isAdmin || isMarker) {
        allowed = true;
        update.status = "rejected";
        update.markedAt = new Date();
        update.markerId = isMarker ? userId : milestone.markerId;
        // Optionally, call Trustless Work to mark as rejected
        try {
          await trustlessWorkAction("reject", { milestoneId });
        } catch (err) {
          return res
            .status(502)
            .json({ message: "Trustless Work API failure (reject)" });
        }
      }
    } else if (
      status === "disputed" &&
      ["approved", "rejected"].includes(currentStatus)
    ) {
      if (isCreator) {
        allowed = true;
        update.status = "disputed";
        update.disputedAt = new Date();
        update.disputeReason = disputeReason;
        // Call Trustless Work to trigger dispute
        try {
          await trustlessWorkAction("dispute", {
            milestoneId,
            reason: disputeReason,
          });
        } catch (err) {
          return res
            .status(502)
            .json({ message: "Trustless Work API failure (dispute)" });
        }
      }
    }

    if (!allowed) {
      return res
        .status(403)
        .json({ message: "Unauthorized or invalid status transition" });
    }

    //  Update milestone
    Object.assign(milestone, update);
    await milestone.save();
    return res.json({ message: `Milestone status updated to ${status}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
