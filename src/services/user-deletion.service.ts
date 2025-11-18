import mongoose from "mongoose";
import User from "../models/user.model.js";
import Project from "../models/project.model.js";
import Comment from "../models/comment.model.js";
import Notification from "../models/notification.model.js";
import Activity from "../models/activity.model.js";
import Follow from "../models/follow.model.js";
import Organization from "../models/organization.model.js";
import TeamInvitation from "../models/team-invitation.model.js";
import HackathonParticipant from "../models/hackathon-participant.model.js";
import Vote from "../models/vote.model.js";
import Session from "../models/session.model.js";
import Reaction from "../models/reaction.model.js";
import ProjectComment from "../models/project-comment.model.js";
import OTP from "../models/otp.model.js";
import Account from "../models/account.model.js";
import GrantApplication from "../models/grant-application.model.js";
import Funding from "../models/funding.model.js";
import Campaign from "../models/campaign.model.js";
import Grant from "../models/grant.model.js";
import HackathonJudgingScore from "../models/hackathon-judging-score.model.js";
import HackathonSubmissionComment from "../models/hackathon-submission-comment.model.js";
import HackathonSubmissionVote from "../models/hackathon-submission-vote.model.js";

export class UserDeletionService {
  /**
   * Soft delete user and clean up related data
   */
  static async deleteUser(
    userId: mongoose.Types.ObjectId,
    userEmail: string,
    reason?: string,
  ): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Delete notifications
      await Notification.deleteMany({ "userId.type": userId }, { session });

      // 2. Delete activities
      await Activity.deleteMany({ "userId.type": userId }, { session });

      // 3. Delete follow relationships
      await Follow.deleteMany(
        {
          $or: [{ follower: userId }, { following: userId }],
        },
        { session },
      );

      // 4. Delete sessions
      await Session.deleteMany({ userId }, { session });

      // 5. Delete votes
      await Vote.deleteMany({ userId }, { session });

      // 6. Delete reactions
      await Reaction.deleteMany({ userId }, { session });

      // 7. Delete team invitations
      await TeamInvitation.deleteMany(
        {
          $or: [{ invitedBy: userId }, { invitedUser: userId }],
        },
        { session },
      );

      // 8. Delete hackathon participants
      await HackathonParticipant.deleteMany({ userId }, { session });

      // 8a. Delete hackathon judging scores
      await HackathonJudgingScore.deleteMany({ judgeId: userId }, { session });

      // 8b. Delete hackathon submission comments
      await HackathonSubmissionComment.deleteMany({ userId }, { session });

      // 8c. Delete hackathon submission votes
      await HackathonSubmissionVote.deleteMany({ userId }, { session });

      // 9. Delete OTP records
      await OTP.deleteMany({ userId }, { session });

      // 10. Delete account records (Better Auth)
      await Account.deleteMany({ userId }, { session });

      // 11. Delete funding records
      await Funding.deleteMany({ userId }, { session });

      // 12. Anonymize comments
      await Comment.updateMany(
        { author: userId },
        {
          $set: {
            content: "[Comment deleted by user]",
            status: "deleted",
          },
          $unset: {
            author: "",
          },
        },
        { session },
      );

      // 13. Remove user from comment mentions
      await Comment.updateMany(
        { mentions: userId },
        {
          $pull: { mentions: userId },
        },
        { session },
      );

      // 14. Remove user from comment reports
      await Comment.updateMany(
        { "reports.userId": userId },
        {
          $pull: { reports: { userId } },
        },
        { session },
      );

      // 15. Anonymize project comments
      await ProjectComment.updateMany(
        { userId },
        {
          $set: {
            content: "[Comment deleted by user]",
            status: "deleted",
          },
          $unset: {
            userId: "",
          },
        },
        { session },
      );

      // 16. Handle projects - cancel or anonymize
      await this.handleUserProjects(userId, session);

      // 17. Handle organizations - remove from members/admins and transfer ownership if needed
      await this.handleOrganizations(userId, userEmail, session);

      // 18. Handle grant applications
      await GrantApplication.updateMany(
        { applicantId: userId },
        {
          $set: { status: "withdrawn" },
          $unset: { applicantId: "" },
        },
        { session },
      );

