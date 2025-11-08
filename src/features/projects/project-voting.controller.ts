import { Request, Response } from "express";
import Vote, { IVote } from "../../models/vote.model";
import Project, { ProjectStatus } from "../../models/project.model";
import Crowdfund, { CrowdfundStatus } from "../../models/crowdfund.model";
import User from "../../models/user.model";
import mongoose from "mongoose";
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendInternalServerError,
  sendUnauthorized,
  checkResource,
} from "../../utils/apiResponse";

/**
 * @desc    Vote on a project idea
 * @route   POST /api/projects/:id/vote
 * @access  Private
 */
export const voteOnProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: projectId } = req.params;
    const { value } = req.body;
    const userId = req.user?._id;

    // Validate project ID format
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    // Validate user authentication
    if (!userId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // Validate vote value
    if (![1, -1].includes(value)) {
      sendBadRequest(
        res,
        "Vote value must be either 1 (upvote) or -1 (downvote)",
      );
      return;
    }

    // Check if project exists and is voteable
    const project = await Project.findById(projectId).session(session);
    if (checkResource(res, !project, "Project not found", 404)) {
      await session.abortTransaction();
      return;
    }

    // Check if project status allows voting (only IDEA status after admin approval)
    const voteableStatuses = [
      ProjectStatus.IDEA, // Only allow voting after admin approval
    ];
    if (!voteableStatuses.includes(project!.status)) {
      sendBadRequest(
        res,
        "Project is not available for voting. It must be approved by admin first.",
      );
      await session.abortTransaction();
      return;
    }

    // Check if user is trying to vote on their own project
    if (project!.owner.type.toString() === userId.toString()) {
      sendBadRequest(res, "You cannot vote on your own project");
      await session.abortTransaction();
      return;
    }

    // Check if user has already voted
    const existingVote = await Vote.findOne({ userId, projectId }).session(
      session,
    );

    let vote: IVote;
    let isNewVote = false;

    if (existingVote) {
      // Update existing vote if different
      if (existingVote.value !== value) {
        existingVote.value = value;
        vote = await existingVote.save({ session });
      } else {
        sendBadRequest(res, "You have already cast this vote");
        await session.abortTransaction();
        return;
      }
    } else {
      // Create new vote
      vote = new Vote({
        userId,
        projectId,
        value,
      });
      await vote.save({ session });
      isNewVote = true;
    }

    // Update user voting stats
    if (isNewVote) {
      await User.findByIdAndUpdate(
        userId,
        {
          $inc: { "stats.votesCast": 1 },
        },
        { session },
      );
    }

    // Update project vote counts (after vote is saved)
    // Count votes manually instead of using aggregation
    const [upvotes, downvotes] = await Promise.all([
      Vote.countDocuments({ projectId, value: 1 }).session(session),
      Vote.countDocuments({ projectId, value: -1 }).session(session),
    ]);

    const voteData = {
      upvotes,
      downvotes,
      totalVotes: upvotes + downvotes,
      netVotes: upvotes - downvotes,
    };

    // Prepare voter data for the voters array
    const voterData = {
      userId: userId,
      vote: value === 1 ? "positive" : "negative",
      votedAt: new Date(),
    };

    // Update project votes field and voters array
    if (existingVote) {
      // Update existing vote in voters array
      await Project.findByIdAndUpdate(
        projectId,
        {
          votes: voteData.netVotes,
          $set: {
            "voting.totalVotes": voteData.totalVotes,
            "voting.positiveVotes": voteData.upvotes,
            "voting.negativeVotes": voteData.downvotes,
            "voting.voters.$[elem].vote": voterData.vote,
            "voting.voters.$[elem].votedAt": voterData.votedAt,
          },
        },
        {
          session,
          arrayFilters: [{ "elem.userId": userId }],
        },
      );
    } else {
      // Add new voter to voters array
      await Project.findByIdAndUpdate(
        projectId,
        {
          votes: voteData.netVotes,
          $set: {
            "voting.totalVotes": voteData.totalVotes,
            "voting.positiveVotes": voteData.upvotes,
            "voting.negativeVotes": voteData.downvotes,
          },
          $push: {
            "voting.voters": voterData,
          },
        },
        { session },
      );
    }

    // Update crowdfund total votes if it's a crowdfund project
    const crowdfund = await Crowdfund.findOne({ projectId }).session(session);
    if (crowdfund) {
      crowdfund.totalVotes = voteData.totalVotes;
      await crowdfund.save({ session });
    }

    await session.commitTransaction();

    // Populate vote data for response
    await vote.populate([
      {
        path: "userId",
        select: "profile.firstName profile.lastName profile.username",
      },
      {
        path: "projectId",
        select: "title status votes",
      },
    ]);

    const responseData = {
      vote: {
        _id: vote._id,
        value: vote.value,
        voteType: vote.value === 1 ? "upvote" : "downvote",
        createdAt: vote.createdAt,
        updatedAt: vote.updatedAt,
      },
      projectVotes: voteData,
      isNewVote,
    };

    if (isNewVote) {
      sendCreated(res, responseData, "Vote cast successfully");
    } else {
      sendSuccess(res, responseData, "Vote updated successfully");
    }

    // Trigger async status check (don't await to avoid blocking response)
    setImmediate(() => {
      checkAndUpdateProjectStatus(projectId).catch((error) => {
        console.error("Error checking project status:", error);
      });
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Vote on project error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      sendBadRequest(res, "Validation failed", validationErrors.join(", "));
      return;
    }

    if (error instanceof mongoose.Error.CastError) {
      sendBadRequest(res, "Invalid data format");
      return;
    }

    // Handle duplicate key error (shouldn't happen with upsert logic, but just in case)
    if ((error as any).code === 11000) {
      sendBadRequest(res, "Vote already exists");
      return;
    }

    sendInternalServerError(
      res,
      "Failed to cast vote",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get votes for a project
 * @route   GET /api/projects/:id/votes
 * @access  Public
 */
export const getProjectVotes = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    const { page = 1, limit = 20, voteType } = req.query;

    // Validate project ID format
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    // Check if project exists
    const project = await Project.findById(projectId).select("_id");
    if (checkResource(res, !project, "Project not found", 404)) {
      return;
    }

    // Build filter
    const filter: any = { projectId };
    if (voteType === "upvote") {
      filter.value = 1;
    } else if (voteType === "downvote") {
      filter.value = -1;
    }

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Get votes and counts
    const [votes, totalCount, upvotes, downvotes] = await Promise.all([
      Vote.find(filter)
        .populate(
          "userId",
          "profile.firstName profile.lastName profile.username profile.avatar",
        )
        .select("value createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Vote.countDocuments(filter),
      Vote.countDocuments({ projectId, value: 1 }),
      Vote.countDocuments({ projectId, value: -1 }),
    ]);

    const voteData = {
      upvotes,
      downvotes,
      totalVotes: upvotes + downvotes,
      netVotes: upvotes - downvotes,
    };
    const totalPages = Math.ceil(totalCount / limitNum);

    // Check if current user has voted (if authenticated)
    let userVote = null;
    if (req.user?._id) {
      userVote = await Vote.findOne({
        userId: req.user._id,
        projectId: new mongoose.Types.ObjectId(projectId),
      }).lean();
    }

    interface VoteResponse {
      _id: string;
      value: number;
      voteType: "upvote" | "downvote";
      createdAt: Date;
      updatedAt: Date;
      userId?: {
        profile: {
          firstName: string;
          lastName: string;
          username: string;
          avatar?: string;
        };
      };
    }

    interface VoteSummary {
      upvotes: number;
      downvotes: number;
      totalVotes: number;
      netVotes: number;
    }

    interface UserVote {
      value: number;
      voteType: "upvote" | "downvote";
      createdAt: Date;
    }

    interface Pagination {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNext: boolean;
      hasPrev: boolean;
    }

    interface GetProjectVotesResponse {
      votes: VoteResponse[];
      voteSummary: VoteSummary;
      userVote: UserVote | null;
      pagination: Pagination;
    }

    const responseData: GetProjectVotesResponse = {
      votes: votes.map(
        (vote: any): VoteResponse => ({
          ...vote,
          voteType: vote.value === 1 ? "upvote" : "downvote",
        }),
      ),
      voteSummary: voteData,
      userVote: userVote
        ? {
            value: userVote.value,
            voteType: userVote.value === 1 ? "upvote" : "downvote",
            createdAt: userVote.createdAt,
          }
        : null,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    };

    sendSuccess(res, responseData, "Project votes retrieved successfully");
  } catch (error) {
    console.error("Get project votes error:", error);
    sendInternalServerError(
      res,
      "Failed to retrieve project votes",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
};

/**
 * @desc    Remove vote from a project
 * @route   DELETE /api/projects/:id/vote
 * @access  Private
 */
export const removeVote = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: projectId } = req.params;
    const userId = req.user?._id;

    // Validate project ID format
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    // Validate user authentication
    if (!userId) {
      sendUnauthorized(res, "Authentication required");
      return;
    }

    // Find and remove the vote
    const vote = await Vote.findOneAndDelete({ userId, projectId }).session(
      session,
    );
    if (checkResource(res, !vote, "Vote not found", 404)) {
      await session.abortTransaction();
      return;
    }

    // Update project vote counts
    const voteCounts = await Vote.getVoteCounts(
      new mongoose.Types.ObjectId(projectId),
    );
    const voteData = voteCounts[0] || {
      upvotes: 0,
      downvotes: 0,
      totalVotes: 0,
      netVotes: 0,
    };

    // Update project votes field and remove voter from voters array
    await Project.findByIdAndUpdate(
      projectId,
      {
        votes: voteData.netVotes,
        $set: {
          "voting.totalVotes": voteData.totalVotes,
          "voting.positiveVotes": voteData.upvotes,
          "voting.negativeVotes": voteData.downvotes,
        },
        $pull: {
          "voting.voters": { userId: userId },
        },
      },
      { session },
    );

    // Update crowdfund total votes if it's a crowdfund project
    const crowdfund = await Crowdfund.findOne({ projectId }).session(session);
    if (crowdfund) {
      crowdfund.totalVotes = voteData.totalVotes;
      await crowdfund.save({ session });
    }

    // Update user voting stats
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: { "stats.votesCast": -1 },
      },
      { session },
    );

    await session.commitTransaction();

    sendSuccess(res, { projectVotes: voteData }, "Vote removed successfully");
  } catch (error) {
    await session.abortTransaction();
    console.error("Remove vote error:", error);
    sendInternalServerError(
      res,
      "Failed to remove vote",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    session.endSession();
  }
};

