/**
 * Cleanup script for orphaned user data
 *
 * This script cleans up data related to users that were deleted directly from the database
 * without going through the proper deletion endpoint.
 *
 * Usage:
 *   ts-node scripts/cleanup-orphaned-user-data.ts <userId> <userEmail>
 *
 * Example:
 *   ts-node scripts/cleanup-orphaned-user-data.ts 507f1f77bcf86cd799439011 user@example.com
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file in project root
dotenv.config({ path: resolve(__dirname, "..", ".env") });
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

import User from "../src/models/user.model.js";
import Project from "../src/models/project.model.js";
import Comment from "../src/models/comment.model.js";
import Notification from "../src/models/notification.model.js";
import Activity from "../src/models/activity.model.js";
import Follow from "../src/models/follow.model.js";
import Organization from "../src/models/organization.model.js";
import TeamInvitation from "../src/models/team-invitation.model.js";
import HackathonParticipant from "../src/models/hackathon-participant.model.js";
import Vote from "../src/models/vote.model.js";
import Session from "../src/models/session.model.js";
import Reaction from "../src/models/reaction.model.js";
import ProjectComment from "../src/models/project-comment.model.js";
import OTP from "../src/models/otp.model.js";
import Account from "../src/models/account.model.js";
import GrantApplication from "../src/models/grant-application.model.js";
import Funding from "../src/models/funding.model.js";
import Campaign from "../src/models/campaign.model.js";
import Grant from "../src/models/grant.model.js";

dotenv.config();

const cleanupOrphanedUserData = async (userId: string, userEmail: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    console.error("❌ Invalid user ID format");
    process.exit(1);
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(`🔍 Starting cleanup for user: ${userId} (${userEmail})`);

    // Check if user exists
    const user = await User.findById(userObjectId).session(session);
    if (user && !user.deleted) {
      console.log(
        "⚠️  User still exists and is not deleted. Use the API endpoint instead.",
      );
      console.log("   DELETE /api/users/account");
      await session.abortTransaction();
      process.exit(1);
    }

    let deletedCount = 0;

    // 1. Delete notifications
    const notificationsResult = await Notification.deleteMany(
      { "userId.type": userObjectId },
      { session },
    );
    deletedCount += notificationsResult.deletedCount || 0;
    console.log(
      `   ✓ Deleted ${notificationsResult.deletedCount || 0} notifications`,
    );

    // 2. Delete activities
    const activitiesResult = await Activity.deleteMany(
      { "userId.type": userObjectId },
      { session },
    );
    deletedCount += activitiesResult.deletedCount || 0;
    console.log(
      `   ✓ Deleted ${activitiesResult.deletedCount || 0} activities`,
    );

    // 3. Delete follow relationships
    const followsResult = await Follow.deleteMany(
      {
        $or: [{ follower: userObjectId }, { following: userObjectId }],
      },
      { session },
    );
    deletedCount += followsResult.deletedCount || 0;
    console.log(
      `   ✓ Deleted ${followsResult.deletedCount || 0} follow relationships`,
    );

    // 4. Delete sessions
    const sessionsResult = await Session.deleteMany(
      { userId: userObjectId },
      { session },
    );
    deletedCount += sessionsResult.deletedCount || 0;
    console.log(`   ✓ Deleted ${sessionsResult.deletedCount || 0} sessions`);

    // 5. Delete votes
    const votesResult = await Vote.deleteMany(
      { userId: userObjectId },
      { session },
    );
    deletedCount += votesResult.deletedCount || 0;
    console.log(`   ✓ Deleted ${votesResult.deletedCount || 0} votes`);

    // 6. Delete reactions
    const reactionsResult = await Reaction.deleteMany(
      { userId: userObjectId },
      { session },
    );
    deletedCount += reactionsResult.deletedCount || 0;
    console.log(`   ✓ Deleted ${reactionsResult.deletedCount || 0} reactions`);

    // 7. Delete team invitations
    const teamInvitationsResult = await TeamInvitation.deleteMany(
      {
        $or: [{ invitedBy: userObjectId }, { invitedUser: userObjectId }],
      },
      { session },
    );
    deletedCount += teamInvitationsResult.deletedCount || 0;
    console.log(
      `   ✓ Deleted ${teamInvitationsResult.deletedCount || 0} team invitations`,
    );

    // 8. Delete hackathon participants
    const participantsResult = await HackathonParticipant.deleteMany(
      { userId: userObjectId },
      { session },
    );
    deletedCount += participantsResult.deletedCount || 0;
    console.log(
      `   ✓ Deleted ${participantsResult.deletedCount || 0} hackathon participants`,
    );

    // 9. Delete OTP records
    const otpsResult = await OTP.deleteMany(
      { userId: userObjectId },
      { session },
    );
    deletedCount += otpsResult.deletedCount || 0;
    console.log(`   ✓ Deleted ${otpsResult.deletedCount || 0} OTP records`);

    // 10. Delete account records
    const accountsResult = await Account.deleteMany(
      { userId: userObjectId },
      { session },
    );
    deletedCount += accountsResult.deletedCount || 0;
    console.log(
      `   ✓ Deleted ${accountsResult.deletedCount || 0} account records`,
    );

    // 11. Delete funding records
    const fundingsResult = await Funding.deleteMany(
      { userId: userObjectId },
      { session },
    );
    deletedCount += fundingsResult.deletedCount || 0;
    console.log(
      `   ✓ Deleted ${fundingsResult.deletedCount || 0} funding records`,
    );

    // 12. Anonymize comments
    const commentsResult = await Comment.updateMany(
      { author: userObjectId },
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
    console.log(
      `   ✓ Anonymized ${commentsResult.modifiedCount || 0} comments`,
    );

    // 13. Remove user from comment mentions
    const mentionsResult = await Comment.updateMany(
      { mentions: userObjectId },
      {
        $pull: { mentions: userObjectId },
      },
      { session },
    );
    console.log(
      `   ✓ Removed from ${mentionsResult.modifiedCount || 0} comment mentions`,
    );

    // 14. Anonymize project comments
    const projectCommentsResult = await ProjectComment.updateMany(
      { userId: userObjectId },
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
    console.log(
      `   ✓ Anonymized ${projectCommentsResult.modifiedCount || 0} project comments`,
    );

    // 15. Handle projects
    const projectsResult = await Project.updateMany(
      { "owner.type": userObjectId },
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
    console.log(`   ✓ Cancelled ${projectsResult.modifiedCount || 0} projects`);

    // Remove from project teams
    const teamResult = await Project.updateMany(
      { "team.userId": userObjectId },
      {
        $pull: { team: { userId: userObjectId } },
      },
      { session },
    );
    console.log(
      `   ✓ Removed from ${teamResult.modifiedCount || 0} project teams`,
    );

    // Remove from project contributors
    const contributorsResult = await Project.updateMany(
      { "funding.contributors.user": userObjectId },
      {
        $pull: { "funding.contributors": { user: userObjectId } },
      },
      { session },
    );
    console.log(
      `   ✓ Removed from ${contributorsResult.modifiedCount || 0} project contributors`,
    );

    // 16. Handle organizations
    const orgsResult = await Organization.updateMany(
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
    console.log(
      `   ✓ Removed from ${orgsResult.modifiedCount || 0} organizations`,
    );

    // Handle organization ownership
    const orgsWithDeletedOwner = await Organization.find({
      owner: userEmail,
    }).session(session);

    for (const org of orgsWithDeletedOwner) {
      let newOwner: string | null = null;

      if (org.admins && org.admins.length > 0) {
        newOwner = org.admins[0];
      } else if (org.members && org.members.length > 0) {
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
        console.log(
          `   ✓ Transferred ownership of org ${org.name} to ${newOwner}`,
        );
      } else {
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
        console.log(`   ✓ Archived org ${org.name} (no members left)`);
      }
    }

    // 17. Handle grant applications
    const grantAppsResult = await GrantApplication.updateMany(
      { applicantId: userObjectId },
      {
        $set: { status: "withdrawn" },
        $unset: { applicantId: "" },
      },
      { session },
    );
    console.log(
      `   ✓ Updated ${grantAppsResult.modifiedCount || 0} grant applications`,
    );

    // 18. Handle campaigns
    const campaignsResult = await Campaign.updateMany(
      { creatorId: userObjectId },
      {
        $set: { status: "cancelled" },
        $unset: { creatorId: "" },
      },
      { session },
    );
    console.log(
      `   ✓ Cancelled ${campaignsResult.modifiedCount || 0} campaigns`,
    );

    // 19. Handle grants
    const grantsResult = await Grant.updateMany(
      { creatorId: userObjectId },
      {
        $set: { status: "cancelled" },
        $unset: { creatorId: "" },
      },
      { session },
    );
    console.log(`   ✓ Cancelled ${grantsResult.modifiedCount || 0} grants`);

    await session.commitTransaction();
    console.log(`\n✅ Cleanup completed successfully!`);
    console.log(`   Total records deleted: ${deletedCount}`);
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error during cleanup:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Main execution
const userId = process.argv[2];
const userEmail = process.argv[3];

if (!userId || !userEmail) {
  console.error(
    "Usage: ts-node scripts/cleanup-orphaned-user-data.ts <userId> <userEmail>",
  );
  console.error(
    "Example: ts-node scripts/cleanup-orphaned-user-data.ts 507f1f77bcf86cd799439011 user@example.com",
  );
  process.exit(1);
}

// Validate MongoDB URI
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri || mongoUri.trim() === "") {
  console.error("❌ MONGODB_URI environment variable is not set or is empty");
  console.error("\n   Please set it in your .env file:");
  console.error("   MONGODB_URI=mongodb://localhost:27017/your-database");
  console.error("   or");
  console.error(
    "   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database",
  );
  console.error("\n   Or export it before running:");
  console.error(
    "   export MONGODB_URI='mongodb://localhost:27017/your-database'",
  );
  console.error("\n   Current .env files checked:");
  console.error(`   - ${resolve(__dirname, "..", ".env")}`);
  console.error(`   - ${resolve(__dirname, "..", ".env.local")}`);
  process.exit(1);
}

if (
  !mongoUri.startsWith("mongodb://") &&
  !mongoUri.startsWith("mongodb+srv://")
) {
  console.error("❌ Invalid MONGODB_URI format");
  console.error(
    "   Connection string must start with 'mongodb://' or 'mongodb+srv://'",
  );
  console.error(`   Current value: ${mongoUri.substring(0, 50)}...`);
  console.error("\n   Valid examples:");
  console.error("   mongodb://localhost:27017/your-database");
  console.error(
    "   mongodb+srv://username:password@cluster.mongodb.net/database",
  );
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("📦 Connected to MongoDB");
    return cleanupOrphanedUserData(userId, userEmail);
  })
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    mongoose.disconnect();
  });
