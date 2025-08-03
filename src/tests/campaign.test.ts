import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import User, { UserRole, UserStatus } from "../models/user.model";
import Project, { ProjectStatus } from "../models/project.model";
import Campaign from "../models/campaign.model";
import Milestone from "../models/milestone.model";
import { TestUserFactory, cleanupTestData } from "./testHelpers";

// Move these to the top-level scope
let creatorToken: string;
let creatorId: mongoose.Types.ObjectId;
let projectId: mongoose.Types.ObjectId;

describe("POST /api/campaigns", () => {
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

describe("GET /api/campaigns/:id", () => {
  let campaignId: string;

  beforeEach(async () => {
    // Create a campaign for GET tests
    const campaignRes = await request(app)
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        projectId: projectId.toString(),
        goalAmount: 10000,
        deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
        milestones: [
          { title: "M1", description: "Desc1" },
          { title: "M2", description: "Desc2" },
        ],
      });
    campaignId = campaignRes.body.campaign._id;
  });

  it("should return 400 for invalid campaign ID", async () => {
    const res = await request(app).get("/api/campaigns/invalidid");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it("should return 404 for non-existent campaign", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/campaigns/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("should return full campaign details by default", async () => {
    const res = await request(app).get(`/api/campaigns/${campaignId}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBeDefined();
    expect(res.body.milestones).toBeInstanceOf(Array);
    expect(res.body.funding).toBeDefined();
    expect(res.body.timeline).toBeDefined();
    expect(res.body.trustless).toBeDefined();
  });

  it("should support minimal format", async () => {
    const res = await request(app).get(
      `/api/campaigns/${campaignId}?format=minimal`,
    );
    expect(res.status).toBe(200);
    expect(res.body.title).toBeDefined();
    expect(res.body.goalAmount).toBeDefined();
    expect(res.body.fundingProgress).toBeDefined();
    expect(res.body.milestones).toBeUndefined();
  });

  it("should expand project and creator fields", async () => {
    const res = await request(app).get(
      `/api/campaigns/${campaignId}?expand=project,creator`,
    );
    expect(res.status).toBe(200);
    expect(res.body.project).toBeDefined();
    expect(typeof res.body.project).toBe("object");
    expect(res.body.creator).toBeDefined();
    expect(typeof res.body.creator).toBe("object");
  });

  it("should include funding contributions if requested", async () => {
    // Optionally, add a funding record here if needed
    const res = await request(app).get(
      `/api/campaigns/${campaignId}?include=contributions`,
    );
    expect(res.status).toBe(200);
    expect(res.body.funding.fundingHistory).toBeInstanceOf(Array);
  });
});
