import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import Milestone from "../models/milestone.model";
import Campaign from "../models/campaign.model";
import User from "../models/user.model";

// Mock Trustless Work service
jest.mock("../services/trustless-work.service", () => ({
  trustlessWorkAction: jest
    .fn()
    .mockResolvedValue({ success: true, txHash: "0xMOCK" }),
}));

let adminToken: string, markerToken: string, creatorToken: string;
let campaignId: string,
  milestoneId: string,
  markerId: string,
  creatorId: string;

beforeAll(async () => {
  // Create admin user
  const adminRes = await request(app)
    .post("/api/auth/register")
    .send({ email: "admin@example.com", password: "password", role: "ADMIN" });
  adminToken = String(adminRes.body.token);
  const adminUser = await User.findOne({ email: "admin@example.com" });

  // Create marker user
  const markerRes = await request(app).post("/api/auth/register").send({
    email: "marker@example.com",
    password: "password",
    role: "MARKER",
  });
  markerToken = String(markerRes.body.token);
  const markerUser = await User.findOne({ email: "marker@example.com" });
  if (!markerUser) throw new Error("Marker user not found");
  markerId = markerUser._id.toString();

  // Create creator user
  const creatorRes = await request(app).post("/api/auth/register").send({
    email: "creator@example.com",
    password: "password",
    role: "CREATOR",
  });
  creatorToken = String(creatorRes.body.token);
  const creatorUser = await User.findOne({ email: "creator@example.com" });
  if (!creatorUser) throw new Error("Creator user not found");
  creatorId = creatorUser._id.toString();

  // Create campaign with creator as owner
  const campaign = await Campaign.create({
    title: "Test Campaign",
    creatorId: creatorId,
    status: "live",
  });
  campaignId =
    campaign._id instanceof mongoose.Types.ObjectId
      ? campaign._id.toString()
      : String(campaign._id);

  // Create milestone assigned to marker
  const milestone = await Milestone.create({
    campaignId: campaignId,
    title: "Test Milestone",
    status: "pending",
    markerId: markerId,
  });
  milestoneId =
    milestone._id instanceof mongoose.Types.ObjectId
      ? milestone._id.toString()
      : String(milestone._id);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("PATCH /api/campaigns/:id/milestones/:milestoneId/status", () => {
  it("should allow marker to approve a pending milestone", async () => {
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/milestones/${milestoneId}/status`)
      .set("Authorization", `Bearer ${markerToken}`)
      .send({ status: "approved" });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated to approved/);
  });

  it("should allow admin to release an approved milestone", async () => {
    // Set milestone to approved first
    await Milestone.findByIdAndUpdate(milestoneId, { status: "approved" });
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/milestones/${milestoneId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "released" });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated to released/);
  });

  it("should allow creator to dispute an approved milestone", async () => {
    await Milestone.findByIdAndUpdate(milestoneId, { status: "approved" });
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/milestones/${milestoneId}/status`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({ status: "disputed", disputeReason: "Unfair decision" });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated to disputed/);
  });

  it("should not allow unauthorized user to update milestone", async () => {
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/milestones/${milestoneId}/status`)
      .send({ status: "approved" });
    expect(res.status).toBe(401);
  });

  it("should return 400 for invalid status transition", async () => {
    await Milestone.findByIdAndUpdate(milestoneId, { status: "released" });
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/milestones/${milestoneId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" });
    expect(res.status).toBe(400);
  });

  it("should return 502 if Trustless Work API fails", async () => {
    const {
      trustlessWorkAction,
    } = require("../services/trustless-work.service");
    trustlessWorkAction.mockRejectedValueOnce(new Error("fail"));
    await Milestone.findByIdAndUpdate(milestoneId, { status: "pending" });
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/milestones/${milestoneId}/status`)
      .set("Authorization", `Bearer ${markerToken}`)
      .send({ status: "approved" });
    expect(res.status).toBe(502);
  });
});
