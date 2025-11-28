import { Types } from "mongoose";
import HackathonDiscussion from "../../models/hackathon-discussion.model.js";
import { IHackathonDiscussion } from "../../models/hackathon-discussion.model.js";
import Organization from "../../models/organization.model.js";
import HackathonParticipant from "../../models/hackathon-participant.model.js";
import { checkPermission } from "../../utils/getUserRole.js";

/**
 * Build nested discussion tree structure
 * Groups replies under their parent discussions
 */
export const buildDiscussionTree = (discussions: any[]): any[] => {
  // Separate top-level discussions and replies
  const topLevel: any[] = [];
  const repliesMap = new Map<string, any[]>();

  discussions.forEach((discussion) => {
    if (discussion.parentCommentId) {
      const parentId = discussion.parentCommentId.toString();
      if (!repliesMap.has(parentId)) {
        repliesMap.set(parentId, []);
      }
      repliesMap.get(parentId)!.push(discussion);
    } else {
      topLevel.push(discussion);
    }
  });

  // Attach replies to their parents
  const attachReplies = (discussion: any): any => {
    const discussionId = discussion._id.toString();
    const replies = repliesMap.get(discussionId) || [];

    return {
      ...discussion,
      replies: replies.map(attachReplies),
      replyCount: replies.length,
    };
  };

  return topLevel.map(attachReplies);
};

/**
 * Calculate reply count for a discussion
 */
export const calculateReplyCount = async (
  discussionId: Types.ObjectId,
): Promise<number> => {
  return await HackathonDiscussion.countDocuments({
    parentCommentId: discussionId,
    status: "active",
  });
};

/**
 * Calculate total reactions for a discussion
 */
export const calculateTotalReactions = (reactionCounts: {
  LIKE: number;
  DISLIKE: number;
  HELPFUL: number;
}): number => {
  return reactionCounts.LIKE + reactionCounts.DISLIKE + reactionCounts.HELPFUL;
};

/**
 * Check if user is registered in a hackathon
 * Returns true if user has a participant record for the hackathon
 */
export const isUserRegisteredInHackathon = async (
  userId: Types.ObjectId,
  hackathonId: Types.ObjectId,
): Promise<boolean> => {
  const participant = await HackathonParticipant.findOne({
    userId,
    hackathonId,
  });
  return !!participant;
};

/**
 * Check if user can edit/delete a discussion
 * Users can edit/delete their own discussions
 * Organization admins can moderate all discussions
 */
export const canModifyDiscussion = async (
  discussion: IHackathonDiscussion,
  userId: Types.ObjectId,
  organizationId: Types.ObjectId,
  userEmail: string,
): Promise<boolean> => {
  // User owns the discussion
  if (discussion.userId.toString() === userId.toString()) {
    return true;
  }

  // Check if user is organization admin
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    return false;
  }

  const canManage = checkPermission(organization, userEmail, [
    "owner",
    "admin",
  ]);

  return canManage;
};

/**
 * Format discussion for API response
 */
export const formatDiscussionResponse = (discussion: any): any => {
  return {
    _id: discussion._id,
    userId: discussion.userId,
    projectId: discussion.hackathonId, // API guide uses projectId
    content: discussion.content,
    status: discussion.status,
    editHistory: discussion.editHistory || [],
    reactionCounts: discussion.reactionCounts || {
      LIKE: 0,
      DISLIKE: 0,
      HELPFUL: 0,
    },
    totalReactions:
      calculateTotalReactions(
        discussion.reactionCounts || {
          LIKE: 0,
          DISLIKE: 0,
          HELPFUL: 0,
        },
      ) || 0,
    replyCount: discussion.replyCount || 0,
    replies: discussion.replies || [],
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
    isSpam: discussion.isSpam || false,
    reports: discussion.reports || [],
  };
};
