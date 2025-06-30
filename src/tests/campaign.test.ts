import request from "supertest";
import app from "../app";
import Campaign, { CampaignStatus } from "../models/campaign.model";
import Milestone, { MilestoneStatus } from "../models/milestone.model";
import Project, { ProjectStatus } from "../models/project.model";
import User, { UserRole } from "../models/user.model";
import { generateTokens } from "../utils/jwt.utils";
import connectDB from "../config/db";
import disconnectDB from "../config/db";

describe("Campaign Controller", () => {
  let testUser: any;
  let testProject: any;
  let authToken: string;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDB();

    // Create test user
    testUser = await User.create({
      email: "test@example.com",
      password: "TestPassword123!",
      profile: {
        firstName: "Test",
        lastName: "User",
      },
      roles: [{ role: "project_creator" }],
    });

    authToken = generateTokens({
      userId: testUser._id.toString(),
      email: testUser.email,
      roles: testUser.roles.map((role: any) => role.role),
    }).accessToken;

    // Create validated test project
    testProject = await Project.create({
      title: "Test Project",
      description: "Test project description",
      category: "Technology",
      status: ProjectStatus.VALIDATED,
      owner: { type: testUser._id },
      funding: {
        goal: 10000,
        raised: 0,
        currency: "USD",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        contributors: [],
      },
      type: "crowdfund",
    });
  });

  describe("POST /api/campaigns", () => {
    const validCampaignData = {
      projectId: "",
      goalAmount: 10000,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currency: "USD",
      minimumContribution: 10,
      refundPolicy: "all_or_nothing",
      milestones: [
        {
          title: "Milestone 1",
          description: "First milestone",
          targetAmount: 5000,
          dueDate: new Date(
            Date.now() + 15 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          deliverables: ["Deliverable 1"],
          acceptanceCriteria: ["Criteria 1"],
          priority: "high",
        },
        {
          title: "Milestone 2",
          description: "Second milestone",
          targetAmount: 5000,
          dueDate: new Date(
            Date.now() + 25 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          deliverables: ["Deliverable 2"],
          acceptanceCriteria: ["Criteria 2"],
          priority: "medium",
        },
      ],
    };

    it("should create a campaign successfully", async () => {
      const campaignData = {
        ...validCampaignData,
        projectId: testProject._id.toString(),
      };

      const response = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${authToken}`)
        .send(campaignData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign).toBeDefined();
      expect(response.body.data.milestones).toHaveLength(2);
      expect(response.body.data.campaign.status).toBe(CampaignStatus.DRAFT);
    });

    it("should fail if project is not validated", async () => {
      // Update project status to draft
      await Project.findByIdAndUpdate(testProject._id, {
        status: ProjectStatus.DRAFT,
      });

      const campaignData = {
        ...validCampaignData,
        projectId: testProject._id.toString(),
      };

      const response = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${authToken}`)
        .send(campaignData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("validated");
    });

    it("should fail if user is not project owner", async () => {
      // Create another user
      const anotherUser: any = await User.create({
        email: "another@example.com",
        password: "TestPassword123!",
        roles: [{ role: "project_creator" }],
      });

      const anotherToken = generateTokens({
        userId: anotherUser._id.toString(),
        email: anotherUser.email,
        roles: anotherUser.roles.map((role: any) => role.role),
      }).accessToken;

      const campaignData = {
        ...validCampaignData,
        projectId: testProject._id.toString(),
      };

      const response = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${anotherToken}`)
        .send(campaignData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("own projects");
    });

    it("should fail if milestone amounts don't sum to goal amount", async () => {
      const campaignData = {
        ...validCampaignData,
        projectId: testProject._id.toString(),
        milestones: [
          {
            ...validCampaignData.milestones[0],
            targetAmount: 3000, // Changed from 5000
          },
          validCampaignData.milestones[1],
        ],
      };

      const response = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${authToken}`)
        .send(campaignData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("milestone target amounts");
    });

    it("should fail if deadline is too soon", async () => {
      const campaignData = {
        ...validCampaignData,
        projectId: testProject._id.toString(),
        deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
      };

      const response = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${authToken}`)
        .send(campaignData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("24 hours");
    });

    it("should fail if campaign already exists for project", async () => {
      // Create existing campaign
      await Campaign.create({
        projectId: testProject._id,
        creatorId: testUser._id,
        goalAmount: 5000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.DRAFT,
        metadata: {
          currency: "USD",
          minimumContribution: 1,
          refundPolicy: "all_or_nothing",
        },
      });

      const campaignData = {
        ...validCampaignData,
        projectId: testProject._id.toString(),
      };

      const response = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${authToken}`)
        .send(campaignData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("already exists");
    });
  });

  describe("GET /api/campaigns", () => {
    beforeEach(async () => {
      // Create test campaigns
      await Campaign.create([
        {
          projectId: testProject._id,
          creatorId: testUser._id,
          goalAmount: 10000,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: CampaignStatus.LIVE,
          metadata: {
            currency: "USD",
            minimumContribution: 10,
            refundPolicy: "all_or_nothing",
          },
        },
        {
          projectId: testProject._id,
          creatorId: testUser._id,
          goalAmount: 5000,
          deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          status: CampaignStatus.DRAFT,
          metadata: {
            currency: "USD",
            minimumContribution: 5,
            refundPolicy: "keep_it_all",
          },
        },
      ]);
    });

    it("should get all campaigns with pagination", async () => {
      const response = await request(app)
        .get("/api/campaigns")
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
    });

    it("should filter campaigns by status", async () => {
      const response = await request(app)
        .get("/api/campaigns")
        .query({ status: CampaignStatus.LIVE })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toHaveLength(1);
      expect(response.body.data.campaigns[0].status).toBe(CampaignStatus.LIVE);
    });

    it("should filter campaigns by creator", async () => {
      const response = await request(app)
        .get("/api/campaigns")
        .query({ creatorId: testUser._id.toString() })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toHaveLength(2);
    });
  });

  describe("GET /api/campaigns/:id", () => {
    let testCampaign: any;
    let testMilestones: any[];

    beforeEach(async () => {
      testCampaign = await Campaign.create({
        projectId: testProject._id,
        creatorId: testUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.LIVE,
        metadata: {
          currency: "USD",
          minimumContribution: 10,
          refundPolicy: "all_or_nothing",
        },
      });

      testMilestones = await Milestone.create([
        {
          campaignId: testCampaign._id,
          title: "Milestone 1",
          description: "First milestone",
          index: 0,
          targetAmount: 5000,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          status: MilestoneStatus.PENDING,
          metadata: {
            deliverables: ["Deliverable 1"],
            acceptanceCriteria: ["Criteria 1"],
            priority: "high",
          },
        },
        {
          campaignId: testCampaign._id,
          title: "Milestone 2",
          description: "Second milestone",
          index: 1,
          targetAmount: 5000,
          dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
          status: MilestoneStatus.PENDING,
          metadata: {
            deliverables: ["Deliverable 2"],
            acceptanceCriteria: ["Criteria 2"],
            priority: "medium",
          },
        },
      ]);
    });

    it("should get campaign by ID with milestones", async () => {
      const response = await request(app)
        .get(`/api/campaigns/${testCampaign._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign).toBeDefined();
      expect(response.body.data.milestones).toHaveLength(2);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.metrics.totalMilestones).toBe(2);
    });

    it("should return 404 for non-existent campaign", async () => {
      const nonExistentId = "507f1f77bcf86cd799439011";
      const response = await request(app)
        .get(`/api/campaigns/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });

    it("should return 400 for invalid campaign ID", async () => {
      const response = await request(app)
        .get("/api/campaigns/invalid-id")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid");
    });
  });

  describe("POST /api/campaigns/:id/submit", () => {
    let testCampaign: any;

    beforeEach(async () => {
      testCampaign = await Campaign.create({
        projectId: testProject._id,
        creatorId: testUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.DRAFT,
        metadata: {
          currency: "USD",
          minimumContribution: 10,
          refundPolicy: "all_or_nothing",
        },
      });

      // Create milestone
      await Milestone.create({
        campaignId: testCampaign._id,
        title: "Test Milestone",
        description: "Test milestone description",
        index: 0,
        targetAmount: 10000,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: MilestoneStatus.PENDING,
        metadata: {
          deliverables: ["Test deliverable"],
          acceptanceCriteria: ["Test criteria"],
          priority: "medium",
        },
      });
    });

    it("should submit campaign for approval", async () => {
      const response = await request(app)
        .post(`/api/campaigns/${testCampaign._id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(CampaignStatus.PENDING_APPROVAL);
    });

    it("should fail if campaign has no milestones", async () => {
      // Delete milestone
      await Milestone.deleteMany({ campaignId: testCampaign._id });

      const response = await request(app)
        .post(`/api/campaigns/${testCampaign._id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("milestone");
    });

    it("should fail if campaign is not in draft status", async () => {
      // Update campaign status
      await Campaign.findByIdAndUpdate(testCampaign._id, {
        status: CampaignStatus.PENDING_APPROVAL,
      });

      const response = await request(app)
        .post(`/api/campaigns/${testCampaign._id}/submit`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("draft");
    });
  });

  describe("PUT /api/campaigns/:id", () => {
    let testCampaign: any;

    beforeEach(async () => {
      testCampaign = await Campaign.create({
        projectId: testProject._id,
        creatorId: testUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.DRAFT,
        metadata: {
          currency: "USD",
          minimumContribution: 10,
          refundPolicy: "all_or_nothing",
        },
      });
    });

    it("should update campaign successfully", async () => {
      const updateData = {
        goalAmount: 15000,
        minimumContribution: 20,
      };

      const response = await request(app)
        .put(`/api/campaigns/${testCampaign._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.goalAmount).toBe(15000);
    });

    it("should fail if campaign is not in draft status", async () => {
      // Update campaign status
      await Campaign.findByIdAndUpdate(testCampaign._id, {
        status: CampaignStatus.LIVE,
      });

      const updateData = { goalAmount: 15000 };

      const response = await request(app)
        .put(`/api/campaigns/${testCampaign._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("draft");
    });
  });

  describe("DELETE /api/campaigns/:id", () => {
    let testCampaign: any;

    beforeEach(async () => {
      testCampaign = await Campaign.create({
        projectId: testProject._id,
        creatorId: testUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.DRAFT,
        metadata: {
          currency: "USD",
          minimumContribution: 10,
          refundPolicy: "all_or_nothing",
        },
      });

      // Create milestone
      await Milestone.create({
        campaignId: testCampaign._id,
        title: "Test Milestone",
        description: "Test milestone description",
        index: 0,
        targetAmount: 10000,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: MilestoneStatus.PENDING,
        metadata: {
          deliverables: ["Test deliverable"],
          acceptanceCriteria: ["Test criteria"],
          priority: "medium",
        },
      });
    });

    it("should delete campaign and associated milestones", async () => {
      const response = await request(app)
        .delete(`/api/campaigns/${testCampaign._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify campaign is deleted
      const deletedCampaign = await Campaign.findById(testCampaign._id);
      expect(deletedCampaign).toBeNull();

      // Verify milestones are deleted
      const milestones = await Milestone.find({ campaignId: testCampaign._id });
      expect(milestones).toHaveLength(0);
    });

    it("should fail if campaign is not in draft status", async () => {
      // Update campaign status
      await Campaign.findByIdAndUpdate(testCampaign._id, {
        status: CampaignStatus.LIVE,
      });

      const response = await request(app)
        .delete(`/api/campaigns/${testCampaign._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("draft");
    });
  });
});
async function clearDB() {
  await Promise.all([
    Campaign.deleteMany({}),
    Milestone.deleteMany({}),
    Project.deleteMany({}),
    User.deleteMany({}),
  ]);
}
