import mongoose from "mongoose";
import dotenv from "dotenv";
import HackathonParticipant from "../models/hackathon-participant.model";
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
      return;
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
    try {
      await HackathonParticipant.insertMany(participants, {
        ordered: false, // Continue inserting even if some fail
      });
      console.log(
        `✅ Successfully created ${participants.length} mock participants`,
      );
    } catch (error: any) {
      // Handle partial insertions
      if (error.insertedDocs && error.insertedDocs.length > 0) {
        console.log(
          `⚠️  Partially successful: Created ${error.insertedDocs.length} out of ${participants.length} participants`,
        );
        if (error.writeErrors) {
          console.log(
            `   ${error.writeErrors.length} duplicates or errors skipped`,
          );
        }
      } else {
        throw error;
      }
    }
    console.log(
      `   - Individual participants: ${participants.filter((p) => p.participationType === "individual").length}`,
    );
    console.log(
      `   - Team participants: ${participants.filter((p) => p.participationType === "team").length}`,
    );
    console.log(
      `   - With submissions: ${participants.filter((p) => p.submission).length}`,
    );
  } catch (error) {
    console.error("Error generating mock participants:", error);
    throw error;
  }
};

const seedHackathonParticipants = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://Vercel-Admin-boundless-db:Ev22QK3ZHNAJy0bE@boundless-db.ho6o77g.mongodb.net/?retryWrites=true&w=majority",
    );

    console.log("🌱 Starting hackathon participants seed...");

    // Get first organization
    const organization = await Organization.findOne();
    if (!organization) {
      console.error(
        "No organization found. Please create an organization first.",
      );
      process.exit(1);
    }

    // Get first published hackathon
    const hackathon = await Hackathon.findOne({
      organizationId: organization._id,
      status: { $in: ["published", "ongoing"] },
    });

    if (!hackathon) {
      console.error(
        "No published hackathon found. Please create and publish a hackathon first.",
      );
      process.exit(1);
    }

    console.log(`📋 Using hackathon: ${hackathon.title}`);
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
  seedHackathonParticipants();
}

export { generateMockParticipants, seedHackathonParticipants };
