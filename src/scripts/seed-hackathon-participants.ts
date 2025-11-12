import mongoose from "mongoose";
import dotenv from "dotenv";
import HackathonParticipant from "../models/hackathon-participant.model";
import HackathonSubmissionComment from "../models/hackathon-submission-comment.model";
import HackathonSubmissionVote from "../models/hackathon-submission-vote.model";
import Hackathon from "../models/hackathon.model";
import User from "../models/user.model";
import Organization from "../models/organization.model";

dotenv.config();

const projectNames = [
  "DeFi Yield Optimizer",
  "NFT Marketplace Aggregator",
  "Cross-Chain Bridge Protocol",
  "DAO Governance Platform",
  "Web3 Social Network",
  "Decentralized Exchange",
  "Lending Protocol",
  "Staking Platform",
  "Gaming Metaverse",
  "Identity Verification System",
  "Supply Chain Tracker",
  "Carbon Credit Marketplace",
  "Real Estate Tokenization",
  "Music NFT Platform",
  "Prediction Market",
];

const categories = [
  "DeFi",
  "NFTs",
  "DAOs",
  "Layer 2",
  "Cross-chain",
  "Web3 Gaming",
  "Infrastructure",
  "Privacy",
];

const firstNames = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Eve",
  "Frank",
  "Grace",
  "Henry",
  "Ivy",
  "Jack",
  "Kate",
  "Liam",
  "Mia",
  "Noah",
  "Olivia",
];

const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Wilson",
  "Anderson",
  "Thomas",
];

const roles = [
  "Team Lead",
  "Frontend Developer",
  "Backend Developer",
  "Smart Contract Developer",
  "UI/UX Designer",
  "Product Manager",
  "Blockchain Architect",
  "DevOps Engineer",
];

const getRandomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomDate = (start: Date, end: Date): Date => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
};

