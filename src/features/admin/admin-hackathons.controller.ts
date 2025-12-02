import { Request, Response } from "express";
import Hackathon, {
  IHackathon,
  HackathonStatus,
} from "../../models/hackathon.model.js";
import HackathonParticipantModel, {
  IHackathonParticipant,
} from "../../models/hackathon-participant.model.js";
import User from "../../models/user.model.js";
import Organization from "../../models/organization.model.js";
import Transaction from "../../models/transaction.model.js";
import {
  sendSuccess,
  sendInternalServerError,
  sendBadRequest,
  sendNotFound,
} from "../../utils/apiResponse.js";
import { sendEmail } from "../../utils/email.utils.js";

/**
 * GET /api/admin/hackathons
 *
 * Get paginated list of hackathons with filtering
 */
export const getAdminHackathons = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
      organization,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const query: any = {};

    if (search && typeof search === "string") {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { tagline: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (
      status &&
      Object.values(HackathonStatus).includes(status as HackathonStatus)
    ) {
      query.status = status;
    }

    // Add organization filter
    if (organization) {
      query.organizationId = organization;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    const total = await Hackathon.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    const hackathons = await Hackathon.find(query)
      .populate("organizationId", "name logo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const hackathonsWithMetrics = await Promise.all(
      hackathons.map(async (hackathon) => {
        const participantCount = await HackathonParticipantModel.countDocuments(
          {
            hackathonId: hackathon._id,
          },
        );

        const submissionCount = await HackathonParticipantModel.countDocuments({
          hackathonId: hackathon._id,
          status: "completed",
        });

        // Calculate prize pool from prize tiers or escrow details
        const prizePool = hackathon.prizeTiers
          ? hackathon.prizeTiers.reduce(
              (total, tier) => total + (tier.amount || 0),
              0,
            )
          : (hackathon as any).escrowDetails?.totalPrizeAmount || 0;

        return {
          id: hackathon._id.toString(),
          title: hackathon.title,
          tagline: hackathon.tagline,
          status: hackathon.status,
          organization: hackathon.organizationId
            ? {
                id: (hackathon.organizationId as any)._id.toString(),
                name: (hackathon.organizationId as any).name,
                logo: (hackathon.organizationId as any).logo,
              }
            : null,
          participants: participantCount,
          submissions: submissionCount,
          prizePool,
          currency: hackathon.prizeTiers?.[0]?.currency || "USD",
          startDate: hackathon.startDate?.toISOString(),
          endDate: hackathon.judgingDate?.toISOString(), // Using judgingDate as endDate
          createdAt: hackathon.createdAt?.toISOString(),
          createdBy: null, // TODO: Add createdBy field to hackathon model
        };
      }),
    );

    const response = {
      hackathons: hackathonsWithMetrics,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };

    sendSuccess(res, response, "Hackathons retrieved successfully");
  } catch (error) {
    console.error("Admin hackathons retrieval error:", error);
    sendInternalServerError(res, "Failed to retrieve hackathons");
  }
};

/**
 * GET /api/admin/hackathons/:id
 *
 * Get detailed hackathon information with participants and submissions
 */
export const getAdminHackathonById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendBadRequest(res, "Hackathon ID is required");
    }

    const hackathon = await Hackathon.findById(id)
      .populate("organizationId", "name logo tagline about links")
      .lean();

    if (!hackathon) {
      return sendNotFound(res, "Hackathon not found");
    }

    // Get participants with user details
    const participants = await HackathonParticipantModel.find({
      hackathonId: id,
    })
      .populate(
        "userId",
        "profile.firstName profile.lastName profile.username email emailVerified",
      )
      .sort({ createdAt: -1 })
      .lean();

    // Get submissions/projects from participants
    const submissions = await HackathonParticipantModel.find({
      hackathonId: id,
      status: "completed",
      submissionUrl: { $exists: true, $ne: "" },
    })
      .populate(
        "userId",
        "profile.firstName profile.lastName profile.username email",
      )
      .populate("teamId", "name members")
      .sort({ submittedAt: -1 })
      .lean();

    // Get escrow/funding information
    const escrowTransactions = await Transaction.find({
      projectId: id,
      type: { $in: ["FUNDING", "MILESTONE_RELEASE"] },
      status: "CONFIRMED",
    }).sort({ createdAt: -1 });

    const totalEscrow = escrowTransactions
      .filter((tx) => tx.type === "FUNDING")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalReleased = escrowTransactions
      .filter((tx) => tx.type === "MILESTONE_RELEASE")
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Transform participants data
    const transformedParticipants = participants.map((participant: any) => ({
      id: participant._id.toString(),
      user: {
        id: (participant.userId as any)._id.toString(),
        name:
          `${(participant.userId as any).profile?.firstName || ""} ${(participant.userId as any).profile?.lastName || ""}`.trim() ||
          (participant.userId as any).profile?.username ||
          "Unknown",
        email: (participant.userId as any).email,
        isVerified: (participant.userId as any).emailVerified,
      },
      team:
        participant.teamId && (participant.teamId as any)._id
          ? {
              id: (participant.teamId as any)._id.toString(),
              name: (participant.teamId as any).name,
              members: (participant.teamId as any).members?.length || 0,
            }
          : null,
      status: participant.status,
      registeredAt: participant.registeredAt?.toISOString(),
      submittedAt: participant.submittedAt?.toISOString(),
      submissionUrl: participant.submissionUrl,
    }));

    // Transform submissions data
    const transformedSubmissions = submissions.map((submission: any) => ({
      id: submission._id.toString(),
      participant: {
        id: (submission.userId as any)._id.toString(),
        name:
          `${(submission.userId as any).profile?.firstName || ""} ${(submission.userId as any).profile?.lastName || ""}`.trim() ||
          (submission.userId as any).profile?.username ||
          "Unknown",
        email: (submission.userId as any).email,
      },
      team:
        submission.teamId && (submission.teamId as any)._id
          ? {
              id: (submission.teamId as any)._id.toString(),
              name: (submission.teamId as any).name,
            }
          : null,
      submissionUrl: submission.submissionUrl,
      submittedAt: submission.submittedAt?.toISOString(),
    }));

    const response = {
      id: hackathon._id.toString(),
      title: hackathon.title,
      tagline: hackathon.tagline,
      description: hackathon.description,
      status: hackathon.status,
      category: hackathon.categories?.[0] || "Other",
      organization: hackathon.organizationId
        ? {
            id: (hackathon.organizationId as any)._id.toString(),
            name: (hackathon.organizationId as any).name,
            logo: (hackathon.organizationId as any).logo,
            tagline: (hackathon.organizationId as any).tagline,
            about: (hackathon.organizationId as any).about,
            links: (hackathon.organizationId as any).links,
          }
        : null,
      createdBy: null, // TODO: Add createdBy field to hackathon model
      participants: transformedParticipants,
      submissions: transformedSubmissions,
      totalParticipants: participants.length,
      totalSubmissions: submissions.length,
      prizePool: hackathon.prizeTiers
        ? hackathon.prizeTiers.reduce(
            (total, tier) => total + (tier.amount || 0),
            0,
          )
        : (hackathon as any).escrowDetails?.totalPrizeAmount || 0,
      prizeTiers: hackathon.prizeTiers || [],
      escrow: {
        totalLocked: totalEscrow,
        totalReleased,
        remaining: totalEscrow - totalReleased,
      },
      phases: [
        {
          name: "Registration",
          startDate: hackathon.startDate,
          endDate: hackathon.registrationDeadline,
        },
        {
          name: "Submission",
          startDate: hackathon.startDate,
          endDate: hackathon.submissionDeadline,
        },
        {
          name: "Judging",
          startDate: hackathon.judgingDate,
          endDate: hackathon.winnerAnnouncementDate,
        },
        {
          name: "Winner Announcement",
          startDate: hackathon.winnerAnnouncementDate,
          endDate: hackathon.winnerAnnouncementDate,
        },
      ],
      rules: [], // TODO: Add rules field to hackathon model
      resources: (hackathon as any).resources?.resources || [],
      criteria: (hackathon as any).criteria || [],
      sponsorsPartners: (hackathon as any).sponsorsPartners || [],
      contactEmail: (hackathon as any).contactEmail,
      socialLinks: {
        discord: (hackathon as any).discord,
        telegram: (hackathon as any).telegram,
      },
      contractId: (hackathon as any).contractId,
      escrowAddress: (hackathon as any).escrowAddress,
      escrowDetails: (hackathon as any).escrowDetails,
      teamSize: {
        min: (hackathon as any).teamMin || 1,
        max: (hackathon as any).teamMax || 1,
      },
      participantType: hackathon.participantType,
      timezone: hackathon.timezone,
      judgingDate: hackathon.judgingDate?.toISOString(),
      winnerAnnouncementDate: (
        hackathon as any
      ).winnerAnnouncementDate?.toISOString(),
      registrationDeadline: hackathon.registrationDeadline?.toISOString(),
      submissionDeadline: hackathon.submissionDeadline?.toISOString(),
      startDate: hackathon.startDate?.toISOString(),
      endDate: hackathon.judgingDate?.toISOString(),
      createdAt: hackathon.createdAt?.toISOString(),
      updatedAt: hackathon.updatedAt?.toISOString(),
    };

    sendSuccess(res, response, "Hackathon details retrieved successfully");
  } catch (error) {
    console.error("Admin hackathon retrieval error:", error);
    sendInternalServerError(res, "Failed to retrieve hackathon details");
  }
};

