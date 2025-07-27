import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import User, { UserRole, UserStatus } from "../models/user.model";
import Project, { ProjectStatus } from "../models/project.model";
import Campaign from "../models/campaign.model";
import Milestone from "../models/milestone.model";
import { TestUserFactory, cleanupTestData } from "./testHelpers";

describe("POST /api/campaigns", () => {
  let creatorToken: string;
  let creatorId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Clean up any existing data
    await Campaign.deleteMany({});
    await Project.deleteMany({});
    await Milestone.deleteMany({});
    await User.deleteMany({
      email: { $in: ["creator@example.com", "admin@example.com"] },
    });

    // Create creator user using TestUserFactory
    const creator = await TestUserFactory.creator({
      email: "creator@example.com",
      profile: {
        firstName: "Test",
        lastName: "User",
        username: "creator",
        avatar: "",
        bio: "",
        location: "",
        website: "",
        socialLinks: {},
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: false,
          showContributions: true,
        },
        preferences: { language: "en", timezone: "UTC", theme: "SYSTEM" },
      },
      stats: {},
    });

    creatorToken = creator.token;
    creatorId = creator.user._id;

    // Create validated project owned by creator
    const project = await Project.create({
      title: "Test Project",
      description: "A project for testing",
      category: "Test",
      status: ProjectStatus.VALIDATED,
      owner: { type: creatorId },
      funding: {
        goal: 1000,
        raised: 0,
        currency: "USD",
        endDate: new Date(Date.now() + 86400000),
        contributors: [],
      },
      voting: {
        startDate: new Date(),
        endDate: new Date(),
        totalVotes: 0,
        positiveVotes: 0,
        negativeVotes: 0,
        voters: [],
      },
      milestones: [],
      team: [],
      media: { banner: "", logo: "" },
      documents: {
        whitepaper: "https://example.com/whitepaper.pdf",
        pitchDeck: "",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      type: "crowdfund",
      votes: 0,
    });

    projectId = project._id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should return 400 if required fields are missing", async () => {
    const res = await request(app)
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it("should create a campaign and milestones for valid input", async () => {
    const res = await request(app)
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        projectId: projectId.toString(),
        goalAmount: 5000,
        deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        milestones: [
          { title: "Milestone 1", description: "First milestone" },
          { title: "Milestone 2", description: "Second milestone" },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.campaign).toBeDefined();
    expect(res.body.campaign.status).toBe("pending_approval");
  });

  it("should only allow admins to approve a campaign", async () => {
    // Create a campaign in pending_approval status
    const campaignRes = await request(app)
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        projectId: projectId.toString(),
        goalAmount: 8000,
        deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
        milestones: [{ title: "Milestone A", description: "A" }],
      });
    const campaignId = campaignRes.body.campaign._id;
    // Try to approve as creator (should fail)
    const failRes = await request(app)
      .patch(`/api/campaigns/${campaignId}/approve`)
      .set("Authorization", `Bearer ${creatorToken}`);
    expect(failRes.status).toBe(403);
    // Create admin user and login
    const admin = await TestUserFactory.admin({
      email: "admin@example.com",
      profile: {
        firstName: "Admin",
        lastName: "User",
        username: "admin",
        avatar: "",
        bio: "",
        location: "",
        website: "",
        socialLinks: {},
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: false,
          showContributions: true,
        },
        preferences: { language: "en", timezone: "UTC", theme: "SYSTEM" },
      },
      stats: {},
    });
    // Approve as admin
    const approveRes = await request(app)
      .patch(`/api/campaigns/${campaignId}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.campaign.status).toBe("live");
    expect(approveRes.body.campaign.smartContractAddress).toBeDefined();
  });
});
