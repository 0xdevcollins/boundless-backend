import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import Milestone from "../models/milestone.model";
import Campaign from "../models/campaign.model";

// Mock Trustless Work service
jest.mock("../services/trustless-work.service", () => ({
  releaseFundsToMilestone: jest
    .fn()
    .mockResolvedValue({ success: true, txHash: "0xMOCKTX" }),
  markMilestoneApproved: jest.fn().mockResolvedValue({ success: true }),
  disputeMilestone: jest.fn().mockResolvedValue({ success: true }),
}));

describe("Milestone Status Update API", () => {
  let adminToken: string;
  let markerToken: string;
  let creatorToken: string;
  let campaign: any;
  let milestone: any;

  beforeAll(async () => {
    // Setup users, campaign, and milestone in DB
    // ... (mock user creation and JWT generation)
    // For brevity, assume tokens and objects are set up
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("should allow marker to approve a pending milestone", async () => {
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
    // Set milestone to approved first
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
    // Set milestone to approved first
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

  it("should return 403 for unauthorized user", async () => {
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
