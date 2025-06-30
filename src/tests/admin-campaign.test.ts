import request from "supertest";
import Campaign, { CampaignStatus } from "../models/campaign.model";
import Milestone, { MilestoneStatus } from "../models/milestone.model";
import Project, { ProjectStatus } from "../models/project.model";
import User, { UserRole } from "../models/user.model";
import connectDB from "../config/db";
import disconnectDB from "../config/db";
import app from "../app";
import { generateTokens } from "../utils/jwt.utils";

describe("Admin Campaign Controller", () => {
  let adminUser: any;
  let regularUser: any;
  let testProject: any;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDB();

    // Create admin user
    adminUser = await User.create({
      email: "admin@example.com",
      password: "AdminPassword123!",
      profile: {
        firstName: "Admin",
        lastName: "User",
      },
      roles: [{ role: UserRole.ADMIN }],
    });

    adminToken = generateTokens({
      userId: adminUser._id,
      email: adminUser.email,
      roles: adminUser.roles.map((role: any) => role.role),
    }).accessToken;

    // Create regular user
    regularUser = await User.create({
      email: "user@example.com",
      password: "UserPassword123!",
      profile: {
        firstName: "Regular",
        lastName: "User",
      },
      roles: [{ role: UserRole.CREATOR }],
    });

    userToken = generateTokens({
      userId: regularUser._id,
      email: regularUser.email,
      roles: regularUser.roles.map((role: any) => role.role),
    }).accessToken;

    // Create test project
    testProject = await Project.create({
      title: "Test Project",
      description: "Test project description",
      category: "Technology",
      status: ProjectStatus.VALIDATED,
      owner: { type: regularUser._id },
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

  describe("GET /api/admin/campaigns/pending", () => {
    beforeEach(async () => {
      // Create pending campaigns
      const campaign1 = await Campaign.create({
        projectId: testProject._id,
        creatorId: regularUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.PENDING_APPROVAL,
        metadata: {
          currency: "USD",
          minimumContribution: 10,
          refundPolicy: "all_or_nothing",
        },
      });

      const campaign2 = await Campaign.create({
        projectId: testProject._id,
        creatorId: regularUser._id,
        goalAmount: 5000,
        deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.PENDING_APPROVAL,
        metadata: {
          currency: "USD",
          minimumContribution: 5,
          refundPolicy: "keep_it_all",
        },
      });

      // Create milestones for campaigns
      await Milestone.create([
        {
          campaignId: campaign1._id,
          title: "Milestone 1",
          description: "First milestone",
          index: 0,
          targetAmount: 10000,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          status: MilestoneStatus.PENDING,
          metadata: {
            deliverables: ["Deliverable 1"],
            acceptanceCriteria: ["Criteria 1"],
            priority: "high",
          },
        },
        {
          campaignId: campaign2._id,
          title: "Milestone 2",
          description: "Second milestone",
          index: 0,
          targetAmount: 5000,
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          status: MilestoneStatus.PENDING,
          metadata: {
            deliverables: ["Deliverable 2"],
            acceptanceCriteria: ["Criteria 2"],
            priority: "medium",
          },
        },
      ]);
    });

    it("should get pending campaigns for admin", async () => {
      const response = await request(app)
        .get("/api/admin/campaigns/pending")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toHaveLength(2);
      expect(response.body.data.campaigns[0].milestones).toBeDefined();
      expect(response.body.data.campaigns[0].milestonesCount).toBe(1);
    });

    it("should fail for non-admin users", async () => {
      const response = await request(app)
        .get("/api/admin/campaigns/pending")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/admin/campaigns/pending")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toHaveLength(1);
      expect(response.body.data.pagination.totalItems).toBe(2);
    });
  });

  describe("POST /api/admin/campaigns/:id/review", () => {
    let testCampaign: any;

    beforeEach(async () => {
      testCampaign = await Campaign.create({
        projectId: testProject._id,
        creatorId: regularUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.PENDING_APPROVAL,
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

    it("should approve campaign successfully", async () => {
      const reviewData = {
        approved: true,
        deployToContract: false, // Skip contract deployment for test
      };

      const response = await request(app)
        .post(`/api/admin/campaigns/${testCampaign._id}/review`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(reviewData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(CampaignStatus.LIVE);
      expect(response.body.data.approvedBy).toBe(adminUser._id.toString());
      expect(response.body.data.approvedAt).toBeDefined();
    });

    it("should reject campaign with reason", async () => {
      const reviewData = {
        approved: false,
        rejectionReason: "Insufficient project documentation",
      };

      const response = await request(app)
        .post(`/api/admin/campaigns/${testCampaign._id}/review`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(reviewData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(CampaignStatus.CANCELLED);
      expect(response.body.data.rejectedReason).toBe(
        reviewData.rejectionReason,
      );
    });

    it("should fail if rejection reason is missing", async () => {
      const reviewData = {
        approved: false,
        // Missing rejectionReason
      };

      const response = await request(app)
        .post(`/api/admin/campaigns/${testCampaign._id}/review`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(reviewData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("rejection reason");
    });

    it("should fail if campaign is not pending approval", async () => {
      // Update campaign status
      await Campaign.findByIdAndUpdate(testCampaign._id, {
        status: CampaignStatus.LIVE,
      });

      const reviewData = {
        approved: true,
      };

      const response = await request(app)
        .post(`/api/admin/campaigns/${testCampaign._id}/review`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(reviewData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not pending approval");
    });

    it("should fail for non-admin users", async () => {
      const reviewData = {
        approved: true,
      };

      const response = await request(app)
        .post(`/api/admin/campaigns/${testCampaign._id}/review`)
        .set("Authorization", `Bearer ${userToken}`)
        .send(reviewData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/admin/campaigns/analytics", () => {
    beforeEach(async () => {
      // Create campaigns with different statuses
      await Campaign.create([
        {
          projectId: testProject._id,
          creatorId: regularUser._id,
          goalAmount: 10000,
          fundsRaised: 8000,
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
          creatorId: regularUser._id,
          goalAmount: 5000,
          fundsRaised: 5000,
          deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          status: CampaignStatus.FUNDED,
          metadata: {
            currency: "USD",
            minimumContribution: 5,
            refundPolicy: "keep_it_all",
          },
        },
        {
          projectId: testProject._id,
          creatorId: regularUser._id,
          goalAmount: 3000,
          deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          status: CampaignStatus.PENDING_APPROVAL,
          metadata: {
            currency: "USD",
            minimumContribution: 1,
            refundPolicy: "milestone_based",
          },
        },
      ]);
    });

    it("should get campaign analytics for admin", async () => {
      const response = await request(app)
        .get("/api/admin/campaigns/analytics")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.overview.totalCampaigns).toBe(3);
      expect(response.body.data.overview.activeCampaigns).toBe(1);
      expect(response.body.data.overview.pendingApproval).toBe(1);
      expect(response.body.data.statusStats).toBeDefined();
      expect(response.body.data.creationTrends).toBeDefined();
    });

    it("should fail for non-admin users", async () => {
      const response = await request(app)
        .get("/api/admin/campaigns/analytics")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
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
