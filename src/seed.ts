import mongoose from "mongoose";
import User, { UserRole, UserStatus } from "./models/user.model";
import Project, { ProjectStatus } from "./models/project.model";
import Badge from "./models/badge.model";
import Contract from "./models/contract.model";
import Milestone from "./models/milestone.model";
import Transaction from "./models/transaction.model";
import Comment from "./models/comment.model";
import Notification from "./models/notification.model";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "");

    await Promise.all([
      User.deleteMany({}),
      Project.deleteMany({}),
      Badge.deleteMany({}),
      Contract.deleteMany({}),
      Milestone.deleteMany({}),
      Transaction.deleteMany({}),
      Comment.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Create test users
    const hashedPassword = await bcrypt.hash("test123", 10);

    const adminUser = await User.create({
      email: "admin@boundlessfi.xyz",
      password: hashedPassword,
      profile: {
        firstName: "Admin",
        lastName: "User",
        username: "admin",
        avatar: "https://example.com/avatar1.jpg",
        bio: "System Administrator",
        location: "Global",
        website: "https://boundlessfi.xyz",
        socialLinks: {
          twitter: "https://twitter.com/admin",
          linkedin: "https://linkedin.com/in/admin",
        },
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: true,
          showContributions: true,
        },
        preferences: { language: "en", timezone: "UTC", theme: "DARK" },
      },
      stats: {
        projectsCreated: 0,
        projectsFunded: 0,
        totalContributed: 0,
        reputation: 100,
        communityScore: 100,
      },
      status: UserStatus.ACTIVE,
      roles: [
        {
          role: UserRole.ADMIN,
          grantedAt: new Date(),
          status: "ACTIVE",
        },
      ],
    });

    const creatorUser = await User.create({
      email: "creator@boundlessfi.xyz",
      password: hashedPassword,
      profile: {
        firstName: "Project",
        lastName: "Creator",
        username: "creator",
        avatar: "https://example.com/avatar2.jpg",
        bio: "Blockchain Developer",
        location: "San Francisco",
        website: "https://creator.com",
        socialLinks: {
          github: "https://github.com/creator",
          discord: "creator#1234",
        },
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: true,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "America/Los_Angeles",
          theme: "LIGHT",
        },
      },
      stats: {
        projectsCreated: 2,
        projectsFunded: 0,
        totalContributed: 0,
        reputation: 50,
        communityScore: 75,
      },
      status: UserStatus.ACTIVE,
      roles: [
        {
          role: UserRole.CREATOR,
          grantedAt: new Date(),
          status: "ACTIVE",
        },
      ],
    });

    const backerUser = await User.create({
      email: "backer@boundlessfi.xyz",
      password: hashedPassword,
      profile: {
        firstName: "Project",
        lastName: "Backer",
        username: "backer",
        avatar: "https://example.com/avatar3.jpg",
        bio: "Crypto Investor",
        location: "New York",
        website: "https://backer.com",
        socialLinks: {
          twitter: "https://twitter.com/backer",
          linkedin: "https://linkedin.com/in/backer",
        },
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: true,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "America/New_York",
          theme: "SYSTEM",
        },
      },
      stats: {
        projectsCreated: 0,
        projectsFunded: 3,
        totalContributed: 5000,
        reputation: 75,
        communityScore: 85,
      },
      status: UserStatus.ACTIVE,
      roles: [
        {
          role: UserRole.BACKER,
          grantedAt: new Date(),
          status: "ACTIVE",
        },
      ],
    });

    const project1 = await Project.create({
      title: "Decentralized Social Network",
      description:
        "A blockchain-based social network that gives users control over their data",
      category: "Social Media",
      status: ProjectStatus.FUNDING,
      owner: {
        type: creatorUser._id,
        ref: "User",
      },
      funding: {
        goal: 100000,
        raised: 25000,
        currency: "USDC",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        contributors: [
          {
            user: backerUser._id,
            amount: 25000,
            date: new Date(),
            transactionHash: "0x1234567890abcdef",
          },
        ],
      },
      voting: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        totalVotes: 100,
        positiveVotes: 85,
        negativeVotes: 15,
        voters: [
          {
            userId: backerUser._id,
            vote: "positive",
            votedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      milestones: [
        {
          title: "MVP Development",
          description: "Develop minimum viable product with core features",
          amount: 40000,
          dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
        {
          title: "Beta Testing",
          description: "Launch beta version and gather user feedback",
          amount: 30000,
          dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
        {
          title: "Full Launch",
          description: "Launch platform with all planned features",
          amount: 30000,
          dueDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
      ],
      team: [
        {
          userId: creatorUser._id,
          role: "Lead Developer",
          joinedAt: new Date(),
        },
      ],
      media: {
        banner: "https://example.com/banner1.jpg",
        logo: "https://example.com/logo1.jpg",
      },
      documents: {
        whitepaper: "https://example.com/whitepaper1.pdf",
        pitchDeck: "https://example.com/pitchdeck1.pdf",
      },
    });

    const project2 = await Project.create({
      title: "NFT Marketplace",
      description:
        "A decentralized marketplace for digital art and collectibles",
      category: "NFT",
      status: ProjectStatus.DRAFT,
      owner: {
        type: creatorUser._id,
        ref: "User",
      },
      funding: {
        goal: 50000,
        raised: 0,
        currency: "ETH",
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        contributors: [],
      },
      milestones: [
        {
          title: "Smart Contract Development",
          description: "Develop and audit smart contracts",
          amount: 20000,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
        {
          title: "UI/UX Development",
          description: "Design and implement user interface",
          amount: 15000,
          dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
        {
          title: "Launch",
          description: "Launch marketplace with initial features",
          amount: 15000,
          dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
      ],
      team: [
        {
          userId: creatorUser._id,
          role: "Project Lead",
          joinedAt: new Date(),
        },
      ],
      media: {
        banner: "https://example.com/banner2.jpg",
        logo: "https://example.com/logo2.jpg",
      },
      documents: {
        whitepaper: "https://example.com/whitepaper2.pdf",
        pitchDeck: "https://example.com/pitchdeck2.pdf",
      },
    });

    const comment1 = await Comment.create({
      content:
        "This is an exciting project! I love the idea of a decentralized social network.",
      projectId: project1._id,
      author: backerUser._id,
      status: "active",
      reactionCounts: {
        LIKE: 5,
        DISLIKE: 0,
        HELPFUL: 2,
        SPAM: 0,
      },
    });

    const comment2 = await Comment.create({
      content: "How will you handle user data privacy?",
      projectId: project1._id,
      author: adminUser._id,
      parentCommentId: comment1._id,
      status: "active",
      reactionCounts: {
        LIKE: 3,
        DISLIKE: 0,
        HELPFUL: 1,
        SPAM: 0,
      },
    });

    const comment3 = await Comment.create({
      content:
        "We'll use zero-knowledge proofs and end-to-end encryption for all user data.",
      projectId: project1._id,
      author: creatorUser._id,
      parentCommentId: comment2._id,
      status: "active",
      mentions: [adminUser._id],
      reactionCounts: {
        LIKE: 8,
        DISLIKE: 0,
        HELPFUL: 5,
        SPAM: 0,
      },
    });

    const comment4 = await Comment.create({
      content:
        "This NFT marketplace looks promising! What blockchain will you use?",
      projectId: project2._id,
      author: backerUser._id,
      status: "active",
      reactionCounts: {
        LIKE: 4,
        DISLIKE: 0,
        HELPFUL: 1,
        SPAM: 0,
      },
    });

    const comment5 = await Comment.create({
      content:
        "We're building on Ethereum with plans to expand to other chains.",
      projectId: project2._id,
      author: creatorUser._id,
      parentCommentId: comment4._id,
      status: "active",
      mentions: [backerUser._id],
      reactionCounts: {
        LIKE: 6,
        DISLIKE: 0,
        HELPFUL: 3,
        SPAM: 0,
      },
    });

    const comment6 = await Comment.create({
      content: "This is spam content! Buy my tokens!",
      projectId: project1._id,
      author: backerUser._id,
      status: "flagged",
      isSpam: true,
      reports: [
        {
          userId: adminUser._id,
          reason: "Spam",
          description: "Promoting unrelated tokens",
          createdAt: new Date(),
        },
      ],
      reactionCounts: {
        LIKE: 0,
        DISLIKE: 10,
        HELPFUL: 0,
        SPAM: 8,
      },
    });

    const grantCreatorUser = await User.create({
      email: "grantcreator@boundlessfi.xyz",
      password: hashedPassword,
      profile: {
        firstName: "Grant",
        lastName: "Creator",
        username: "grantcreator",
        avatar: "https://example.com/avatar4.jpg",
        bio: "Grant Program Manager",
        location: "London",
        website: "https://grantcreator.com",
        socialLinks: {
          twitter: "https://twitter.com/grantcreator",
        },
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: true,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "Europe/London",
          theme: "DARK",
        },
      },
      stats: {
        projectsCreated: 0,
        projectsFunded: 0,
        totalContributed: 0,
        reputation: 90,
        communityScore: 95,
      },
      status: UserStatus.ACTIVE,
      roles: [
        {
          role: UserRole.CREATOR,
          grantedAt: new Date(),
          status: "ACTIVE",
        },
      ],
    });

    const grantProject = await Project.create({
      title: "Open Source Grant Program",
      description: "Funding open source blockchain projects.",
      category: "Grant",
      status: ProjectStatus.FUNDING,
      owner: {
        type: grantCreatorUser._id,
        ref: "User",
      },
      funding: {
        goal: 200000,
        raised: 50000,
        currency: "USDC",
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        contributors: [
          {
            user: backerUser._id,
            amount: 50000,
            date: new Date(),
            transactionHash: "0xabcdef1234567890",
          },
        ],
      },
      grant: {
        isGrant: true,
        applications: [
          {
            applicant: creatorUser._id,
            status: "SUBMITTED",
            submittedAt: new Date(),
            nextAction: "Review Application",
            escrowedAmount: 10000,
            milestonesCompleted: 1,
          },
        ],
        totalBudget: 200000,
        totalDisbursed: 10000,
        proposalsReceived: 1,
        proposalsApproved: 0,
        status: "OPEN",
      },
      milestones: [
        {
          title: "Grant Application Review",
          description: "Review and approve grant applications.",
          amount: 10000,
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
      ],
      team: [
        {
          userId: grantCreatorUser._id,
          role: "Grant Manager",
          joinedAt: new Date(),
        },
      ],
      media: {
        banner: "https://example.com/grantbanner.jpg",
        logo: "https://example.com/grantlogo.jpg",
      },
      documents: {
        whitepaper: "https://example.com/grantwhitepaper.pdf",
        pitchDeck: "https://example.com/grantpitchdeck.pdf",
      },
    });

    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
