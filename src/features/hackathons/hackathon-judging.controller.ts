import { Request, Response } from "express";
import mongoose from "mongoose";
import Hackathon from "../../models/hackathon.model";
import HackathonParticipant from "../../models/hackathon-participant.model";
import HackathonJudgingScore from "../../models/hackathon-judging-score.model";
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendInternalServerError,
  sendPaginatedResponse,
} from "../../utils/apiResponse";
import { AuthenticatedRequest, canManageHackathons } from "./hackathon.helpers";

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/judging/submissions:
 *   get:
 *     summary: Get shortlisted submissions for judging
 *     description: Retrieve all shortlisted submissions with criteria and existing scores
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getJudgingSubmissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId } = req.params;
    const { page = "1", limit = "10" } = req.query;

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
        "Only owners and admins can view judging submissions for this organization",
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
    }).select("criteria");

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    // Get shortlisted participants
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const query = {
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      "submission.status": "shortlisted",
      submission: { $exists: true, $ne: null },
    };

    const totalItems = await HackathonParticipant.countDocuments(query);

    const participants = await HackathonParticipant.find(query)
      .populate({
        path: "userId",
        select: "email profile",
      })
      .populate({
        path: "submission.reviewedBy",
        select: "email profile",
      })
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get all submission IDs
    const submissionIds = participants.map(
      (p: any) => p._id,
    ) as mongoose.Types.ObjectId[];

    // Fetch all scores for these submissions
    const allScores = await HackathonJudgingScore.find({
      submissionId: { $in: submissionIds },
    })
      .populate({
        path: "judgeId",
        select: "email profile",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Group scores by submissionId
    const scoresBySubmission = new Map<string, any[]>();
    allScores.forEach((score: any) => {
      const subId = score.submissionId.toString();
      if (!scoresBySubmission.has(subId)) {
        scoresBySubmission.set(subId, []);
      }
      const judge = score.judgeId;
      scoresBySubmission.get(subId)!.push({
        _id: score._id.toString(),
        judge: {
          _id: judge._id.toString(),
          profile: {
            firstName: judge.profile?.firstName || "",
            lastName: judge.profile?.lastName || "",
            username: judge.profile?.username || "",
            avatar: judge.profile?.avatar || "",
          },
          email: judge.email || "",
        },
        scores: score.scores,
        weightedScore: score.weightedScore,
        notes: score.notes || undefined,
        judgedAt: score.createdAt.toISOString(),
        updatedAt: score.updatedAt.toISOString(),
      });
    });

    // Transform participants with scores
    const transformedData = participants.map((participant: any) => {
      const user = participant.userId;
      const submissionId = participant._id.toString();
      const scores = scoresBySubmission.get(submissionId) || [];

      // Calculate average score
      const averageScore =
        scores.length > 0
          ? scores.reduce((sum: number, s: any) => sum + s.weightedScore, 0) /
            scores.length
          : null;

      return {
        participant: {
          _id: participant._id.toString(),
          userId: participant.userId._id.toString(),
          hackathonId: participant.hackathonId.toString(),
          organizationId: participant.organizationId.toString(),
          user: {
            _id: user._id.toString(),
            profile: {
              firstName: user.profile?.firstName || "",
              lastName: user.profile?.lastName || "",
              username: user.profile?.username || "",
              avatar: user.profile?.avatar || "",
            },
            email: user.email || "",
          },
          participationType: participant.participationType,
          teamId: participant.teamId || undefined,
          teamName: participant.teamName || undefined,
        },
        submission: participant.submission
          ? {
              _id: participant._id.toString(),
              projectName: participant.submission.projectName,
              category: participant.submission.category,
              description: participant.submission.description,
              logo: participant.submission.logo || undefined,
              videoUrl: participant.submission.videoUrl || undefined,
              introduction: participant.submission.introduction || undefined,
              links: participant.submission.links || undefined,
              submissionDate:
                participant.submission.submissionDate.toISOString(),
              status: participant.submission.status,
            }
          : undefined,
        criteria: hackathon.criteria || [],
        scores: scores,
        averageScore: averageScore,
        judgeCount: scores.length,
      };
    });

    const totalPages = Math.ceil(totalItems / limitNum);

    sendPaginatedResponse(
      res,
      transformedData,
      {
        currentPage: pageNum,
        totalPages,
        totalItems,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      "Judging submissions retrieved successfully",
    );
  } catch (error) {
    console.error("Get judging submissions error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve judging submissions",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/judging/submissions/{participantId}/grade:
 *   post:
 *     summary: Submit or update grades for a submission
 *     description: Grade a shortlisted submission based on judging criteria
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const submitGrade = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId, participantId } = req.params;
    const { scores: submittedScores, notes } = req.body;

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
        "Only owners and admins can grade submissions for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      sendBadRequest(res, "Invalid participant ID");
      return;
    }

    // Get hackathon with criteria
    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    }).select("criteria");

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    if (!hackathon.criteria || hackathon.criteria.length === 0) {
      sendBadRequest(res, "Hackathon has no judging criteria defined");
      return;
    }

    // Get participant
    const participant = await HackathonParticipant.findOne({
      _id: participantId,
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
    });

    if (!participant) {
      sendNotFound(res, "Participant not found");
      return;
    }

    if (!participant.submission) {
      sendBadRequest(res, "Participant has no submission");
      return;
    }

    if (participant.submission.status !== "shortlisted") {
      sendBadRequest(res, "Only shortlisted submissions can be graded");
      return;
    }

    // Validate scores
    if (!submittedScores || !Array.isArray(submittedScores)) {
      sendBadRequest(res, "Scores must be an array");
      return;
    }

    if (submittedScores.length !== hackathon.criteria.length) {
      sendBadRequest(
        res,
        `Must provide scores for all ${hackathon.criteria.length} criteria`,
      );
      return;
    }

    // Validate all criteria have scores and match
    const criteriaTitles = new Set(hackathon.criteria.map((c) => c.title));
    const submittedTitles = new Set(
      submittedScores.map((s: any) => s.criterionTitle),
    );

    if (criteriaTitles.size !== submittedTitles.size) {
      sendBadRequest(res, "Criterion titles do not match hackathon criteria");
      return;
    }

    for (const title of criteriaTitles) {
      if (!submittedTitles.has(title)) {
        sendBadRequest(res, `Missing score for criterion: ${title}`);
        return;
      }
    }

    // Validate score values
    for (const score of submittedScores) {
      if (
        typeof score.score !== "number" ||
        score.score < 0 ||
        score.score > 100
      ) {
        sendBadRequest(
          res,
          `Score for ${score.criterionTitle} must be a number between 0 and 100`,
        );
        return;
      }
    }

    // Calculate weighted score
    let weightedScore = 0;
    for (const submittedScore of submittedScores) {
      const criterion = hackathon.criteria.find(
        (c) => c.title === submittedScore.criterionTitle,
      );
      if (criterion) {
        weightedScore += (submittedScore.score * criterion.weight) / 100;
      }
    }

    // Round to 2 decimal places
    weightedScore = Math.round(weightedScore * 100) / 100;

    // Upsert score (update if judge already graded, create if new)
    const judgeId = new mongoose.Types.ObjectId(user._id);
    const submissionId = participant._id;

    const scoreData = {
      submissionId,
      judgeId,
      organizationId: new mongoose.Types.ObjectId(orgId),
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      scores: submittedScores,
      weightedScore,
      notes: notes || undefined,
    };

    const existingScore = await HackathonJudgingScore.findOne({
      submissionId,
      judgeId,
    });

    let savedScore;
    if (existingScore) {
      // Update existing score
      existingScore.scores = submittedScores;
      existingScore.weightedScore = weightedScore;
      existingScore.notes = notes || undefined;
      savedScore = await existingScore.save();
    } else {
      // Create new score
      savedScore = await HackathonJudgingScore.create(scoreData);
    }

    // Populate judge info
    await savedScore.populate({
      path: "judgeId",
      select: "email profile",
    });

    // Get all scores for this submission
    const allScores = await HackathonJudgingScore.find({
      submissionId,
    })
      .populate({
        path: "judgeId",
        select: "email profile",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate average
    const averageScore =
      allScores.length > 0
        ? allScores.reduce((sum: number, s: any) => sum + s.weightedScore, 0) /
          allScores.length
        : weightedScore;

    // Transform response
    const judge = savedScore.judgeId as any;
    const transformedScores = allScores.map((score: any) => {
      const judgeUser = score.judgeId;
      return {
        _id: score._id.toString(),
        judge: {
          _id: judgeUser._id.toString(),
          profile: {
            firstName: judgeUser.profile?.firstName || "",
            lastName: judgeUser.profile?.lastName || "",
            username: judgeUser.profile?.username || "",
            avatar: judgeUser.profile?.avatar || "",
          },
          email: judgeUser.email || "",
        },
        scores: score.scores,
        weightedScore: score.weightedScore,
        notes: score.notes || undefined,
        judgedAt: score.createdAt.toISOString(),
        updatedAt: score.updatedAt.toISOString(),
      };
    });

    sendSuccess(
      res,
      {
        submission: {
          _id: (participant._id as mongoose.Types.ObjectId).toString(),
          projectName: participant.submission.projectName,
          category: participant.submission.category,
          status: participant.submission.status,
        },
        score: {
          _id: (savedScore._id as mongoose.Types.ObjectId).toString(),
          weightedScore: savedScore.weightedScore,
          scores: savedScore.scores,
          judgedBy: {
            _id: judge._id.toString(),
            profile: {
              firstName: judge.profile?.firstName || "",
              lastName: judge.profile?.lastName || "",
              username: judge.profile?.username || "",
              avatar: judge.profile?.avatar || "",
            },
            email: judge.email || "",
          },
          notes: savedScore.notes || undefined,
          judgedAt: savedScore.createdAt.toISOString(),
        },
        allScores: transformedScores,
        averageScore: Math.round(averageScore * 100) / 100,
      },
      existingScore
        ? "Grade updated successfully"
        : "Grade submitted successfully",
    );
  } catch (error) {
    console.error("Submit grade error:", error);
    sendInternalServerError(
      res,
      "Failed to submit grade",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @swagger
 * /api/organizations/{orgId}/hackathons/{hackathonId}/judging/submissions/{participantId}/scores:
 *   get:
 *     summary: Get all scores for a submission
 *     description: Retrieve all scores from all judges for a specific submission
 *     tags: [Hackathons]
 *     security:
 *       - bearerAuth: []
 */
export const getSubmissionScores = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { orgId, hackathonId, participantId } = req.params;

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
        "Only owners and admins can view scores for this organization",
      );
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
      sendBadRequest(res, "Invalid hackathon ID");
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      sendBadRequest(res, "Invalid participant ID");
      return;
    }

    const hackathon = await Hackathon.findOne({
      _id: hackathonId,
      organizationId: orgId,
    }).select("criteria");

    if (!hackathon) {
      sendNotFound(res, "Hackathon not found");
      return;
    }

    const participant = await HackathonParticipant.findOne({
      _id: participantId,
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
      organizationId: new mongoose.Types.ObjectId(orgId),
    })
      .populate({
        path: "userId",
        select: "email profile",
      })
      .populate({
        path: "submission.reviewedBy",
        select: "email profile",
      });

    if (!participant) {
      sendNotFound(res, "Participant not found");
      return;
    }

    if (!participant.submission) {
      sendBadRequest(res, "Participant has no submission");
      return;
    }

    // Get all scores for this submission
    const scores = await HackathonJudgingScore.find({
      submissionId: participant._id,
    })
      .populate({
        path: "judgeId",
        select: "email profile",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const weightedScores = scores.map((s: any) => s.weightedScore);
    const averageScore =
      weightedScores.length > 0
        ? weightedScores.reduce((sum, score) => sum + score, 0) /
          weightedScores.length
        : null;
    const minScore =
      weightedScores.length > 0 ? Math.min(...weightedScores) : null;
    const maxScore =
      weightedScores.length > 0 ? Math.max(...weightedScores) : null;

    // Transform scores
    const transformedScores = scores.map((score: any) => {
      const judge = score.judgeId;
      return {
        _id: score._id.toString(),
        judge: {
          _id: judge._id.toString(),
          profile: {
            firstName: judge.profile?.firstName || "",
            lastName: judge.profile?.lastName || "",
            username: judge.profile?.username || "",
            avatar: judge.profile?.avatar || "",
          },
          email: judge.email || "",
        },
        scores: score.scores,
        weightedScore: score.weightedScore,
        notes: score.notes || undefined,
        judgedAt: score.createdAt.toISOString(),
        updatedAt: score.updatedAt.toISOString(),
      };
    });

    // Transform participant
    const participantUser = participant.userId as any;
    const transformedParticipant = {
      _id: (participant._id as mongoose.Types.ObjectId).toString(),
      userId: participant.userId._id.toString(),
      hackathonId: participant.hackathonId.toString(),
      organizationId: participant.organizationId.toString(),
      user: {
        _id: participantUser._id.toString(),
        profile: {
          firstName: participantUser.profile?.firstName || "",
          lastName: participantUser.profile?.lastName || "",
          username: participantUser.profile?.username || "",
          avatar: participantUser.profile?.avatar || "",
        },
        email: participantUser.email || "",
      },
      participationType: participant.participationType,
      teamId: participant.teamId || undefined,
      teamName: participant.teamName || undefined,
      submission: participant.submission
        ? {
            _id: (participant._id as mongoose.Types.ObjectId).toString(),
            projectName: participant.submission.projectName,
            category: participant.submission.category,
            description: participant.submission.description,
            logo: participant.submission.logo || undefined,
            videoUrl: participant.submission.videoUrl || undefined,
            introduction: participant.submission.introduction || undefined,
            links: participant.submission.links || undefined,
            submissionDate: participant.submission.submissionDate.toISOString(),
            status: participant.submission.status,
          }
        : undefined,
    };

    sendSuccess(
      res,
      {
        participant: transformedParticipant,
        criteria: hackathon.criteria || [],
        scores: transformedScores,
        statistics: {
          averageScore: averageScore
            ? Math.round(averageScore * 100) / 100
            : null,
          minScore: minScore ? Math.round(minScore * 100) / 100 : null,
          maxScore: maxScore ? Math.round(maxScore * 100) / 100 : null,
          judgeCount: scores.length,
        },
      },
      "Submission scores retrieved successfully",
    );
  } catch (error) {
    console.error("Get submission scores error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve submission scores",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};