      // 19. Handle campaigns
      await Campaign.updateMany(
        { creatorId: userId },
        {
          $set: { status: "cancelled" },
          $unset: { creatorId: "" },
        },
        { session },
      );

      // 20. Handle grants
      await Grant.updateMany(
        { creatorId: userId },
        {
          $set: { status: "cancelled" },
          $unset: { creatorId: "" },
        },
        { session },
      );

      // 21. Soft delete the user
      await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            deleted: true,
            deletedAt: new Date(),
            deletedReason: reason || "User requested account deletion",
            // Anonymize email to prevent reuse (keep original for reference but make unique)
            email: `deleted_${userId}_${Date.now()}@deleted.boundlessfi.xyz`,
            // Anonymize profile
            "profile.firstName": "Deleted",
            "profile.lastName": "User",
            "profile.username": `deleted_${userId.toString().slice(-8)}`,
            "profile.avatar": "",
            "profile.bio": "",
            "profile.location": "",
            "profile.website": "",
            "profile.socialLinks": {},
            // Clear sensitive data
            password: "$2a$10$deleted_account_hash_placeholder",
            otp: undefined,
            resetPasswordToken: undefined,
            resetPasswordExpires: undefined,
            invitationToken: undefined,
            // Set status to banned to prevent login
            status: "BANNED",
          },
        },
        { session },
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Handle user's projects - cancel or anonymize
   */
  private static async handleUserProjects(
    userId: mongoose.Types.ObjectId,
    session: mongoose.ClientSession,
  ): Promise<void> {
    // Cancel projects in draft/rejected status
    await Project.updateMany(
      {
        "owner.type": userId,
        status: { $in: ["idea", "rejected"] },
      },
      {
        $set: {
          status: "cancelled",
        },
        $unset: {
          "owner.type": "",
          creator: "",
        },
      },
      { session },
    );

    // For active projects, just remove ownership but keep project
    await Project.updateMany(
      {
        "owner.type": userId,
        status: { $nin: ["idea", "rejected", "cancelled"] },
      },
      {
        $unset: {
          "owner.type": "",
          creator: "",
        },
      },
      { session },
    );

    // Remove user from project team
    await Project.updateMany(
      { "team.userId": userId },
      {
        $pull: { team: { userId } },
      },
      { session },
    );

    // Remove user from project contributors
    await Project.updateMany(
      { "funding.contributors.user": userId },
      {
        $pull: { "funding.contributors": { user: userId } },
      },
      { session },
    );

    // Remove user from project voters
    await Project.updateMany(
      { "voting.voters.userId": userId },
      {
        $pull: { "voting.voters": { userId } },
      },
      { session },
    );
  }

  /**
   * Handle organization membership and ownership
   */
  private static async handleOrganizations(
    userId: mongoose.Types.ObjectId,
    userEmail: string,
    session: mongoose.ClientSession,
  ): Promise<void> {
    // Remove user from members and admins
    await Organization.updateMany(
      {
        $or: [
          { owner: userEmail },
          { members: userEmail },
          { admins: userEmail },
        ],
      },
      {
        $pull: {
          members: userEmail,
          admins: userEmail,
        },
      },
      { session },
    );

    // Handle organization ownership transfer
    const orgsWithDeletedOwner = await Organization.find({
      owner: userEmail,
    }).session(session);

    for (const org of orgsWithDeletedOwner) {
      let newOwner: string | null = null;

      // Try to transfer to first admin
      if (org.admins && org.admins.length > 0) {
        newOwner = org.admins[0];
      }
      // Or first member
      else if (org.members && org.members.length > 0) {
        newOwner = org.members[0];
      }

      if (newOwner) {
        await Organization.findByIdAndUpdate(
          org._id,
          {
            $set: { owner: newOwner },
            $pull: { members: newOwner, admins: newOwner },
          },
          { session },
        );
      } else {
        // No members left, archive the organization
        await Organization.findByIdAndUpdate(
          org._id,
          {
            $set: {
              archived: true,
              archivedAt: new Date(),
              archivedBy: "system",
            },
          },
          { session },
        );
      }
    }
  }
}
