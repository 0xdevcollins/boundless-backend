import request from "supertest";
import mongoose from "mongoose";
import app from "../app";
import Campaign from "../models/campaign.model";
import Milestone from "../models/milestone.model";
import Project from "../models/project.model";
import User from "../models/user.model";
import { UserRole } from "../models/user.model";
import { createTrustlessWorkService } from "../services/trustless-work.service";

// Mock the Trustless Work service
jest.mock("../services/trustless-work.service");

const mockTrustlessWorkService = {
  deployMultiReleaseEscrow: jest.fn(),
  fundEscrow: jest.fn(),
  approveMilestone: jest.fn(),
  changeMilestoneStatus: jest.fn(),
  releaseMilestoneFunds: jest.fn(),
  getEscrow: jest.fn(),
  submitTransaction: jest.fn(),
  setTrustline: jest.fn(),
};

(createTrustlessWorkService as jest.Mock).mockReturnValue(
  mockTrustlessWorkService,
);

describe("Trustless Work Integration - Complete Workflow", () => {
  let adminUser: any;
  let creatorUser: any;
  let project: any;
  let campaign: any;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create test project (this will be recreated in beforeEach)
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create test users
    adminUser = await User.create({
      email: "admin@test.com",
      password: "password123",
      profile: {
        firstName: "Admin",
        lastName: "User",
        username: "admin",
      },
      roles: [{ role: UserRole.ADMIN, grantedAt: new Date() }],
      isVerified: true,
    });

    creatorUser = await User.create({
      email: "creator@test.com",
      password: "password123",
      profile: {
        firstName: "Creator",
        lastName: "User",
        username: "creator",
      },
      roles: [{ role: UserRole.CREATOR, grantedAt: new Date() }],
      isVerified: true,
    });

    // Create test project
    project = await Project.create({
      title: "Test Project",
      description: "A test project for Trustless Work integration",
      category: "Technology",
      status: "validated",
      creator: creatorUser._id,
      owner: { type: creatorUser._id },
      funding: {
        goal: 10000,
        raised: 0,
        currency: "USDC",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      type: "crowdfund",
    });

    // Login to get auth tokens
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "creator@test.com",
      password: "password123",
    });

    console.log("Creator login response:", loginResponse.body);
    console.log("Creator login status:", loginResponse.status);

    authToken =
      loginResponse.body.data?.accessToken ||
      loginResponse.body.accessToken ||
      loginResponse.body.token;

    const adminLoginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "password123",
    });

    console.log("Admin login response:", adminLoginResponse.body);
    console.log("Admin login status:", adminLoginResponse.status);

    adminToken =
      adminLoginResponse.body.data?.accessToken ||
      adminLoginResponse.body.accessToken ||
      adminLoginResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await Campaign.deleteMany({});
    await Milestone.deleteMany({});
  });

  describe("Campaign Creation with Trustless Work", () => {
    it("should create a campaign with valid stakeholders and milestones", async () => {
      const campaignData = {
        projectId: project._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: "USDC",
        stakeholders: {
          marker: creatorUser._id.toString(),
          approver: creatorUser._id.toString(),
          releaser: creatorUser._id.toString(),
          resolver: creatorUser._id.toString(),
          receiver: creatorUser._id.toString(),
          platformAddress: "platform_address_123",
        },
        milestones: [
          {
            title: "Phase 1: Research",
            description: "Complete initial research and planning",
            payoutPercentage: 30,
          },
          {
            title: "Phase 2: Development",
            description: "Develop core features",
            payoutPercentage: 40,
          },
          {
            title: "Phase 3: Testing",
            description: "Test and deploy",
            payoutPercentage: 30,
          },
        ],
      };

      const response = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${authToken}`)
        .send(campaignData);

      expect(response.status).toBe(201);
      expect(response.body.campaign).toBeDefined();
      expect(response.body.campaign.stakeholders).toBeDefined();
      expect(response.body.campaign.currency).toBe("USDC");
      expect(response.body.campaign.trustlessWorkStatus).toBe("pending");

      // Verify milestones were created with payout percentages
      const milestones = await Milestone.find({
        campaignId: response.body.campaign._id,
      });
      expect(milestones).toHaveLength(3);
      expect(milestones[0].payoutPercentage).toBe(30);
      expect(milestones[1].payoutPercentage).toBe(40);
      expect(milestones[2].payoutPercentage).toBe(30);
    });

    it("should validate required stakeholders", async () => {
      const campaignData = {
        projectId: project._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stakeholders: {
          marker: "marker_address_123",
          // Missing approver
          releaser: "releaser_address_123",
          resolver: "resolver_address_123",
          receiver: "receiver_address_123",
        },
        milestones: [
          {
            title: "Phase 1",
            description: "Test milestone",
            payoutPercentage: 100,
          },
        ],
      };

      const response = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${authToken}`)
        .send(campaignData);

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain(
        "Stakeholder approver address is required.",
      );
    });

    it("should validate milestone payout percentages", async () => {
      const campaignData = {
        projectId: project._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stakeholders: {
          marker: "marker_address_123",
          approver: "approver_address_123",
          releaser: "releaser_address_123",
          resolver: "resolver_address_123",
          receiver: "receiver_address_123",
        },
        milestones: [
          {
            title: "Phase 1",
            description: "Test milestone 1",
            payoutPercentage: 50,
          },
          {
            title: "Phase 2",
            description: "Test milestone 2",
            payoutPercentage: 30,
          },
          // Total only 80%, should fail on approval
        ],
      };

      const response = await request(app)
        .post("/api/campaigns")
        .set("Authorization", `Bearer ${authToken}`)
        .send(campaignData);

      expect(response.status).toBe(201); // Should create but fail on approval
    });
  });

  describe("Campaign Approval and Escrow Deployment", () => {
    let testCampaign: any;

    beforeEach(async () => {
      // Create a test campaign
      testCampaign = await Campaign.create({
        projectId: project._id,
        creatorId: creatorUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "pending_approval",
        currency: "USDC",
        stakeholders: {
          marker: creatorUser._id.toString(),
          approver: creatorUser._id.toString(),
          releaser: creatorUser._id.toString(),
          resolver: creatorUser._id.toString(),
          receiver: creatorUser._id.toString(),
        },
        trustlessWorkStatus: "pending",
        documents: {
          whitepaper: "https://example.com/whitepaper.pdf",
        },
      });

      // Create milestones
      await Milestone.create([
        {
          campaignId: testCampaign._id,
          title: "Phase 1",
          description: "Test milestone 1",
          index: 0,
          payoutPercentage: 50,
          amount: 5000,
          trustlessMilestoneIndex: 0,
        },
        {
          campaignId: testCampaign._id,
          title: "Phase 2",
          description: "Test milestone 2",
          index: 1,
          payoutPercentage: 50,
          amount: 5000,
          trustlessMilestoneIndex: 1,
        },
      ]);
    });

    it("should approve campaign and deploy escrow successfully", async () => {
      mockTrustlessWorkService.deployMultiReleaseEscrow.mockResolvedValue({
        escrowAddress: "escrow_address_123",
        xdr: "test_xdr_string",
        network: "testnet",
      });

      const response = await request(app)
        .patch(`/api/campaigns/${testCampaign._id}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.campaign.status).toBe("live");
      expect(response.body.campaign.trustlessWorkStatus).toBe("deployed");
      expect(response.body.campaign.escrowAddress).toBe("escrow_address_123");
      expect(response.body.escrowAddress).toBe("escrow_address_123");
      expect(response.body.xdr).toBe("test_xdr_string");

      // Verify Trustless Work service was called correctly
      expect(
        mockTrustlessWorkService.deployMultiReleaseEscrow,
      ).toHaveBeenCalledWith({
        engagementId: testCampaign._id.toString(),
        title: `Campaign: ${testCampaign._id}`,
        description: `Escrow for campaign ${testCampaign._id}`,
        roles: testCampaign.stakeholders,
        platformFee: 2.5,
        trustline: {
          address: expect.any(String),
          decimals: 6,
        },
        milestones: expect.arrayContaining([
          expect.objectContaining({
            description: "Test milestone 1",
            amount: 5000,
            payoutPercentage: 50,
          }),
          expect.objectContaining({
            description: "Test milestone 2",
            amount: 5000,
            payoutPercentage: 50,
          }),
        ]),
      });
    });

    it("should fallback to traditional approval if Trustless Work fails", async () => {
      mockTrustlessWorkService.deployMultiReleaseEscrow.mockRejectedValue(
        new Error("Trustless Work API unavailable"),
      );

      const response = await request(app)
        .patch(`/api/campaigns/${testCampaign._id}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.campaign.status).toBe("live");
      expect(response.body.campaign.trustlessWorkStatus).toBe("failed");
      expect(response.body.warning).toBeDefined();
    });

    it("should validate stakeholders before approval", async () => {
      // Create campaign without stakeholders but with milestones
      const campaignWithoutStakeholders = await Campaign.create({
        projectId: project._id,
        creatorId: creatorUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "pending_approval",
        currency: "USDC",
        trustlessWorkStatus: "pending",
        documents: {
          whitepaper: "https://example.com/whitepaper.pdf",
        },
      });

      // Add milestones to pass the milestone validation
      await Milestone.create([
        {
          campaignId: campaignWithoutStakeholders._id,
          title: "Phase 1",
          description: "Test milestone",
          index: 0,
          payoutPercentage: 100,
          amount: 10000,
          trustlessMilestoneIndex: 0,
        },
      ]);

      const response = await request(app)
        .patch(`/api/campaigns/${campaignWithoutStakeholders._id}/approve`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(
        "Missing required stakeholder: marker",
      );
    });
  });

  describe("Escrow Funding", () => {
    let fundedCampaign: any;

    beforeEach(async () => {
      fundedCampaign = await Campaign.create({
        projectId: project._id,
        creatorId: creatorUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "live",
        currency: "USDC",
        stakeholders: {
          marker: "marker_address_123",
          approver: "approver_address_123",
          releaser: "releaser_address_123",
          resolver: "resolver_address_123",
          receiver: "receiver_address_123",
        },
        trustlessWorkStatus: "deployed",
        escrowAddress: "escrow_address_123",
        escrowType: "multi",
      });
    });

    it("should fund escrow successfully", async () => {
      mockTrustlessWorkService.fundEscrow.mockResolvedValue({
        xdr: "fund_xdr_string",
        network: "testnet",
      });

      const response = await request(app)
        .post(`/api/campaigns/${fundedCampaign._id}/fund-escrow`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ amount: 5000 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Escrow funded successfully.");
      expect(response.body.xdr).toBe("fund_xdr_string");
      expect(response.body.campaign.trustlessWorkStatus).toBe("funded");
      expect(response.body.campaign.fundsRaised).toBe(5000);

      expect(mockTrustlessWorkService.fundEscrow).toHaveBeenCalledWith(
        "multi",
        {
          escrowAddress: "escrow_address_123",
          amount: 5000,
        },
      );
    });

    it("should handle funding failure gracefully", async () => {
      mockTrustlessWorkService.fundEscrow.mockRejectedValue(
        new Error("Funding failed"),
      );

      const response = await request(app)
        .post(`/api/campaigns/${fundedCampaign._id}/fund-escrow`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ amount: 5000 });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Failed to fund escrow.");
      expect(response.body.error).toBe("Funding failed");
    });

    it("should validate campaign status before funding", async () => {
      // Create campaign that's not deployed
      const undeployedCampaign = await Campaign.create({
        projectId: project._id,
        creatorId: creatorUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "live",
        currency: "USDC",
        stakeholders: {
          marker: "marker_address_123",
          approver: "approver_address_123",
          releaser: "releaser_address_123",
          resolver: "resolver_address_123",
          receiver: "receiver_address_123",
        },
        trustlessWorkStatus: "pending", // Not deployed
      });

      const response = await request(app)
        .post(`/api/campaigns/${undeployedCampaign._id}/fund-escrow`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ amount: 5000 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("not deployed");
    });
  });

  describe("Milestone Management", () => {
    let fundedCampaign: any;
    let milestone: any;

    beforeEach(async () => {
      fundedCampaign = await Campaign.create({
        projectId: project._id,
        creatorId: creatorUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "live",
        currency: "USDC",
        stakeholders: {
          marker: creatorUser._id.toString(),
          approver: creatorUser._id.toString(),
          releaser: creatorUser._id.toString(),
          resolver: creatorUser._id.toString(),
          receiver: creatorUser._id.toString(),
        },
        trustlessWorkStatus: "funded",
        escrowAddress: "escrow_address_123",
        escrowType: "multi",
        fundsRaised: 10000,
      });

      milestone = await Milestone.create({
        campaignId: fundedCampaign._id,
        title: "Phase 1",
        description: "Test milestone",
        index: 0,
        payoutPercentage: 50,
        amount: 5000,
        trustlessMilestoneIndex: 0,
        status: "pending",
      });
    });

    it("should mark milestone as complete", async () => {
      mockTrustlessWorkService.changeMilestoneStatus.mockResolvedValue({
        xdr: "status_xdr_string",
      });

      const response = await request(app)
        .post(`/api/campaigns/${fundedCampaign._id}/milestones/0/complete`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "Milestone marked as complete successfully.",
      );
      expect(response.body.xdr).toBe("status_xdr_string");

      expect(
        mockTrustlessWorkService.changeMilestoneStatus,
      ).toHaveBeenCalledWith("multi", {
        escrowAddress: "escrow_address_123",
        milestoneIndex: 0,
        status: "complete",
      });

      // Verify milestone status was updated
      const updatedMilestone = await Milestone.findById(milestone._id);
      expect(updatedMilestone?.status).toBe("completed");
    });

    it("should approve milestone", async () => {
      mockTrustlessWorkService.approveMilestone.mockResolvedValue({
        xdr: "approval_xdr_string",
      });

      const response = await request(app)
        .post(`/api/campaigns/${fundedCampaign._id}/milestones/0/approve`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Milestone approved successfully.");
      expect(response.body.xdr).toBe("approval_xdr_string");

      expect(mockTrustlessWorkService.approveMilestone).toHaveBeenCalledWith(
        "multi",
        {
          escrowAddress: "escrow_address_123",
          milestoneIndex: 0,
        },
      );

      // Verify milestone status was updated
      const updatedMilestone = await Milestone.findById(milestone._id);
      expect(updatedMilestone?.status).toBe("approved");
    });

    it("should release milestone funds", async () => {
      mockTrustlessWorkService.releaseMilestoneFunds.mockResolvedValue({
        xdr: "release_xdr_string",
      });

      const response = await request(app)
        .post(`/api/campaigns/${fundedCampaign._id}/milestones/0/release`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "Milestone funds released successfully.",
      );
      expect(response.body.xdr).toBe("release_xdr_string");

      expect(
        mockTrustlessWorkService.releaseMilestoneFunds,
      ).toHaveBeenCalledWith({
        escrowAddress: "escrow_address_123",
        milestoneIndex: 0,
      });
    });

    it("should handle milestone operation failures", async () => {
      mockTrustlessWorkService.changeMilestoneStatus.mockRejectedValue(
        new Error("Milestone operation failed"),
      );

      const response = await request(app)
        .post(`/api/campaigns/${fundedCampaign._id}/milestones/0/complete`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        "Failed to mark milestone as complete.",
      );
      expect(response.body.error).toBe("Milestone operation failed");
    });
  });

  describe("Escrow Details and Monitoring", () => {
    let deployedCampaign: any;

    beforeEach(async () => {
      deployedCampaign = await Campaign.create({
        projectId: project._id,
        creatorId: creatorUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "live",
        currency: "USDC",
        stakeholders: {
          marker: creatorUser._id.toString(),
          approver: creatorUser._id.toString(),
          releaser: creatorUser._id.toString(),
          resolver: creatorUser._id.toString(),
          receiver: creatorUser._id.toString(),
        },
        trustlessWorkStatus: "deployed",
        escrowAddress: "escrow_address_123",
        escrowType: "multi",
      });
    });

    it("should get escrow details successfully", async () => {
      const mockEscrowDetails = {
        escrowAddress: "escrow_address_123",
        balance: 10000,
        milestones: [
          { description: "Phase 1", amount: 5000, status: "pending" },
          { description: "Phase 2", amount: 5000, status: "pending" },
        ],
      };

      mockTrustlessWorkService.getEscrow.mockResolvedValue(mockEscrowDetails);

      const response = await request(app)
        .get(`/api/campaigns/${deployedCampaign._id}/escrow-details`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.escrowDetails).toEqual(mockEscrowDetails);
      expect(response.body.campaign).toBeDefined();

      expect(mockTrustlessWorkService.getEscrow).toHaveBeenCalledWith(
        "multi",
        "escrow_address_123",
      );
    });

    it("should handle escrow details fetch failure", async () => {
      mockTrustlessWorkService.getEscrow.mockRejectedValue(
        new Error("Failed to fetch escrow details"),
      );

      const response = await request(app)
        .get(`/api/campaigns/${deployedCampaign._id}/escrow-details`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Failed to fetch escrow details.");
      expect(response.body.error).toBe("Failed to fetch escrow details");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle invalid campaign ID", async () => {
      const response = await request(app)
        .get("/api/campaigns/invalid-id/escrow-details")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Valid campaignId is required");
    });

    it("should handle non-existent campaign", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/campaigns/${fakeId}/escrow-details`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Campaign not found.");
    });

    it("should handle invalid milestone index", async () => {
      const campaign = await Campaign.create({
        projectId: project._id,
        creatorId: creatorUser._id,
        goalAmount: 10000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "live",
        currency: "USDC",
        stakeholders: {
          marker: "marker_address_123",
          approver: "approver_address_123",
          releaser: "releaser_address_123",
          resolver: "resolver_address_123",
          receiver: "receiver_address_123",
        },
        trustlessWorkStatus: "funded",
        escrowAddress: "escrow_address_123",
        escrowType: "multi",
      });

      const response = await request(app)
        .post(`/api/campaigns/${campaign._id}/milestones/invalid/complete`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(
        "Valid milestoneIndex is required",
      );
    });
  });
});