/**
 * POST /api/admin/hackathons/:id/email-participants
 *
 * Send email to hackathon participants
 */
export const emailHackathonParticipants = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { subject, message, recipientType = "all" } = req.body;

    if (!id) {
      return sendBadRequest(res, "Hackathon ID is required");
    }

    if (!subject || !message) {
      return sendBadRequest(res, "Subject and message are required");
    }

    // Get hackathon details
    const hackathon = await Hackathon.findById(id);
    if (!hackathon) {
      return sendNotFound(res, "Hackathon not found");
    }

    // Get participants based on recipient type
    let participantQuery: any = { hackathonId: id };

    // switch (recipientType) {
    //   case "registered":
    //     participantQuery.status = "registered";
    //     break;
    //   case "confirmed":
    //     participantQuery.status = "confirmed";
    //     break;
    //   case "completed":
    //     participantQuery.status = "completed";
    //     break;
    //   case "all":
    //   default:
    //     participantQuery.status = { $in: ["registered", "confirmed", "completed"] };
    //     break;
    // }

    const participants = await HackathonParticipantModel.find(participantQuery)
      .populate("userId", "email profile.firstName profile.lastName")
      .lean();

    // Send emails
    const emailPromises = participants.map(async (participant: any) => {
      const user = participant.userId as any;
      if (user && user.email) {
        const personalizedMessage = message
          .replace(/{{firstName}}/g, user.profile?.firstName || "")
          .replace(/{{lastName}}/g, user.profile?.lastName || "")
          .replace(/{{hackathonName}}/g, hackathon.title);

        return sendEmail({
          to: user.email,
          subject,
          text: personalizedMessage.replace(/<[^>]*>/g, ""), // Strip HTML for text version
          html: personalizedMessage,
        });
      }
    });

    await Promise.all(emailPromises.filter(Boolean));

    sendSuccess(
      res,
      {
        sentTo: participants.length,
        recipientType,
      },
      `Emails sent to ${participants.length} participants successfully`,
    );
  } catch (error) {
    console.error("Email participants error:", error);
    sendInternalServerError(res, "Failed to send emails to participants");
  }
};

