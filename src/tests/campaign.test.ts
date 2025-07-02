import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import User, { UserRole, UserStatus } from "../models/user.model";
import Project, { ProjectStatus } from "../models/project.model";
import Campaign from "../models/campaign.model";
import Milestone from "../models/milestone.model";

// Helper to register and login a user
async function createAndLoginUser(
  email: string,
  password: string,
  role: UserRole,
) {
  // Create user directly in DB with the specified role
  const user = await User.create({
    email,
    password, // Assume pre-save hook hashes this
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
  // Login to get JWT
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  return { user, token: res.body.accessToken };
}

describe("POST /api/campaigns", () => {
  let creatorToken: string;
  let creatorId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Connect to test DB if not already
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || "", {});
    }
    // Create creator user and login
    const email = "creator@example.com";
    const password = "TestPass123!";
    const { user, token } = await createAndLoginUser(
      email,
      password,
      UserRole.CREATOR,
    );
    creatorToken = token;
    creatorId = user._id;
    // Create validated project owned by creator
    const project = await Project.create({
      title: "Test Project",
      description: "A project for testing",
      category: "Test",
      status: ProjectStatus.VALIDATED,
      owner: creatorId,
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
      documents: { whitepaper: "", pitchDeck: "" },
      createdAt: new Date(),
      updatedAt: new Date(),
      type: "crowdfund",
      votes: 0,
    });
    projectId = project._id;
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Project.deleteMany({});
    await Campaign.deleteMany({});
    await Milestone.deleteMany({});
    await mongoose.connection.close();
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
    const adminEmail = "admin@example.com";
    const adminPassword = "AdminPass123!";
    const { token: adminToken } = await createAndLoginUser(
      adminEmail,
      adminPassword,
      UserRole.ADMIN,
    );
    // Approve as admin
    const approveRes = await request(app)
      .patch(`/api/campaigns/${campaignId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.campaign.status).toBe("live");
    expect(approveRes.body.campaign.smartContractAddress).toBeDefined();
  });
});
