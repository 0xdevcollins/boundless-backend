import request from "supertest";
import mongoose from "mongoose";
import app from "../app";
import User, { UserRole, UserStatus } from "../models/user.model";
import Grant from "../models/grant.model";
import { TestUserFactory, cleanupTestData } from "./testHelpers";

describe("Grant Status Update API", () => {
  let creatorUser: any;
  let otherCreatorUser: any;
  let regularUser: any;
  let creatorToken: string;
  let otherCreatorToken: string;
  let regularToken: string;
  let testGrant: any;

  const validGrantData = {
    title: "Test Grant Program",
    description: "A test grant program for testing purposes",
    totalBudget: 10000,
    rules: "1. Must be a test project\n2. Must follow test guidelines",
    milestones: [
      {
        title: "Test Milestone 1",
        description: "First test milestone",
        expectedPayout: 5000,
      },
      {
        title: "Test Milestone 2",
        description: "Second test milestone",
        expectedPayout: 5000,
      },
    ],
  };

  beforeEach(async () => {
    // Clean up any existing data before each test
    await Grant.deleteMany({});
    await User.deleteMany({
      email: {
        $in: ["creator@test.com", "othercreator@test.com", "regular@test.com"],
      },
    });

    // Create test users using the helper
    const creator = await TestUserFactory.creator({
      email: "creator@test.com",
      profile: {
        firstName: "John",
        lastName: "Creator",
        username: "johndoe",
        avatar: "https://example.com/avatar.jpg",
        bio: "Grant Creator",
        location: "New York",
        website: "https://johndoe.com",
        socialLinks: {
          twitter: "https://twitter.com/johndoe",
        },
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: true,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "America/New_York",
          theme: "LIGHT",
        },
      },
      stats: {
        projectsCreated: 0,
        projectsFunded: 0,
        totalContributed: 0,
        reputation: 85,
        communityScore: 90,
      },
    });

    const otherCreator = await TestUserFactory.creator({
      email: "othercreator@test.com",
      profile: {
        firstName: "Jane",
        lastName: "OtherCreator",
        username: "janeother",
        avatar: "https://example.com/avatar2.jpg",
        bio: "Another Grant Creator",
        location: "Los Angeles",
        website: "https://janeother.com",
        socialLinks: {
          twitter: "https://twitter.com/janeother",
        },
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: false,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "America/Los_Angeles",
          theme: "DARK",
        },
      },
      stats: {
        projectsCreated: 0,
        projectsFunded: 0,
        totalContributed: 0,
        reputation: 75,
        communityScore: 80,
      },
    });

    const regular = await TestUserFactory.regular({
      email: "regular@test.com",
      profile: {
        firstName: "Bob",
        lastName: "Regular",
        username: "bobregular",
        avatar: "https://example.com/avatar3.jpg",
        bio: "Regular User",
        location: "Chicago",
        website: "https://bobregular.com",
        socialLinks: {
          twitter: "https://twitter.com/bobregular",
        },
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: false,
          showContributions: true,
        },
        preferences: {
          language: "en",
          timezone: "America/Chicago",
          theme: "SYSTEM",
        },
      },
      stats: {
        projectsCreated: 0,
        projectsFunded: 0,
        totalContributed: 0,
        reputation: 50,
        communityScore: 60,
      },
    });

    // Assign to variables for use in tests
    creatorUser = creator.user;
    otherCreatorUser = otherCreator.user;
    regularUser = regular.user;
    creatorToken = creator.token;
    otherCreatorToken = otherCreator.token;
    regularToken = regular.token;

    // Create a test grant
    testGrant = await Grant.create({
      ...validGrantData,
      creatorId: creatorUser._id,
      status: "draft",
    });
  });

  afterAll(async () => {
    // Clean up test data using the helper
    await cleanupTestData();
  });

  describe("PATCH /api/grants/:id/status", () => {
    describe("Authentication", () => {
      it("should return 401 when no token is provided", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .send({ status: "open" });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Authentication required");
      });

      it("should return 401 when invalid token is provided", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", "Bearer invalid-token")
          .send({ status: "open" });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });

    describe("Authorization", () => {
      it("should return 403 when non-creator user tries to update grant status", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${regularToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
          "Only the grant creator can update the grant status",
        );
      });

      it("should return 403 when different creator tries to update grant status", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${otherCreatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
          "Only the grant creator can update the grant status",
        );
      });

      it("should allow grant creator to update grant status", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Grant status updated successfully");
      });
    });

    describe("Validation", () => {
      it("should return 400 when status is missing", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.data.errors.status).toBeDefined();
      });

      it("should return 400 when status is invalid", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "invalid_status" });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.data.errors.status).toBeDefined();
      });

      it("should return 400 when status is 'draft'", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "draft" });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.data.errors.status).toBeDefined();
      });

      it("should return 400 when status is 'archived'", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "archived" });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.data.errors.status).toBeDefined();
      });

      it("should return 400 when grant ID is invalid", async () => {
        const response = await request(app)
          .patch("/api/grants/invalid-id/status")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Invalid grant ID");
      });

      it("should return 404 when grant does not exist", async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        const response = await request(app)
          .patch(`/api/grants/${nonExistentId}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Grant not found");
      });
    });

    describe("Status Transition Validation", () => {
      it("should return 400 when trying to close a draft grant", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "closed" });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.data.errors.status).toBeDefined();
      });

      it("should return 400 when trying to update archived grant", async () => {
        // First archive the grant
        await Grant.findByIdAndUpdate(testGrant._id, { status: "archived" });

        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.data.errors.status).toBeDefined();
      });
    });

    describe("Success Scenarios", () => {
      it("should successfully update grant status from draft to open", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Grant status updated successfully");
        expect(response.body.data.status).toBe("open");
        expect(response.body.data._id).toBe(testGrant._id.toString());
        expect(response.body.data.creatorId._id).toBe(
          creatorUser._id.toString(),
        );
      });

      it("should successfully update grant status from open to closed", async () => {
        // First open the grant
        await Grant.findByIdAndUpdate(testGrant._id, { status: "open" });

        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "closed" });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Grant status updated successfully");
        expect(response.body.data.status).toBe("closed");
      });

      it("should successfully update grant status from closed to open", async () => {
        // First close the grant
        await Grant.findByIdAndUpdate(testGrant._id, { status: "closed" });

        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Grant status updated successfully");
        expect(response.body.data.status).toBe("open");
      });

      it("should populate creator information in response", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(200);
        expect(response.body.data.creatorId).toBeDefined();
        expect(response.body.data.creatorId._id).toBe(
          creatorUser._id.toString(),
        );
        expect(response.body.data.creatorId.profile.firstName).toBe("John");
        expect(response.body.data.creatorId.profile.lastName).toBe("Creator");
        expect(response.body.data.creatorId.profile.username).toBe("johndoe");
      });
    });

    describe("Database Operations", () => {
      it("should persist status change in database", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(200);

        // Verify status was saved in database
        const updatedGrant = await Grant.findById(testGrant._id);
        expect(updatedGrant).toBeDefined();
        expect(updatedGrant?.status).toBe("open");
        expect(updatedGrant?.updatedAt.getTime()).toBeGreaterThan(
          testGrant.updatedAt.getTime(),
        );
      });

      it("should update the updatedAt timestamp", async () => {
        const originalUpdatedAt = testGrant.updatedAt;

        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send({ status: "open" });

        expect(response.status).toBe(200);

        const updatedGrant = await Grant.findById(testGrant._id);
        expect(updatedGrant?.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime(),
        );
      });
    });

    describe("Edge Cases", () => {
      it("should handle concurrent status updates", async () => {
        // First open the grant
        await Grant.findByIdAndUpdate(testGrant._id, { status: "open" });

        const promises = [
          request(app)
            .patch(`/api/grants/${testGrant._id}/status`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({ status: "closed" }),
          request(app)
            .patch(`/api/grants/${testGrant._id}/status`)
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({ status: "closed" }),
        ];

        const responses = await Promise.all(promises);

        // Both should succeed (idempotent operation)
        expect(responses[0].status).toBe(200);
        expect(responses[1].status).toBe(200);

        const finalGrant = await Grant.findById(testGrant._id);
        expect(finalGrant?.status).toBe("closed");
      });

      it("should handle malformed request body", async () => {
        const response = await request(app)
          .patch(`/api/grants/${testGrant._id}/status`)
          .set("Authorization", `Bearer ${creatorToken}`)
          .send("invalid json");

        expect(response.status).toBe(400);
      });
    });
  });
});
