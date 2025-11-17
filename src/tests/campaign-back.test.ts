import request from "supertest";
import app from "../app.js";
import mongoose, { Types } from "mongoose";
import User, { UserRole, UserStatus, IUser } from "../models/user.model.js";
import Campaign, { ICampaign } from "../models/campaign.model.js";
import Funding from "../models/funding.model.js";
import { TestUserFactory, cleanupTestData } from "./testHelpers.js";

describe("POST /api/campaigns/:id/back", () => {
  let userToken: string;
  let userId: Types.ObjectId;
  let campaignId: Types.ObjectId;

  beforeEach(async () => {
    // Clean up any existing data
    await Campaign.deleteMany({});
    await Funding.deleteMany({});
    await User.deleteMany({
      email: { $in: ["backer@example.com"] },
    });

    // Create user using TestUserFactory
    const backer = await TestUserFactory.regular({
      email: "backer@example.com",
      profile: {
        firstName: "Backer",
        lastName: "User",
        username: "backer",
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

    userToken = backer.token;
    userId = backer.user._id;

    // Create a campaign
    const campaign = await Campaign.create({
      title: "Test Campaign for Backing",
      projectId: new mongoose.Types.ObjectId(),
      creatorId: new mongoose.Types.ObjectId(),
      goalAmount: 1000,
      deadline: new Date(Date.now() + 86400000),
      fundsRaised: 0,
      status: "live",
      createdAt: new Date(),
    });
    campaignId = campaign._id as Types.ObjectId;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should require authentication", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/back`)
      .send({ amount: 100, txHash: "soroban_tx_123" });
    expect(res.status).toBe(401);
  });

  it("should validate input", async () => {
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/back`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: -10, txHash: "" });
    expect(res.status).toBe(400);
  });

  it("should log funding and update campaign funds", async () => {
    const amount = 150;
    const txHash = "soroban_tx_456";
    const res = await request(app)
      .post(`/api/campaigns/${campaignId}/back`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount, txHash });
    expect(res.status).toBe(201);
    expect(res.body.funding).toBeDefined();
    expect(res.body.funding.txHash).toBe(txHash);
    expect(res.body.funding.amount).toBe(amount);
    expect(res.body.campaign.fundsRaised).toBe(amount);
    // Do another funding to check accumulation
    const res2 = await request(app)
      .post(`/api/campaigns/${campaignId}/back`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 50, txHash: "soroban_tx_789" });
    expect(res2.status).toBe(201);
    expect(res2.body.campaign.fundsRaised).toBe(amount + 50);
  });
});
