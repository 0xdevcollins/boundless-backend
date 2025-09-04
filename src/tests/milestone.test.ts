import request from "supertest";
import app from "../app";
import mongoose, { Types } from "mongoose";
import Milestone, { IMilestone } from "../models/milestone.model";
import Campaign, { ICampaign } from "../models/campaign.model";
import User, { IUser } from "../models/user.model";
import jwt from "jsonwebtoken";

// Mock Trustless Work service
jest.mock("../services/trustless-work.service", () => ({
  releaseFundsToMilestone: jest
    .fn()
    .mockResolvedValue({ success: true, txHash: "0xMOCKTX" }),
  markMilestoneApproved: jest.fn().mockResolvedValue({ success: true }),
  disputeMilestone: jest.fn().mockResolvedValue({ success: true }),
}));

type RoleAssignment = {
  role: string;
  grantedAt: Date;
  grantedBy: { type: Types.ObjectId; ref: "User" };
  status: "ACTIVE" | "REVOKED";
};

describe("Milestone Status Update API", () => {
  let adminToken: string;
  let markerToken: string;
  let creatorToken: string;
  let campaign: ICampaign;
  let milestone: IMilestone;
  let admin: IUser, marker: IUser, creator: IUser;

  beforeAll(async () => {
    await mongoose.connect(
      process.env.MONGODB_URL_TEST ||
        "mongodb://localhost:27017/boundless-test",
    );

    // Create users
    admin = await User.create({
      email: "admin@example.com",
      password: "adminpass",
      roles: [
        {
          role: "admin",
          grantedAt: new Date(),
          grantedBy: { type: new Types.ObjectId(), ref: "User" },
          status: "ACTIVE",
        } as RoleAssignment,
      ],
      isVerified: true,
      profile: {},
      settings: {},
    });
    marker = await User.create({
      email: "marker@example.com",
      password: "markerpass",
      roles: [
        {
          role: "marker",
          grantedAt: new Date(),
          grantedBy: { type: new Types.ObjectId(), ref: "User" },
          status: "ACTIVE",
        } as RoleAssignment,
      ],
      isVerified: true,
      profile: {},
      settings: {},
    });
    creator = await User.create({
      email: "creator@example.com",
      password: "creatorpass",
      roles: [
        {
          role: "creator",
          grantedAt: new Date(),
          grantedBy: { type: new Types.ObjectId(), ref: "User" },
          status: "ACTIVE",
        } as RoleAssignment,
      ],
      isVerified: true,
      profile: {},
      settings: {},
    });

    // Generate JWTs
    function signToken(user: IUser): string {
      return jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          roles: user.roles,
        },
        process.env.JWT_SECRET || "devsecret",
        { expiresIn: "1h" },
      );
    }

    adminToken = signToken(admin);
    markerToken = signToken(marker);
    creatorToken = signToken(creator);

    // Create campaign
    campaign = (await Campaign.create({
      title: "Test Campaign",
      projectId: new Types.ObjectId(),
      creatorId: creator._id,
      marker: marker._id,
      currency: "USD",
      goalAmount: 1000,
      deadline: new Date(Date.now() + 7 * 86400000),
      fundsRaised: 0,
      status: "live",
    })) as ICampaign;

    // Create a pending milestone
    milestone = (await Milestone.create({
      campaignId: campaign._id,
      title: "Initial milestone",
      description: "test",
      index: 0,
      status: "pending",
      payoutPercent: 50,
    })) as IMilestone;
  });

  afterAll(async () => {
    await Milestone.deleteMany({});
    await Campaign.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  it("should allow marker to approve a pending milestone", async () => {
    milestone.status = "pending";
    await milestone.save();
    const res = await request(app)
      .patch(
        `/api/campaigns/${campaign._id}/milestones/${milestone._id}/status`,
      )
      .set("Authorization", `Bearer ${markerToken}`)
      .send({ status: "approved" });
    expect(res.status).toBe(200);
    expect(res.body.milestone.status).toBe("approved");
  });

  it("should allow admin to release an approved milestone", async () => {
    milestone.status = "approved";
    await milestone.save();
    const res = await request(app)
      .patch(
        `/api/campaigns/${campaign._id}/milestones/${milestone._id}/status`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "released" });
    expect(res.status).toBe(200);
    expect(res.body.milestone.status).toBe("released");
    expect(res.body.milestone.releaseTxHash).toBeDefined();
  });

  it("should allow creator to dispute an approved milestone", async () => {
    milestone.status = "approved";
    await milestone.save();
    const res = await request(app)
      .patch(
        `/api/campaigns/${campaign._id}/milestones/${milestone._id}/status`,
      )
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({ status: "disputed", disputeReason: "Work not as agreed" });
    expect(res.status).toBe(200);
    expect(res.body.milestone.status).toBe("disputed");
    expect(res.body.milestone.disputeReason).toBe("Work not as agreed");
  });

  it("should not allow marker to release a milestone", async () => {
    milestone.status = "approved";
    await milestone.save();
    const res = await request(app)
      .patch(
        `/api/campaigns/${campaign._id}/milestones/${milestone._id}/status`,
      )
      .set("Authorization", `Bearer ${markerToken}`)
      .send({ status: "released" });
    expect(res.status).toBe(400);
  });

  it("should return 400 for invalid status transition", async () => {
    milestone.status = "released";
    await milestone.save();
    const res = await request(app)
      .patch(
        `/api/campaigns/${campaign._id}/milestones/${milestone._id}/status`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" });
    expect(res.status).toBe(400);
  });

  it("should return 401 for unauthorized user", async () => {
    const res = await request(app)
      .patch(
        `/api/campaigns/${campaign._id}/milestones/${milestone._id}/status`,
      )
      .send({ status: "approved" });
    expect(res.status).toBe(401); // Not authenticated
  });

  it("should return 502 if Trustless Work API fails", async () => {
    const {
      markMilestoneApproved,
    } = require("../services/trustless-work.service");
    markMilestoneApproved.mockRejectedValueOnce(new Error("fail"));
    milestone.status = "pending";
    await milestone.save();
    const res = await request(app)
      .patch(
        `/api/campaigns/${campaign._id}/milestones/${milestone._id}/status`,
      )
      .set("Authorization", `Bearer ${markerToken}`)
      .send({ status: "approved" });
    expect(res.status).toBe(502);
  });
});