/**
 * POST /api/admin/hackathons/:id/contact-organizers
 *
 * Send email to hackathon organizers
 */
export const contactHackathonOrganizers = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;

    if (!id) {
      return sendBadRequest(res, "Hackathon ID is required");
    }

    if (!subject || !message) {
      return sendBadRequest(res, "Subject and message are required");
    }

    // Get hackathon with organization details
    const hackathon = await Hackathon.findById(id)
      .populate("organizationId", "name")
      .lean();

    if (!hackathon) {
      return sendNotFound(res, "Hackathon not found");
    }

    // Get organization admins
    const organizationAdmins = await User.find({
      _id: { $in: (hackathon as any).organizationId?.admins || [] },
      email: { $exists: true },
    }).select("email profile.firstName profile.lastName");

    // Send email to organizers
    const organizerEmails = [
      // TODO: Add createdBy field to hackathon model for organizer emails
      ...organizationAdmins.map((admin) => admin.email),
    ];

    const uniqueEmails = [...new Set(organizerEmails)];

    const emailPromises = uniqueEmails.map((email) =>
      sendEmail({
        to: email,
        subject,
        text: message
          .replace(/{{hackathonName}}/g, hackathon.title)
          .replace(/<[^>]*>/g, ""),
        html: message.replace(/{{hackathonName}}/g, hackathon.title),
      }),
    );

    await Promise.all(emailPromises);

    sendSuccess(
      res,
      {
        sentTo: uniqueEmails.length,
        emails: uniqueEmails,
      },
      `Emails sent to ${uniqueEmails.length} organizers successfully`,
    );
  } catch (error) {
    console.error("Contact organizers error:", error);
    sendInternalServerError(res, "Failed to contact organizers");
  }
};