const generateMockParticipants = async (
  hackathonId: string,
  organizationId: string,
  count: number = 50,
) => {
  try {
    // Get hackathon to know date range
    const hackathon = await Hackathon.findById(hackathonId);
    if (!hackathon) {
      console.error("Hackathon not found");
      return;
    }

    // Get users to use as participants - need at least as many users as participants
    const totalUsers = await User.countDocuments();
    if (totalUsers < count) {
      console.warn(
        `⚠️  Only ${totalUsers} users available, but ${count} participants requested. Creating ${totalUsers} participants instead.`,
      );
      count = totalUsers;
    }

    const users = await User.find().limit(count);
    if (users.length === 0) {
      console.error("No users found. Please seed users first.");
      return;
    }

    // Get existing participants to avoid duplicates
    const existingParticipants = await HackathonParticipant.find({
      hackathonId: new mongoose.Types.ObjectId(hackathonId),
    })
      .select("userId")
      .lean();

    const existingUserIds = new Set(
      existingParticipants.map((p: any) => p.userId.toString()),
    );

    // Filter out users who are already participants
    const availableUsers = users.filter(
      (user) => !existingUserIds.has(user._id.toString()),
    );

    if (availableUsers.length === 0) {
      console.log(
        "ℹ️  All available users are already participants in this hackathon.",
      );
      console.log(
        "📝 Will generate comments/votes for existing submissions...",
      );
      // Don't return - continue to generate comments/votes for existing participants
    }

    // Clear existing participants for this hackathon if you want to regenerate
    // Uncomment the line below if you want to delete and recreate all participants
    // await HackathonParticipant.deleteMany({
    //   hackathonId: new mongoose.Types.ObjectId(hackathonId),
    // });

    const startDate = hackathon.startDate || hackathon.createdAt;
    const submissionDeadline = hackathon.submissionDeadline || new Date();

    const participants = [];
    const teamMap = new Map<string, any[]>();
    const actualCount = Math.min(count, availableUsers.length);

    for (let i = 0; i < actualCount; i++) {
      const user = availableUsers[i];
      const isTeam = Math.random() > 0.5 && i < count - 5; // 50% teams, but keep some individuals
      const participationType = isTeam ? "team" : "individual";

      let teamId: string | undefined;
      let teamName: string | undefined;
      let teamMembers: any[] | undefined;

      if (isTeam) {
        const teamSize = Math.floor(Math.random() * 3) + 2; // 2-4 members
        teamId = `team-${Math.random().toString(36).substring(7)}`;
        teamName = `Team ${getRandomElement(firstNames)}`;

        // Create team members - use available users, avoiding duplicates
        teamMembers = [];
        const usedUserIds = new Set([user._id.toString()]);
        for (let j = 0; j < teamSize && j < availableUsers.length; j++) {
          // Find a user that hasn't been used in this team
          let memberUser = availableUsers.find(
            (u) => !usedUserIds.has(u._id.toString()),
          );
          if (!memberUser) {
            // If all users are used, just pick any available user
            memberUser = availableUsers[j % availableUsers.length];
          }
          usedUserIds.add(memberUser._id.toString());
          teamMembers.push({
            userId: memberUser._id,
            name: `${memberUser.profile.firstName} ${memberUser.profile.lastName}`,
            username: memberUser.profile.username,
            role: getRandomElement(roles),
            avatar: memberUser.profile.avatar || undefined,
          });
        }

        // Store team info
        if (!teamMap.has(teamId)) {
          teamMap.set(teamId, []);
        }
        teamMap.get(teamId)!.push({
          userId: user._id,
          teamId,
          teamName,
          teamMembers,
        });
      }

      const registeredAt = getRandomDate(startDate, new Date());
      const hasSubmission = Math.random() > 0.3; // 70% have submissions

      let submission: any = undefined;
      let submittedAt: Date | undefined = undefined;

      if (hasSubmission) {
        submittedAt = getRandomDate(registeredAt, submissionDeadline);
        submission = {
          projectName: getRandomElement(projectNames),
          category: getRandomElement(categories),
          description: `A revolutionary ${getRandomElement(categories)} project that aims to transform the blockchain ecosystem.`,
          logo: `https://picsum.photos/200/200?random=${i}`,
          videoUrl: `https://example.com/demo-video-${i}.mp4`,
          introduction: `We are excited to present our innovative solution that addresses key challenges in the ${getRandomElement(categories)} space.`,
          links: [
            {
              type: "github",
              url: `https://github.com/user/project-${i}`,
            },
            {
              type: "website",
              url: `https://project-${i}.example.com`,
            },
          ],
          votes: Math.floor(Math.random() * 100),
          comments: Math.floor(Math.random() * 50),
          submissionDate: submittedAt,
          status: getRandomElement([
            "submitted",
            "shortlisted",
            "disqualified",
          ]),
        };
      }

      const participant = {
        userId: user._id,
        hackathonId: new mongoose.Types.ObjectId(hackathonId),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        participationType,
        teamId,
        teamName,
        teamMembers,
        socialLinks: {
          github: `https://github.com/${user.profile.username}`,
          twitter: `https://twitter.com/${user.profile.username}`,
          telegram: `@${user.profile.username}`,
          email: user.email,
        },
        submission,
        registeredAt,
        submittedAt,
      };

      participants.push(participant);
    }

    // Insert participants (with error handling for duplicates)
    let insertedParticipants: any[] = [];
    if (participants.length > 0) {
      try {
        const result = await HackathonParticipant.insertMany(participants, {
          ordered: false, // Continue inserting even if some fail
        });
        insertedParticipants = result;
        console.log(
          `✅ Successfully created ${insertedParticipants.length} mock participants`,
        );
      } catch (error: any) {
        // Handle partial insertions
        if (error.insertedDocs && error.insertedDocs.length > 0) {
          insertedParticipants = error.insertedDocs;
          console.log(
            `⚠️  Partially successful: Created ${error.insertedDocs.length} out of ${participants.length} participants`,
          );
          if (error.writeErrors) {
            console.log(
              `   ${error.writeErrors.length} duplicates or errors skipped`,
            );
          }
        } else {
          // If it's a duplicate error but no docs were inserted, continue
          if (error.code === 11000) {
            console.log("ℹ️  All participants already exist, continuing...");
          } else {
            throw error;
          }
        }
      }
      if (insertedParticipants.length > 0) {
        console.log(
          `   - Individual participants: ${insertedParticipants.filter((p) => p.participationType === "individual").length}`,
        );
        console.log(
          `   - Team participants: ${insertedParticipants.filter((p) => p.participationType === "team").length}`,
        );
        console.log(
          `   - With submissions: ${insertedParticipants.filter((p) => p.submission).length}`,
        );
      }
    } else {
      console.log("ℹ️  No new participants to create.");
    }

    // Generate mock comments and votes for submissions
    // Get existing participants with submissions if no new ones were created
    let submissionsWithData = insertedParticipants.filter((p) => p.submission);

    // If no new participants were created, get existing ones with submissions
    if (submissionsWithData.length === 0) {
      const existingParticipants = await HackathonParticipant.find({
        hackathonId: new mongoose.Types.ObjectId(hackathonId),
        submission: { $exists: true, $ne: null },
      }).lean();
      submissionsWithData = existingParticipants;
      console.log(
        `📝 Found ${submissionsWithData.length} existing submissions to add comments/votes to`,
      );
    } else {
      console.log(
        `📝 Using ${submissionsWithData.length} new submissions to add comments/votes to`,
      );
    }

    const allUsers = await User.find().limit(20).lean();
    console.log(
      `👥 Found ${allUsers.length} users for generating comments/votes`,
    );

    if (submissionsWithData.length > 0 && allUsers.length > 0) {
      console.log(`🚀 Starting to generate comments and votes...`);
      const comments = [];
      const votes = [];
      const commentTemplates = [
        "Great project! This looks really promising.",
        "Interesting approach. How do you plan to scale this?",
        "Love the UI/UX design. Very clean and intuitive.",
        "The smart contract architecture looks solid. Well done!",
        "This could really solve a major problem in the space.",
        "Impressive work. Looking forward to seeing this in action.",
        "The technical implementation is impressive.",
        "Great team and execution. Best of luck!",
        "This is exactly what the ecosystem needs.",
        "Very innovative solution. Keep up the good work!",
      ];

      for (const participant of submissionsWithData) {
        const submissionId = participant._id;
        const submissionDate =
          participant.submittedAt || participant.registeredAt;

        // Generate 2-8 comments per submission
        const numComments = Math.floor(Math.random() * 7) + 2;
        for (let i = 0; i < numComments && i < allUsers.length; i++) {
          const commentUser = allUsers[i % allUsers.length];
          const commentDate = new Date(submissionDate);
          commentDate.setTime(
            commentDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000,
          ); // Within 7 days of submission

          comments.push({
            submissionId,
            userId: commentUser._id,
            content: getRandomElement(commentTemplates),
            status: "active",
            reactionCounts: {
              LIKE: Math.floor(Math.random() * 10),
              DISLIKE: Math.floor(Math.random() * 2),
              HELPFUL: Math.floor(Math.random() * 5),
            },
            createdAt: commentDate,
            updatedAt: commentDate,
          });
        }

        // Generate 5-25 votes per submission
        const numVotes = Math.floor(Math.random() * 21) + 5;
        const usedVoteUsers = new Set<string>();
        for (let i = 0; i < numVotes && i < allUsers.length; i++) {
          let voteUser = allUsers[Math.floor(Math.random() * allUsers.length)];
          let attempts = 0;
          while (usedVoteUsers.has(voteUser._id.toString()) && attempts < 10) {
            voteUser = allUsers[Math.floor(Math.random() * allUsers.length)];
            attempts++;
          }
          usedVoteUsers.add(voteUser._id.toString());

          const voteDate = new Date(submissionDate);
          voteDate.setTime(
            voteDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000,
          );

          votes.push({
            submissionId,
            userId: voteUser._id,
            value: Math.random() > 0.1 ? 1 : -1, // 90% upvotes, 10% downvotes
            createdAt: voteDate,
            updatedAt: voteDate,
          });
        }
      }

      // Insert comments and votes
      if (comments.length > 0) {
        try {
          await HackathonSubmissionComment.insertMany(comments, {
            ordered: false,
          });
          console.log(`✅ Created ${comments.length} mock comments`);
        } catch (error: any) {
          if (error.insertedDocs) {
            console.log(
              `⚠️  Created ${error.insertedDocs.length} out of ${comments.length} comments`,
            );
          }
        }
      }

      if (votes.length > 0) {
        try {
          await HackathonSubmissionVote.insertMany(votes, { ordered: false });
          console.log(`✅ Created ${votes.length} mock votes`);
        } catch (error: any) {
          if (error.insertedDocs) {
            console.log(
              `⚠️  Created ${error.insertedDocs.length} out of ${votes.length} votes`,
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error generating mock participants:", error);
    throw error;
  }
};

const seedHackathonParticipants = async (hackathonId?: string) => {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      "mongodb+srv://Vercel-Admin-boundless-db:Ev22QK3ZHNAJy0bE@boundless-db.ho6o77g.mongodb.net/?retryWrites=true&w=majority";
    await mongoose.connect(mongoUri);

    console.log("🌱 Starting hackathon participants seed...");

    let hackathon;
    let organization;

    if (hackathonId) {
      // Use provided hackathon ID
      if (!mongoose.Types.ObjectId.isValid(hackathonId)) {
        console.error("❌ Invalid hackathon ID format");
        process.exit(1);
      }

      hackathon = await Hackathon.findById(hackathonId);
      if (!hackathon) {
        console.error(`❌ Hackathon with ID ${hackathonId} not found`);
        process.exit(1);
      }

      organization = await Organization.findById(hackathon.organizationId);
      if (!organization) {
        console.error(
          `❌ Organization with ID ${hackathon.organizationId} not found`,
        );
        process.exit(1);
      }
    } else {
      // Fallback to original behavior: Get first organization
      organization = await Organization.findOne();
      if (!organization) {
        console.error(
          "No organization found. Please create an organization first.",
        );
        process.exit(1);
      }

      // Get first published hackathon
      hackathon = await Hackathon.findOne({
        organizationId: organization._id,
        status: { $in: ["published", "ongoing"] },
      });

      if (!hackathon) {
        console.error(
          "No published hackathon found. Please create and publish a hackathon first.",
        );
        process.exit(1);
      }
    }

    console.log(
      `📋 Using hackathon: ${hackathon.title} (ID: ${hackathon._id})`,
    );
    console.log(`🏢 Using organization: ${organization.name}`);

    await generateMockParticipants(
      (hackathon._id as mongoose.Types.ObjectId).toString(),
      (organization._id as mongoose.Types.ObjectId).toString(),
      50, // Generate 50 participants
    );

    console.log("✅ Seed completed successfully!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  // Get hackathon ID from command line arguments
  const hackathonId = process.argv[2];
  seedHackathonParticipants(hackathonId);
}

export { generateMockParticipants, seedHackathonParticipants };
