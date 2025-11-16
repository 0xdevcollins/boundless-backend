import { Request, Response } from "express";
import mongoose from "mongoose";
import Hackathon from "../../models/hackathon.model.js";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendInternalServerError,
  sendConflict,
} from "../../utils/apiResponse.js";
import {
  AuthenticatedRequest,
  canManageHackathons,
  validateStellarAddress,
  mapRankToPrizeAmount,
} from "./hackathon.helpers.js";

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/rewards/ranks:
 *   post:
 *     summary: Assign ranks to submissions
 *     description: Assign or update ranks for submissions. Ensures ranks are unique.
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const assignRanks = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;
    const { ranks } = req.body;

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      await session.abortTransaction();
      session.endSession();
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can assign ranks for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      await session.abortTransaction();
      session.endSession();
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    }).session(session);

    if (!hackathon) {
      await session.abortTransaction();
      session.endSession();
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Validate ranks array
    if (!ranks || !Array.isArray(ranks) || ranks.length === 0) {
      await session.abortTransaction();
      session.endSession();
      sendBadRequest(res, "Ranks array is required and cannot be empty");
      return;
    }

    // Check for duplicate ranks
    const rankSet = new Set<number>();
    const participantIdSet = new Set<string>();
    for (const rankItem of ranks) {
      if (rankSet.has(rankItem.rank)) {
        await session.abortTransaction();
        session.endSession();
        sendBadRequest(
          res,
          `Duplicate rank found: ${rankItem.rank}. Ranks must be unique.`,
        );
        return;
      }
      if (participantIdSet.has(rankItem.participantId)) {
        await session.abortTransaction();
        session.endSession();
        sendBadRequest(
          res,
          `Duplicate participant ID found: ${rankItem.participantId}`,
        );
        return;
      }
      rankSet.add(rankItem.rank);
      participantIdSet.add(rankItem.participantId);
    }

    // Validate all participant IDs exist and belong to this hackathon
    const participantIds = ranks.map((r: any) => r.participantId);
    const participants = await HackathonParticipant.find({
      _id: { $in: participantIds },
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
    }).session(session);

    if (participants.length !== participantIds.length) {
      await session.abortTransaction();
      session.endSession();
      sendBadRequest(
        res,
        "One or more participant IDs are invalid or do not belong to this hackathon",
      );
      return;
    }

    // First, unassign any existing ranks that are being reassigned
    const ranksToAssign = new Map<string, number>();
    for (const rankItem of ranks) {
      ranksToAssign.set(rankItem.participantId, rankItem.rank);
    }

    // Find participants that currently have these ranks assigned
    const existingRankedParticipants = await HackathonParticipant.find({
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      rank: { $in: Array.from(rankSet) },
      _id: { $nin: participantIds },
    }).session(session);

    // Unassign ranks from participants that are losing these ranks
    for (const participant of existingRankedParticipants) {
      participant.rank = undefined;
      await participant.save({ session });
    }

    // Assign new ranks
    let updatedCount = 0;
    for (const participant of participants) {
      const newRank = ranksToAssign.get(
        (participant._id as mongoose.Types.ObjectId).toString(),
      );
      if (newRank !== undefined) {
        participant.rank = newRank;
        await participant.save({ session });
        updatedCount++;
      }
    }

    await session.commitTransaction();
    session.endSession();

    sendSuccess(
      res,
      {
        updated: updatedCount,
      },
      "Ranks assigned successfully",
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Assign ranks error:", error);
    sendInternalServerError(
      res,
      "Failed to assign ranks",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/rewards/milestones:
 *   post:
 *     summary: Create winner milestones
 *     description: Validates winners data for milestone creation. Frontend handles Trustless Work API calls.
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const createWinnerMilestones = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;
    const { winners } = req.body;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can create milestones for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    }).select("prizeTiers escrowAddress contractId escrowDetails");

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Validate escrow exists
    if (!hackathon.escrowAddress && !hackathon.contractId) {
      sendBadRequest(
        res,
        "Escrow not found. Please create an escrow for this hackathon first.",
      );
      return;
    }

    // Check if escrow is funded (only time updates are blocked)
    const escrowDetails = hackathon.escrowDetails as any;
    if (escrowDetails?.isFunded === true) {
      sendConflict(
        res,
        "Escrow is funded and cannot be updated. Milestones cannot be created for a funded escrow.",
      );
      return;
    }

    // Validate winners array
    if (!winners || !Array.isArray(winners) || winners.length === 0) {
      sendBadRequest(res, "Winners array is required and cannot be empty");
      return;
    }

    // Validate all participant IDs exist and belong to this hackathon
    const participantIds = winners.map((w: any) => w.participantId);
    const participants = await HackathonParticipant.find({
      _id: { $in: participantIds },
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (participants.length !== participantIds.length) {
      sendBadRequest(
        res,
        "One or more participant IDs are invalid or do not belong to this hackathon",
      );
      return;
    }

    // Validate wallet addresses
    const walletAddressSet = new Set<string>();
    for (const winner of winners) {
      if (!validateStellarAddress(winner.walletAddress)) {
        sendBadRequest(
          res,
          `Invalid Stellar wallet address: ${winner.walletAddress}`,
        );
        return;
      }
      if (walletAddressSet.has(winner.walletAddress)) {
        sendBadRequest(
          res,
          `Duplicate wallet address found: ${winner.walletAddress}. Each winner must have a unique wallet address.`,
        );
        return;
      }
      walletAddressSet.add(winner.walletAddress);
    }

    // Validate ranks match prize tiers
    if (!hackathon.prizeTiers || hackathon.prizeTiers.length === 0) {
      sendBadRequest(res, "Hackathon has no prize tiers configured");
      return;
    }

    for (const winner of winners) {
      const prizeAmount = mapRankToPrizeAmount(
        winner.rank,
        hackathon.prizeTiers,
      );
      if (prizeAmount === null) {
        sendBadRequest(
          res,
          `No prize tier found for rank ${winner.rank}. Please configure prize tiers for this hackathon.`,
        );
        return;
      }
    }

    // Validate participants have the assigned ranks
    const participantMap = new Map(
      participants.map((p) => [
        (p._id as mongoose.Types.ObjectId).toString(),
        p,
      ]),
    );
    for (const winner of winners) {
      const participant = participantMap.get(winner.participantId);
      if (!participant || participant.rank !== winner.rank) {
        sendBadRequest(
          res,
          `Participant ${winner.participantId} does not have rank ${winner.rank} assigned. Please assign ranks first.`,
        );
        return;
      }
    }

    // All validations passed - return success
    // Frontend will handle the actual Trustless Work API call
    sendSuccess(
      res,
      {
        milestonesCreated: winners.length,
        message:
          "Winner data validated successfully. Frontend will create milestones via Trustless Work API.",
      },
      "Milestones validated successfully",
    );
  } catch (error) {
    console.error("Create winner milestones error:", error);
    sendInternalServerError(
      res,
      "Failed to create milestones",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/escrow:
 *   get:
 *     summary: Get hackathon escrow details
 *     description: Retrieve escrow information for a hackathon
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getEscrowDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can view escrow details for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    }).select("contractId escrowAddress escrowDetails");

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    if (!hackathon.escrowAddress && !hackathon.contractId) {
      sendNotFound(res, "Escrow not found for this hackathon");
      return;
    }

    // Extract escrow details from hackathon model
    const escrowDetails = hackathon.escrowDetails as any;
    const contractId = hackathon.contractId || hackathon.escrowAddress;

    const isFunded = escrowDetails?.isFunded === true;
    sendSuccess(
      res,
      {
        contractId: contractId,
        escrowAddress: hackathon.escrowAddress || contractId,
        balance: escrowDetails?.balance || null,
        milestones: escrowDetails?.milestones || [],
        isFunded: isFunded,
        canUpdate: !isFunded, // Can update if not funded
      },
      "Escrow details retrieved successfully",
    );
  } catch (error) {
    console.error("Get escrow details error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve escrow details",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/winners/announce:
 *   post:
 *     summary: Announce winners
 *     description: Publicly announce winners with an optional announcement message
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const announceWinners = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;
    const { winners, announcement } = req.body;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { canManage, organization } = await canManageHackathons(
      orgId,
      user.email,
    );

    if (!canManage) {
      if (!organization) {
        sendNotFound(res, "Organization not found");
        return;
      }
      sendForbidden(
        res,
        "Only owners and admins can announce winners for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    });

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Validate winners array
    if (!winners || !Array.isArray(winners) || winners.length === 0) {
      sendBadRequest(res, "Winners array is required and cannot be empty");
      return;
    }

    // Validate all submission IDs exist and belong to this hackathon
    const submissionIds = winners.map((w: any) => w.submissionId);
    const participants = await HackathonParticipant.find({
      _id: { $in: submissionIds },
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      submission: { $exists: true, $ne: null },
    });

    if (participants.length !== submissionIds.length) {
      sendBadRequest(
        res,
        "One or more submission IDs are invalid or do not belong to this hackathon",
      );
      return;
    }

    // Validate ranks match assigned ranks
    const participantMap = new Map(
      participants.map((p) => [
        (p._id as mongoose.Types.ObjectId).toString(),
        p,
      ]),
    );
    for (const winner of winners) {
      const participant = participantMap.get(winner.submissionId);
      if (!participant) {
        sendBadRequest(
          res,
          `Submission ${winner.submissionId} not found or invalid`,
        );
        return;
      }
      if (participant.rank !== winner.rank) {
        sendBadRequest(
          res,
          `Submission ${winner.submissionId} does not have rank ${winner.rank} assigned`,
        );
        return;
      }
    }

    // Update hackathon with announcement
    hackathon.winnersAnnounced = true;
    hackathon.winnersAnnouncedAt = new Date();
    if (announcement) {
      hackathon.winnersAnnouncement = announcement;
    }

    await hackathon.save();

    sendSuccess(
      res,
      {
        announcedAt: hackathon.winnersAnnouncedAt.toISOString(),
      },
      "Winners announced successfully",
    );
  } catch (error) {
    console.error("Announce winners error:", error);
    sendInternalServerError(
      res,
      "Failed to announce winners",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