/**
 * POST /api/admin/hackathons/:hackathonId/participants/:participantId/release-funds
 *
 * Release funds to awarded participant
 */
export const releaseParticipantFunds = async (req: Request, res: Response) => {
  try {
    const { hackathonId, participantId } = req.params;
    const { amount, reason } = req.body;

    if (!hackathonId || !participantId) {
      return sendBadRequest(
        res,
        "Hackathon ID and Participant ID are required",
      );
    }

    if (!amount || amount <= 0) {
      return sendBadRequest(res, "Valid amount is required");
    }

    // Get hackathon and participant details
    const hackathon = await Hackathon.findById(hackathonId);
    if (!hackathon) {
      return sendNotFound(res, "Hackathon not found");
    }

    const participant = await HackathonParticipantModel.findById(participantId)
      .populate("userId", "email profile.firstName profile.lastName")
      .lean();

    if (!participant) {
      return sendNotFound(res, "Participant not found");
    }

    // Check if funds are available in escrow
    const escrowTransactions = await Transaction.find({
      projectId: hackathonId,
      type: "FUNDING",
      status: "CONFIRMED",
    });

    const totalEscrow = escrowTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );

    const releasedTransactions = await Transaction.find({
      projectId: hackathonId,
      type: "MILESTONE_RELEASE",
      status: "CONFIRMED",
    });

    const totalReleased = releasedTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );

    if (totalReleased + amount > totalEscrow) {
      return sendBadRequest(res, "Insufficient funds in escrow");
    }

    // Create release transaction
    const releaseTransaction = new Transaction({
      projectId: hackathonId,
      type: "MILESTONE_RELEASE",
      amount,
      fromAddress: "PLATFORM_ESCROW", // Platform escrow address
      toAddress: (participant.userId as any).email, // Use email as identifier for now
      transactionHash: `RELEASE_${Date.now()}_${participantId}`,
      status: "CONFIRMED",
      metadata: {
        participantId,
        hackathonId,
        reason: reason || "Hackathon prize distribution",
        releasedBy: (req as any).admin?._id?.toString(),
      },
    });

    await releaseTransaction.save();

    // Send notification email to participant
    const user = participant.userId as any;
    if (user && user.email) {
      await sendEmail({
        to: user.email,
        subject: `Funds Released - ${hackathon.title}`,
        text: `Congratulations! $${amount.toLocaleString()} has been released to you for participating in "${hackathon.title}". Reason: ${reason || "Hackathon prize distribution"}. The funds will be transferred to your account within 2-3 business days.`,
        html: `
          <h2>Congratulations!</h2>
          <p>$${amount.toLocaleString()} has been released to you for participating in "${hackathon.title}".</p>
          <p><strong>Reason:</strong> ${reason || "Hackathon prize distribution"}</p>
          <p>The funds will be transferred to your account within 2-3 business days.</p>
        `,
      });
    }

    sendSuccess(
      res,
      {
        transactionId: (releaseTransaction._id as any).toString(),
        amount,
        participant: {
          id: participantId,
          name:
            `${user?.profile?.firstName || ""} ${user?.profile?.lastName || ""}`.trim() ||
            "Unknown",
          email: user?.email,
        },
        remainingEscrow: totalEscrow - totalReleased - amount,
      },
      "Funds released successfully",
    );
  } catch (error) {
    console.error("Release funds error:", error);
    sendInternalServerError(res, "Failed to release funds");
  }
};
