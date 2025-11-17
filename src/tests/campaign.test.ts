import request from "supertest";
import app from "../app.js";
import mongoose from "mongoose";
import User, { UserRole, UserStatus } from "../models/user.model.js";
import Project, { ProjectStatus } from "../models/project.model.js";
import Campaign from "../models/campaign.model.js";
import Milestone from "../models/milestone.model.js";
import { TestUserFactory, cleanupTestData } from "./testHelpers.js";

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
      creator: creatorId,
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
        title: "Test Campaign",
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
        title: "Test Campaign for Approval",
        projectId: projectId.toString(),
        goalAmount: 8000,
        deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
        milestones: [{ title: "Milestone A", description: "A" }],
        stakeholders: {
          marker: "marker_address_123",
          approver: "approver_address_123",
          releaser: "releaser_address_123",
          resolver: "resolver_address_123",
          receiver: "receiver_address_123",
          platformAddress: "platform_address_123",
        },
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
  let creatorToken: string;
  let creatorId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;
  let campaignId: string;

  beforeEach(async () => {
    // Clean up any existing data
    await Campaign.deleteMany({});
    await Project.deleteMany({});
    await Milestone.deleteMany({});
    await User.deleteMany({
      email: { $in: ["creator2@example.com", "admin2@example.com"] },
    });

    // Create creator user using TestUserFactory
    const creator = await TestUserFactory.creator({
      email: "creator2@example.com",
      profile: {
        firstName: "Test2",
        lastName: "User2",
        username: "creator2",
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
      title: "Test Project 2",
      description: "A project for testing GET endpoint",
      category: "Test",
      status: ProjectStatus.VALIDATED,
      creator: creatorId, // Add creator field
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

    // Create a campaign
    const campaignRes = await request(app)
      .post("/api/campaigns")
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({
        title: "Test Campaign for Details",
        projectId: projectId.toString(),
        goalAmount: 5000,
        deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        milestones: [
          { title: "Milestone 1", description: "First milestone" },
          { title: "Milestone 2", description: "Second milestone" },
        ],
      });

    campaignId = campaignRes.body.campaign._id;

    // Approve campaign so it's live
    const admin = await TestUserFactory.admin({
      email: "admin2@example.com",
      profile: {
        firstName: "Admin2",
        lastName: "User2",
        username: "admin2",
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
    await request(app)
      .patch(`/api/campaigns/${campaignId}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);

    // Add funding
    await request(app)
      .post(`/api/campaigns/${campaignId}/back`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({ amount: 100, txHash: "0xabc" });
  });

  it("returns 400 for malformed ID", async () => {
    const res = await request(app).get("/api/campaigns/invalid-id");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid campaign ID/);
  });

  it("returns 404 for non-existent campaign", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/campaigns/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/);
  });

  it("returns full campaign details", async () => {
    const res = await request(app).get(`/api/campaigns/${campaignId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBeDefined();
    expect(Array.isArray(res.body.milestones)).toBe(true);
    expect(res.body.funding).toMatchObject({
      goal: expect.any(Number),
      raised: expect.any(Number),
      percentFunded: expect.any(Number),
    });
  });

  it("supports include=contributions", async () => {
    const res = await request(app).get(
      `/api/campaigns/${campaignId}?include=contributions`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.funding.contributions)).toBe(true);
  });

  it("supports format=minimal", async () => {
    const res = await request(app).get(
      `/api/campaigns/${campaignId}?format=minimal`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: campaignId,
      title: expect.any(String),
      status: expect.any(String),
    });
  });
});
