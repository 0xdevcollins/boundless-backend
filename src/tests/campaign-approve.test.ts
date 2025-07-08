import request from "supertest";
import app from "../app";
import mongoose, { Types } from "mongoose";
import User, { UserRole, UserStatus, IUser } from "../models/user.model";
import Campaign, { ICampaign } from "../models/campaign.model";
import Milestone from "../models/milestone.model";

async function createAndLoginUser(
  email: string,
  password: string,
  role: UserRole,
): Promise<{ user: IUser; token: string }> {
  const user = await User.create({
    email,
    password,
    isVerified: true,
    profile: {
      firstName: "Test",
      lastName: "User",
      username: email.split("@")[0],
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
    status: UserStatus.ACTIVE,
    badges: [],
    roles: [{ role, grantedAt: new Date(), grantedBy: null, status: "ACTIVE" }],
    contributedProjects: [],
    lastLogin: new Date(),
  });
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  return { user, token: res.body.data.accessToken };
}

describe("PATCH /api/campaigns/:id/approve", () => {
  let adminToken: string;
  let creatorToken: string;
  let adminId: Types.ObjectId;
  let creatorId: Types.ObjectId;
  let campaignId: Types.ObjectId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || "", {});
    }
    // Create admin and creator users
    const { user: admin, token: adminT } = await createAndLoginUser(
      "admin@example.com",
      "AdminPass123!",
      UserRole.ADMIN,
    );
    adminToken = adminT;
    adminId = admin._id;
    const { user: creator, token: creatorT } = await createAndLoginUser(
      "creator@example.com",
      "CreatorPass123!",
      UserRole.CREATOR,
    );
    creatorToken = creatorT;
    creatorId = creator._id;
    // Create a campaign (pending approval)
    const campaign = await Campaign.create({
      projectId: new mongoose.Types.ObjectId(),
      creatorId: creatorId,
      goalAmount: 1000,
      deadline: new Date(Date.now() + 86400000),
      fundsRaised: 0,
      status: "pending_approval",
      documents: { whitepaper: "whitepaper.pdf", pitchDeck: "" },
      createdAt: new Date(),
    });
    campaignId = campaign._id as Types.ObjectId;
    // Add a milestone
    await Milestone.create({
      campaignId: campaignId,
      title: "Milestone 1",
      description: "First milestone",
      index: 0,
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Campaign.deleteMany({});
    await Milestone.deleteMany({});
    await mongoose.connection.close();
  });

  it("should require authentication", async () => {
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/approve`)
      .send();
    expect(res.status).toBe(401);
  });

  it("should only allow admins to approve", async () => {
    const res = await request(app)
      .patch(`/api/campaigns/${campaignId}/approve`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send();
    expect(res.status).toBe(403);
  });

  it("should fail if no milestones", async () => {
    // Create a campaign with no milestones
    const campaign = await Campaign.create({
      projectId: new mongoose.Types.ObjectId(),
      creatorId: creatorId,
      goalAmount: 1000,
      deadline: new Date(Date.now() + 86400000),
      fundsRaised: 0,
      status: "pending_approval",
      documents: { whitepaper: "whitepaper.pdf", pitchDeck: "" },
      createdAt: new Date(),
    });
    const res = await request(app)
      .patch(`/api/campaigns/${campaign._id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/milestone/i);
  });

  it("should fail if deadline is invalid", async () => {
    // Create a campaign with past deadline
    const campaign = await Campaign.create({
      projectId: new mongoose.Types.ObjectId(),
      creatorId: creatorId,
      goalAmount: 1000,
      deadline: new Date(Date.now() - 86400000),
      fundsRaised: 0,
      status: "pending_approval",
      documents: { whitepaper: "whitepaper.pdf", pitchDeck: "" },
      createdAt: new Date(),
    });
    await Milestone.create({
      campaignId: campaign._id,
      title: "Milestone 1",
      description: "First milestone",
      index: 0,
    });
    const res = await request(app)
      .patch(`/api/campaigns/${campaign._id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/deadline/i);
  });

  it("should fail if goalAmount is invalid", async () => {
    // Create a campaign with invalid goalAmount
    const campaign = await Campaign.create({
      projectId: new mongoose.Types.ObjectId(),
      creatorId: creatorId,
      goalAmount: 0,
      deadline: new Date(Date.now() + 86400000),
      fundsRaised: 0,
      status: "pending_approval",
      documents: { whitepaper: "whitepaper.pdf", pitchDeck: "" },
      createdAt: new Date(),
    });
    await Milestone.create({
      campaignId: campaign._id,
      title: "Milestone 1",
      description: "First milestone",
      index: 0,
    });
    const res = await request(app)
      .patch(`/api/campaigns/${campaign._id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/goalAmount/i);
  });

  it("should fail if required documents are missing", async () => {
    // Create a campaign with no documents
    const campaign = await Campaign.create({
      projectId: new mongoose.Types.ObjectId(),
      creatorId: creatorId,
      goalAmount: 1000,
      deadline: new Date(Date.now() + 86400000),
      fundsRaised: 0,
      status: "pending_approval",
      documents: { whitepaper: "", pitchDeck: "" },
      createdAt: new Date(),
    });
    await Milestone.create({
      campaignId: campaign._id,
      title: "Milestone 1",
      description: "First milestone",
      index: 0,
    });
    const res = await request(app)
      .patch(`/api/campaigns/${campaign._id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/whitepaper|pitch deck/i);
  });

  it("should approve a valid campaign", async () => {
    // Create a valid campaign
    const campaign = await Campaign.create({
      projectId: new mongoose.Types.ObjectId(),
      creatorId: creatorId,
      goalAmount: 2000,
      deadline: new Date(Date.now() + 86400000),
      fundsRaised: 0,
      status: "pending_approval",
      documents: { whitepaper: "whitepaper.pdf", pitchDeck: "" },
      createdAt: new Date(),
    });
    await Milestone.create({
      campaignId: campaign._id,
      title: "Milestone 1",
      description: "First milestone",
      index: 0,
    });
    const res = await request(app)
      .patch(`/api/campaigns/${campaign._id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.campaign.status).toBe("live");
    expect(res.body.campaign.approvedBy).toBeDefined();
    expect(res.body.campaign.approvedAt).toBeDefined();
    expect(res.body.campaign.smartContractAddress).toMatch(/soroban_contract/);
  });
});
