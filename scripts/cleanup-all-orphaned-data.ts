/**
 * Cleanup script for ALL orphaned user data
 *
 * This script finds all orphaned references (data pointing to non-existent users)
 * and cleans them up automatically.
 *
 * Usage:
 *   ts-node scripts/cleanup-all-orphaned-data.ts [--dry-run]
 *
 * Options:
 *   --dry-run: Show what would be cleaned without actually deleting anything
 *
 * Example:
 *   ts-node scripts/cleanup-all-orphaned-data.ts --dry-run
 *   ts-node scripts/cleanup-all-orphaned-data.ts
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
import HackathonJudgingScore from "../src/models/hackathon-judging-score.model.js";
import HackathonSubmissionComment from "../src/models/hackathon-submission-comment.model.js";
import HackathonSubmissionVote from "../src/models/hackathon-submission-vote.model.js";

dotenv.config();

interface CleanupStats {
  notifications: number;
  activities: number;
  follows: number;
  sessions: number;
  votes: number;
  reactions: number;
  teamInvitations: number;
  hackathonParticipants: number;
  hackathonJudgingScores: number;
  hackathonSubmissionComments: number;
  hackathonSubmissionVotes: number;
  otps: number;
  accounts: number;
  fundings: number;
  comments: number;
  projectComments: number;
  projects: number;
  organizations: number;
  grantApplications: number;
  campaigns: number;
  grants: number;
}

const cleanupAllOrphanedData = async (dryRun: boolean = false) => {
  const session = await mongoose.startSession();
  if (!dryRun) {
    session.startTransaction();
  }

  try {
    console.log(
      `🔍 ${dryRun ? "DRY RUN: " : ""}Finding all orphaned user data...\n`,
    );

    // Get all existing user IDs (including deleted users for reference)
    const allUsers = await User.find({}).select("_id email deleted").lean();
    const validUserIds = new Set(
      allUsers.filter((u) => !u.deleted).map((u) => u._id.toString()),
    );
    const allUserIds = new Set(allUsers.map((u) => u._id.toString()));
    const userEmails = new Set(
      allUsers.filter((u) => !u.deleted).map((u) => u.email.toLowerCase()),
    );
    const allUserEmails = new Set(allUsers.map((u) => u.email.toLowerCase()));

    console.log(
      `📊 Found ${validUserIds.size} active users and ${allUserIds.size} total users\n`,
    );

    const stats: CleanupStats = {
      notifications: 0,
      activities: 0,
      follows: 0,
      sessions: 0,
      votes: 0,
      reactions: 0,
      teamInvitations: 0,
      hackathonParticipants: 0,
      hackathonJudgingScores: 0,
      hackathonSubmissionComments: 0,
      hackathonSubmissionVotes: 0,
      otps: 0,
      accounts: 0,
      fundings: 0,
      comments: 0,
      projectComments: 0,
      projects: 0,
      organizations: 0,
      grantApplications: 0,
      campaigns: 0,
      grants: 0,
    };

    // 1. Find orphaned notifications
    console.log("🔍 Checking notifications...");
    const orphanedNotifications = await Notification.find({
      $or: [
        {
          "userId.type": {
            $nin: Array.from(allUserIds).map(
              (id) => new mongoose.Types.ObjectId(id),
            ),
          },
        },
        { "userId.type": null },
      ],
    }).lean();
    stats.notifications = orphanedNotifications.length;
    console.log(
      `   Found ${orphanedNotifications.length} orphaned notifications`,
    );

    if (!dryRun && orphanedNotifications.length > 0) {
      await Notification.deleteMany(
        {
          _id: { $in: orphanedNotifications.map((n) => n._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedNotifications.length} orphaned notifications`,
      );
    }

    // 2. Find orphaned activities
    console.log("🔍 Checking activities...");
    const orphanedActivities = await Activity.find({
      $or: [
        {
          "userId.type": {
            $nin: Array.from(allUserIds).map(
              (id) => new mongoose.Types.ObjectId(id),
            ),
          },
        },
        { "userId.type": null },
      ],
    }).lean();
    stats.activities = orphanedActivities.length;
    console.log(`   Found ${orphanedActivities.length} orphaned activities`);

    if (!dryRun && orphanedActivities.length > 0) {
      await Activity.deleteMany(
        {
          _id: { $in: orphanedActivities.map((a) => a._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedActivities.length} orphaned activities`,
      );
    }

    // 3. Find orphaned follow relationships
    console.log("🔍 Checking follow relationships...");
    const allFollows = await Follow.find({}).lean();
    const orphanedFollows = allFollows.filter(
      (f) =>
        !validUserIds.has(f.follower.toString()) ||
        !validUserIds.has(f.following.toString()),
    );
    stats.follows = orphanedFollows.length;
    console.log(
      `   Found ${orphanedFollows.length} orphaned follow relationships`,
    );

    if (!dryRun && orphanedFollows.length > 0) {
      await Follow.deleteMany(
        {
          _id: { $in: orphanedFollows.map((f) => f._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedFollows.length} orphaned follow relationships`,
      );
    }

    // 4. Find orphaned sessions
    console.log("🔍 Checking sessions...");
    const orphanedSessions = await Session.find({
      userId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.sessions = orphanedSessions.length;
    console.log(`   Found ${orphanedSessions.length} orphaned sessions`);

    if (!dryRun && orphanedSessions.length > 0) {
      await Session.deleteMany(
        {
          _id: { $in: orphanedSessions.map((s) => s._id) },
        },
        { session },
      );
      console.log(`   ✓ Deleted ${orphanedSessions.length} orphaned sessions`);
    }

    // 5. Find orphaned votes
    console.log("🔍 Checking votes...");
    const orphanedVotes = await Vote.find({
      userId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.votes = orphanedVotes.length;
    console.log(`   Found ${orphanedVotes.length} orphaned votes`);

    if (!dryRun && orphanedVotes.length > 0) {
      await Vote.deleteMany(
        {
          _id: { $in: orphanedVotes.map((v) => v._id) },
        },
        { session },
      );
      console.log(`   ✓ Deleted ${orphanedVotes.length} orphaned votes`);
    }

    // 6. Find orphaned reactions
    console.log("🔍 Checking reactions...");
    const orphanedReactions = await Reaction.find({
      userId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.reactions = orphanedReactions.length;
    console.log(`   Found ${orphanedReactions.length} orphaned reactions`);

    if (!dryRun && orphanedReactions.length > 0) {
      await Reaction.deleteMany(
        {
          _id: { $in: orphanedReactions.map((r) => r._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedReactions.length} orphaned reactions`,
      );
    }

    // 7. Find orphaned team invitations
    console.log("🔍 Checking team invitations...");
    const allTeamInvitations = await TeamInvitation.find({}).lean();
    const orphanedTeamInvitations = allTeamInvitations.filter(
      (ti) =>
        (ti.invitedBy && !validUserIds.has(ti.invitedBy.toString())) ||
        (ti.invitedUser && !validUserIds.has(ti.invitedUser.toString())),
    );
    stats.teamInvitations = orphanedTeamInvitations.length;
    console.log(
      `   Found ${orphanedTeamInvitations.length} orphaned team invitations`,
    );

    if (!dryRun && orphanedTeamInvitations.length > 0) {
      await TeamInvitation.deleteMany(
        {
          _id: { $in: orphanedTeamInvitations.map((ti) => ti._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedTeamInvitations.length} orphaned team invitations`,
      );
    }

    // 8. Find orphaned hackathon participants
    console.log("🔍 Checking hackathon participants...");
    const orphanedParticipants = await HackathonParticipant.find({
      userId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.hackathonParticipants = orphanedParticipants.length;
    console.log(
      `   Found ${orphanedParticipants.length} orphaned hackathon participants`,
    );

    if (!dryRun && orphanedParticipants.length > 0) {
      await HackathonParticipant.deleteMany(
        {
          _id: { $in: orphanedParticipants.map((p) => p._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedParticipants.length} orphaned hackathon participants`,
      );
    }

    // 9. Find orphaned hackathon judging scores
    console.log("🔍 Checking hackathon judging scores...");
    const orphanedJudgingScores = await HackathonJudgingScore.find({
      judgeId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.hackathonJudgingScores = orphanedJudgingScores.length;
    console.log(
      `   Found ${orphanedJudgingScores.length} orphaned hackathon judging scores`,
    );

    if (!dryRun && orphanedJudgingScores.length > 0) {
      await HackathonJudgingScore.deleteMany(
        {
          _id: { $in: orphanedJudgingScores.map((js) => js._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedJudgingScores.length} orphaned hackathon judging scores`,
      );
    }

    // 10. Find orphaned hackathon submission comments
    console.log("🔍 Checking hackathon submission comments...");
    const orphanedSubmissionComments = await HackathonSubmissionComment.find({
      userId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.hackathonSubmissionComments = orphanedSubmissionComments.length;
    console.log(
      `   Found ${orphanedSubmissionComments.length} orphaned hackathon submission comments`,
    );

    if (!dryRun && orphanedSubmissionComments.length > 0) {
      await HackathonSubmissionComment.deleteMany(
        {
          _id: { $in: orphanedSubmissionComments.map((sc) => sc._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedSubmissionComments.length} orphaned hackathon submission comments`,
      );
    }

    // 11. Find orphaned hackathon submission votes
    console.log("🔍 Checking hackathon submission votes...");
    const orphanedSubmissionVotes = await HackathonSubmissionVote.find({
      userId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.hackathonSubmissionVotes = orphanedSubmissionVotes.length;
    console.log(
      `   Found ${orphanedSubmissionVotes.length} orphaned hackathon submission votes`,
    );

    if (!dryRun && orphanedSubmissionVotes.length > 0) {
      await HackathonSubmissionVote.deleteMany(
        {
          _id: { $in: orphanedSubmissionVotes.map((sv) => sv._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedSubmissionVotes.length} orphaned hackathon submission votes`,
      );
    }

    // 12. Find orphaned OTP records
    console.log("🔍 Checking OTP records...");
    const orphanedOTPs = await OTP.find({
      userId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.otps = orphanedOTPs.length;
    console.log(`   Found ${orphanedOTPs.length} orphaned OTP records`);

    if (!dryRun && orphanedOTPs.length > 0) {
      await OTP.deleteMany(
        {
          _id: { $in: orphanedOTPs.map((o) => o._id) },
        },
        { session },
      );
      console.log(`   ✓ Deleted ${orphanedOTPs.length} orphaned OTP records`);
    }

    // 13. Find orphaned account records
    console.log("🔍 Checking account records...");
    const orphanedAccounts = await Account.find({
      userId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.accounts = orphanedAccounts.length;
    console.log(`   Found ${orphanedAccounts.length} orphaned account records`);

    if (!dryRun && orphanedAccounts.length > 0) {
      await Account.deleteMany(
        {
          _id: { $in: orphanedAccounts.map((a) => a._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedAccounts.length} orphaned account records`,
      );
    }

    // 14. Find orphaned funding records
    console.log("🔍 Checking funding records...");
    const orphanedFundings = await Funding.find({
      userId: {
        $nin: Array.from(allUserIds).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
    stats.fundings = orphanedFundings.length;
    console.log(`   Found ${orphanedFundings.length} orphaned funding records`);

    if (!dryRun && orphanedFundings.length > 0) {
      await Funding.deleteMany(
        {
          _id: { $in: orphanedFundings.map((f) => f._id) },
        },
        { session },
      );
      console.log(
        `   ✓ Deleted ${orphanedFundings.length} orphaned funding records`,
      );
    }

    // 15. Find orphaned comments
    console.log("🔍 Checking comments...");
    const orphanedComments = await Comment.find({
      $or: [
        {
          author: {
            $nin: Array.from(allUserIds).map(
              (id) => new mongoose.Types.ObjectId(id),
            ),
          },
        },
        { author: null },
      ],
    }).lean();
    stats.comments = orphanedComments.length;
    console.log(`   Found ${orphanedComments.length} orphaned comments`);

    if (!dryRun && orphanedComments.length > 0) {
      await Comment.updateMany(
        {
          _id: { $in: orphanedComments.map((c) => c._id) },
        },
        {
          $set: {
            content: "[Comment deleted - user no longer exists]",
            status: "deleted",
          },
          $unset: {
            author: "",
          },
        },
        { session },
      );
      console.log(
        `   ✓ Anonymized ${orphanedComments.length} orphaned comments`,
      );
    }

    // 16. Find orphaned project comments
    console.log("🔍 Checking project comments...");
    const orphanedProjectComments = await ProjectComment.find({
      $or: [
        {
          userId: {
            $nin: Array.from(allUserIds).map(
              (id) => new mongoose.Types.ObjectId(id),
            ),
          },
        },
        { userId: null },
      ],
    }).lean();
    stats.projectComments = orphanedProjectComments.length;
    console.log(
      `   Found ${orphanedProjectComments.length} orphaned project comments`,
    );

    if (!dryRun && orphanedProjectComments.length > 0) {
      await ProjectComment.updateMany(
        {
          _id: { $in: orphanedProjectComments.map((pc) => pc._id) },
        },
        {
          $set: {
            content: "[Comment deleted - user no longer exists]",
            status: "deleted",
          },
          $unset: {
            userId: "",
          },
        },
        { session },
      );
      console.log(
        `   ✓ Anonymized ${orphanedProjectComments.length} orphaned project comments`,
      );
    }

    // 17. Find orphaned project references
    console.log("🔍 Checking projects...");
    const allProjects = await Project.find({})
      .select("owner creator team funding.contributors voting.voters")
      .lean();
    const orphanedProjectRefs: any[] = [];

    for (const project of allProjects) {
      const issues: string[] = [];

      // Check owner
      if (
        project.owner?.type &&
        !validUserIds.has(project.owner.type.toString())
      ) {
        issues.push("owner");
      }

      // Check creator
      if (project.creator && !validUserIds.has(project.creator.toString())) {
        issues.push("creator");
      }

      // Check team members
      if (project.team) {
        const orphanedTeamMembers = project.team.filter(
          (member: any) =>
            member.userId && !validUserIds.has(member.userId.toString()),
        );
        if (orphanedTeamMembers.length > 0) {
          issues.push(`${orphanedTeamMembers.length} team members`);
        }
      }

      // Check contributors
      if (project.funding?.contributors) {
        const orphanedContributors = project.funding.contributors.filter(
          (contributor: any) =>
            contributor.user && !validUserIds.has(contributor.user.toString()),
        );
        if (orphanedContributors.length > 0) {
          issues.push(`${orphanedContributors.length} contributors`);
        }
      }

      // Check voters
      if (project.voting?.voters) {
        const orphanedVoters = project.voting.voters.filter(
          (voter: any) =>
            voter.userId && !validUserIds.has(voter.userId.toString()),
        );
        if (orphanedVoters.length > 0) {
          issues.push(`${orphanedVoters.length} voters`);
        }
      }

      if (issues.length > 0) {
        orphanedProjectRefs.push({ project, issues });
      }
    }

    stats.projects = orphanedProjectRefs.length;
    console.log(
      `   Found ${orphanedProjectRefs.length} projects with orphaned references`,
    );

    if (!dryRun && orphanedProjectRefs.length > 0) {
      for (const { project, issues } of orphanedProjectRefs) {
        const updates: any = {};

        // Remove orphaned owner
        if (
          project.owner?.type &&
          !validUserIds.has(project.owner.type.toString())
        ) {
          updates.$unset = { ...updates.$unset, "owner.type": "", creator: "" };
        }

        // Remove orphaned team members
        if (project.team) {
          const validTeamMembers = project.team.filter(
            (member: any) =>
              !member.userId || validUserIds.has(member.userId.toString()),
          );
          if (validTeamMembers.length !== project.team.length) {
            updates.$set = { ...updates.$set, team: validTeamMembers };
          }
        }

        // Remove orphaned contributors
        if (project.funding?.contributors) {
          const validContributors = project.funding.contributors.filter(
            (contributor: any) =>
              !contributor.user ||
              validUserIds.has(contributor.user.toString()),
          );
          if (
            validContributors.length !== project.funding.contributors.length
          ) {
            updates.$set = {
              ...updates.$set,
              "funding.contributors": validContributors,
            };
          }
        }

        // Remove orphaned voters
        if (project.voting?.voters) {
          const validVoters = project.voting.voters.filter(
            (voter: any) =>
              !voter.userId || validUserIds.has(voter.userId.toString()),
          );
          if (validVoters.length !== project.voting.voters.length) {
            updates.$set = { ...updates.$set, "voting.voters": validVoters };
          }
        }

        if (Object.keys(updates).length > 0) {
          await Project.findByIdAndUpdate(project._id, updates, { session });
        }
      }
      console.log(
        `   ✓ Cleaned ${orphanedProjectRefs.length} projects with orphaned references`,
      );
    }

    // 18. Find orphaned organization references
    console.log("🔍 Checking organizations...");
    const allOrgs = await Organization.find({})
      .select("owner members admins")
      .lean();
    const orphanedOrgRefs: any[] = [];

    for (const org of allOrgs) {
      const issues: string[] = [];

      // Check owner email
      if (org.owner && !userEmails.has(org.owner.toLowerCase())) {
        issues.push("owner");
      }

      // Check members
      const orphanedMembers = org.members.filter(
        (email) => !userEmails.has(email.toLowerCase()),
      );
      if (orphanedMembers.length > 0) {
        issues.push(`${orphanedMembers.length} members`);
      }

      // Check admins
      if (org.admins) {
        const orphanedAdmins = org.admins.filter(
          (email) => !userEmails.has(email.toLowerCase()),
        );
        if (orphanedAdmins.length > 0) {
          issues.push(`${orphanedAdmins.length} admins`);
        }
      }

      if (issues.length > 0) {
        orphanedOrgRefs.push({ org, issues });
      }
    }

    stats.organizations = orphanedOrgRefs.length;
    console.log(
      `   Found ${orphanedOrgRefs.length} organizations with orphaned references`,
    );

    if (!dryRun && orphanedOrgRefs.length > 0) {
      for (const { org } of orphanedOrgRefs) {
        const updates: any = { $pull: {} };

        // Remove orphaned members
        const validMembers = org.members.filter((email) =>
          userEmails.has(email.toLowerCase()),
        );
        if (validMembers.length !== org.members.length) {
          updates.$set = { ...updates.$set, members: validMembers };
        }

        // Remove orphaned admins
        if (org.admins) {
          const validAdmins = org.admins.filter((email) =>
            userEmails.has(email.toLowerCase()),
          );
          if (validAdmins.length !== org.admins.length) {
            updates.$set = { ...updates.$set, admins: validAdmins };
          }
        }

        // Handle orphaned owner
        if (org.owner && !userEmails.has(org.owner.toLowerCase())) {
          // Try to transfer to first admin
          if (org.admins && org.admins.length > 0) {
            const firstAdmin = org.admins.find((email) =>
              userEmails.has(email.toLowerCase()),
            );
            if (firstAdmin) {
              updates.$set = { ...updates.$set, owner: firstAdmin };
              updates.$pull = {
                ...updates.$pull,
                members: firstAdmin,
                admins: firstAdmin,
              };
            }
          }
          // Or first member
          else if (org.members && org.members.length > 0) {
            const firstMember = org.members.find((email) =>
              userEmails.has(email.toLowerCase()),
            );
            if (firstMember) {
              updates.$set = { ...updates.$set, owner: firstMember };
              updates.$pull = { ...updates.$pull, members: firstMember };
            }
          }
          // Or archive
          else {
            updates.$set = {
              ...updates.$set,
              archived: true,
              archivedAt: new Date(),
              archivedBy: "system",
            };
          }
        }

        if (
          Object.keys(updates.$set || {}).length > 0 ||
          Object.keys(updates.$pull || {}).length > 0
        ) {
          await Organization.findByIdAndUpdate(org._id, updates, { session });
        }
      }
      console.log(
        `   ✓ Cleaned ${orphanedOrgRefs.length} organizations with orphaned references`,
      );
    }

    // 19. Find orphaned grant applications
    console.log("🔍 Checking grant applications...");
    const orphanedGrantApps = await GrantApplication.find({
      $or: [
        {
          applicantId: {
            $nin: Array.from(allUserIds).map(
              (id) => new mongoose.Types.ObjectId(id),
            ),
          },
        },
        { applicantId: null },
      ],
    }).lean();
    stats.grantApplications = orphanedGrantApps.length;
    console.log(
      `   Found ${orphanedGrantApps.length} orphaned grant applications`,
    );

    if (!dryRun && orphanedGrantApps.length > 0) {
      await GrantApplication.updateMany(
        {
          _id: { $in: orphanedGrantApps.map((ga) => ga._id) },
        },
        {
          $set: { status: "withdrawn" },
          $unset: { applicantId: "" },
        },
        { session },
      );
      console.log(
        `   ✓ Updated ${orphanedGrantApps.length} orphaned grant applications`,
      );
    }

    // 20. Find orphaned campaigns
    console.log("🔍 Checking campaigns...");
    const orphanedCampaigns = await Campaign.find({
      $or: [
        {
          creatorId: {
            $nin: Array.from(allUserIds).map(
              (id) => new mongoose.Types.ObjectId(id),
            ),
          },
        },
        { creatorId: null },
      ],
    }).lean();
    stats.campaigns = orphanedCampaigns.length;
    console.log(`   Found ${orphanedCampaigns.length} orphaned campaigns`);

    if (!dryRun && orphanedCampaigns.length > 0) {
      await Campaign.updateMany(
        {
          _id: { $in: orphanedCampaigns.map((c) => c._id) },
        },
        {
          $set: { status: "cancelled" },
          $unset: { creatorId: "" },
        },
        { session },
      );
      console.log(
        `   ✓ Updated ${orphanedCampaigns.length} orphaned campaigns`,
      );
    }

    // 21. Find orphaned grants
    console.log("🔍 Checking grants...");
    const orphanedGrants = await Grant.find({
      $or: [
        {
          creatorId: {
            $nin: Array.from(allUserIds).map(
              (id) => new mongoose.Types.ObjectId(id),
            ),
          },
        },
        { creatorId: null },
      ],
    }).lean();
    stats.grants = orphanedGrants.length;
    console.log(`   Found ${orphanedGrants.length} orphaned grants`);

    if (!dryRun && orphanedGrants.length > 0) {
      await Grant.updateMany(
        {
          _id: { $in: orphanedGrants.map((g) => g._id) },
        },
        {
          $set: { status: "cancelled" },
          $unset: { creatorId: "" },
        },
        { session },
      );
      console.log(`   ✓ Updated ${orphanedGrants.length} orphaned grants`);
    }

    if (!dryRun) {
      await session.commitTransaction();
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 CLEANUP SUMMARY");
    console.log("=".repeat(60));
    console.log(`Notifications:        ${stats.notifications}`);
    console.log(`Activities:           ${stats.activities}`);
    console.log(`Follow relationships: ${stats.follows}`);
    console.log(`Sessions:            ${stats.sessions}`);
    console.log(`Votes:               ${stats.votes}`);
    console.log(`Reactions:            ${stats.reactions}`);
    console.log(`Team invitations:     ${stats.teamInvitations}`);
    console.log(`Hackathon participants: ${stats.hackathonParticipants}`);
    console.log(`Hackathon judging scores: ${stats.hackathonJudgingScores}`);
    console.log(
      `Hackathon submission comments: ${stats.hackathonSubmissionComments}`,
    );
    console.log(
      `Hackathon submission votes: ${stats.hackathonSubmissionVotes}`,
    );
    console.log(`OTP records:         ${stats.otps}`);
    console.log(`Account records:     ${stats.accounts}`);
    console.log(`Funding records:     ${stats.fundings}`);
    console.log(`Comments:            ${stats.comments} (anonymized)`);
    console.log(`Project comments:    ${stats.projectComments} (anonymized)`);
    console.log(`Projects:            ${stats.projects} (cleaned)`);
    console.log(`Organizations:       ${stats.organizations} (cleaned)`);
    console.log(`Grant applications:  ${stats.grantApplications}`);
    console.log(`Campaigns:           ${stats.campaigns}`);
    console.log(`Grants:              ${stats.grants}`);
    console.log("=".repeat(60));

    const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
    console.log(
      `\n${dryRun ? "Would clean" : "Cleaned"}: ${total} orphaned records\n`,
    );

    if (dryRun) {
      console.log("💡 This was a DRY RUN. No data was actually modified.");
      console.log("   Run without --dry-run to perform the cleanup.\n");
    } else {
      console.log("✅ Cleanup completed successfully!\n");
    }
  } catch (error) {
    if (!dryRun) {
      await session.abortTransaction();
    }
    console.error("❌ Error during cleanup:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Main execution
const dryRun = process.argv.includes("--dry-run");

// Validate MongoDB URI
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("❌ MONGODB_URI environment variable is not set");
  console.error("   Please set it in your .env file or export it:");
  console.error(
    "   export MONGODB_URI='mongodb://localhost:27017/your-database'",
  );
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
  console.error(`   Current value: ${mongoUri.substring(0, 20)}...`);
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("📦 Connected to MongoDB\n");
    return cleanupAllOrphanedData(dryRun);
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