/**
 * Helper function to check and update project status based on vote thresholds
 */
async function checkAndUpdateProjectStatus(projectId: string): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const project = await Project.findById(projectId).session(session);
    if (!project) {
      await session.abortTransaction();
      return;
    }

    // Only check projects in validated status (ready for voting)
    if (project.status !== ProjectStatus.VALIDATED) {
      await session.abortTransaction();
      return;
    }

    const crowdfund = await Crowdfund.findOne({ projectId }).session(session);
    if (!crowdfund) {
      await session.abortTransaction();
      return;
    }

    // Get current vote counts
    const [upvotes, downvotes] = await Promise.all([
      Vote.countDocuments({
        projectId: new mongoose.Types.ObjectId(projectId),
        value: 1,
      }).session(session),
      Vote.countDocuments({
        projectId: new mongoose.Types.ObjectId(projectId),
        value: -1,
      }).session(session),
    ]);

    const voteData = {
      upvotes,
      downvotes,
      totalVotes: upvotes + downvotes,
      netVotes: upvotes - downvotes,
    };

    // Check if threshold is met
    if (voteData.totalVotes >= crowdfund.thresholdVotes) {
      // Check if majority are positive votes (at least 60% positive)
      const positiveRatio = voteData.upvotes / voteData.totalVotes;

      if (positiveRatio >= 0.6) {
        // Move to campaigning status (ready for campaign setup)
        project.status = ProjectStatus.CAMPAIGNING;
        await project.save({ session });

        // No need to update crowdfund status as campaign takes over
        console.log(
          `Project ${projectId} moved to campaigning status due to vote threshold`,
        );
      } else if (positiveRatio < 0.4) {
        // Reject if too many negative votes
        project.status = ProjectStatus.REJECTED;
        await project.save({ session });

        crowdfund.status = CrowdfundStatus.REJECTED;
        crowdfund.rejectedReason = "Insufficient positive votes from community";
        await crowdfund.save({ session });

        console.log(`Project ${projectId} rejected due to negative vote ratio`);
      }
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error("Error checking project status:", error);
  } finally {
    session.endSession();
  }
}

export { checkAndUpdateProjectStatus };
