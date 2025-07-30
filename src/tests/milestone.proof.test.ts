import mongoose, { Document } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import Milestone, { IMilestone } from "../models/milestone.model";
import Campaign, { ICampaign } from "../models/campaign.model";
import User, { IUser } from "../models/user.model";
import { Request, Response, NextFunction } from "express";

declare global {
  var __testUserId: string;
}

// Mock authentication middleware for testing
jest.mock("../middleware/auth", () => ({
  protect: (req: Request, res: Response, next: NextFunction) => {
    req.user = {
      _id: new mongoose.Types.ObjectId(global.__testUserId),
      id: global.__testUserId,
      email: "test@example.com",
      password: "password",
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    next();
  },
}));

jest.setTimeout(30000);

describe("POST /api/milestones/:milestoneId/proof", () => {
  let user: IUser & Document;
  let campaign: ICampaign & Document;
  let milestone: IMilestone & Document;
  let mongoServer: MongoMemoryServer;
  let app: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Ensure existing connections are closed before connecting
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(mongoUri, { dbName: "test" });

    // Import the app AFTER the database connection is established
    const appModule = await import("../app");
    app = appModule.default;
  }, 30000);

  beforeEach(async () => {
    // Clear data before each test to ensure isolation
    await User.deleteMany({});
    await Campaign.deleteMany({});
    await Milestone.deleteMany({});

    user = await User.create({
      email: "test@example.com",
      password: "password",
      profile: {
        username: "testuser",
        firstName: "Test",
        lastName: "User",
      },
    });
    global.__testUserId = user._id.toString();

    campaign = (await Campaign.create({
      projectId: new mongoose.Types.ObjectId(),
      creatorId: user._id,
      goalAmount: 1000,
      deadline: new Date(Date.now() + 1000000),
      fundsRaised: 0,
      status: "live",
      createdAt: new Date(),
    })) as ICampaign & Document;

    // Verify campaign exists
    const savedCampaign = await Campaign.findById(campaign._id);
    if (!savedCampaign) {
      throw new Error("Campaign not found after creation");
    }

    milestone = await Milestone.create({
      campaignId: campaign._id,
      title: "Test Milestone",
      description: "Test milestone description",
      index: 1,
      status: "pending",
    });
  });

  afterAll(async () => {
    // Clean up after all tests
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it("should submit proof successfully", async () => {
    const res = await request(app)
      .post(`/api/milestones/${milestone._id}/proof`)
      .send({
        description: "Completed all deliverables",
        proofLinks: [
          "https://github.com/example/repo",
          "https://demo.example.com",
        ],
      });
    console.log("response body:", res.body);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.milestone.status).toBe("submitted");
    expect(res.body.data.milestone.proofLinks.length).toBe(2);
  });

  it("should fail with invalid milestoneId", async () => {
    const res = await request(app)
      .post("/api/milestones/invalidid/proof")
      .send({ description: "desc", proofLinks: ["https://a.com"] });
    expect(res.status).toBe(400);
  });

  it("should fail with missing description", async () => {
    const res = await request(app)
      .post(`/api/milestones/${milestone._id}/proof`)
      .send({ proofLinks: ["https://a.com"] });
    expect(res.status).toBe(400);
  });

  it("should fail with invalid proofLinks", async () => {
    const res = await request(app)
      .post(`/api/milestones/${milestone._id}/proof`)
      .send({ description: "desc", proofLinks: ["not-a-url"] });
    expect(res.status).toBe(400);
  });

  it("should fail if not authorized", async () => {
    const otherUser: IUser & Document = await User.create({
      email: "other@example.com",
      password: "password",
      profile: {
        username: "otheruser",
        firstName: "Other",
        lastName: "User",
      },
    });
    const otherCampaign: ICampaign & Document = (await Campaign.create({
      projectId: new mongoose.Types.ObjectId(),
      creatorId: otherUser._id,
      goalAmount: 1000,
      deadline: new Date(Date.now() + 1000000),
      fundsRaised: 0,
      status: "live",
      createdAt: new Date(),
    })) as ICampaign & Document;

    const otherMilestone: IMilestone & Document = await Milestone.create({
      campaignId: otherCampaign._id,
      title: "Other Milestone",
      description: "desc",
      index: 2,
      status: "pending",
    });

    const res = await request(app)
      .post(`/api/milestones/${otherMilestone._id}/proof`)
      .send({ description: "desc", proofLinks: ["https://a.com"] });

    expect(res.status).toBe(403);
  });

  it("should fail if milestone not in submittable state", async () => {
    await milestone.updateOne({ status: "approved" }); // Update to approved in the database
    const res = await request(app)
      .post(`/api/milestones/${milestone._id}/proof`)
      .send({ description: "desc", proofLinks: ["https://a.com"] });
    expect(res.status).toBe(409);
  });
});
