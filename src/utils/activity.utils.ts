import Activity, { ActivityType } from "../models/activity.model";
import mongoose from "mongoose";

interface CreateActivityParams {
  userId: mongoose.Types.ObjectId;
  type: ActivityType;
  projectId?: mongoose.Types.ObjectId;
  amount?: number;
  transactionHash?: string;
  milestoneId?: mongoose.Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  additionalDetails?: { [key: string]: any };
}

/**
 * Create a new activity record
 */
export const createActivity = async (
  params: CreateActivityParams,
): Promise<void> => {
  try {
    const activity = new Activity({
      userId: params.userId,
      type: params.type,
      details: {
        projectId: params.projectId,
        amount: params.amount,
        transactionHash: params.transactionHash,
        milestoneId: params.milestoneId,
        ...params.additionalDetails,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    await activity.save();
  } catch (error) {
    console.error("Error creating activity:", error);
    // Don't throw error to avoid breaking the main flow
  }
};

/**
 * Create activity for project creation
 */
export const createProjectCreatedActivity = async (
  userId: mongoose.Types.ObjectId,
  projectId: mongoose.Types.ObjectId,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> => {
  await createActivity({
    userId,
    type: ActivityType.PROJECT_CREATED,
    projectId,
    ipAddress,
    userAgent,
  });
};

/**
 * Create activity for project funding
 */
export const createProjectFundedActivity = async (
  userId: mongoose.Types.ObjectId,
  projectId: mongoose.Types.ObjectId,
  amount: number,
  transactionHash: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> => {
  await createActivity({
    userId,
    type: ActivityType.CONTRIBUTION_MADE,
    projectId,
    amount,
    transactionHash,
    ipAddress,
    userAgent,
  });
};

/**
 * Create activity for project voting
 */
export const createProjectVotedActivity = async (
  userId: mongoose.Types.ObjectId,
  projectId: mongoose.Types.ObjectId,
  vote: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> => {
  await createActivity({
    userId,
    type: ActivityType.PROJECT_VOTED,
    projectId,
    ipAddress,
    userAgent,
    additionalDetails: { vote },
  });
};

/**
 * Create activity for comment posting
 */
export const createCommentPostedActivity = async (
  userId: mongoose.Types.ObjectId,
  projectId: mongoose.Types.ObjectId,
  commentId: mongoose.Types.ObjectId,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> => {
  await createActivity({
    userId,
    type: ActivityType.COMMENT_POSTED,
    projectId,
    ipAddress,
    userAgent,
    additionalDetails: { commentId },
  });
};

/**
 * Create activity for profile update
 */
export const createProfileUpdatedActivity = async (
  userId: mongoose.Types.ObjectId,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> => {
  await createActivity({
    userId,
    type: ActivityType.PROFILE_UPDATED,
    ipAddress,
    userAgent,
  });
};

/**
 * Create activity for user login
 */
export const createLoginActivity = async (
  userId: mongoose.Types.ObjectId,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> => {
  await createActivity({
    userId,
    type: ActivityType.LOGIN,
    ipAddress,
    userAgent,
  });
};

/**
 * Create activity for user following
 */
export const createUserFollowedActivity = async (
  followerId: mongoose.Types.ObjectId,
  followingId: mongoose.Types.ObjectId,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> => {
  await createActivity({
    userId: followerId,
    type: ActivityType.USER_FOLLOWED,
    ipAddress,
    userAgent,
    additionalDetails: { followingId },
  });
};

/**
 * Create activity for organization joining
 */
export const createOrganizationJoinedActivity = async (
  userId: mongoose.Types.ObjectId,
  organizationId: mongoose.Types.ObjectId,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> => {
  await createActivity({
    userId,
    type: ActivityType.ORGANIZATION_JOINED,
    ipAddress,
    userAgent,
    additionalDetails: { organizationId },
  });
};
