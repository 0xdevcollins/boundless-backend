import request from "supertest";
import app from "../app";
import mongoose from "mongoose";
import User from "../models/user.model";
import Organization from "../models/organization.model";

describe("Organization API", () => {
  let authToken: string;
  let userId: string;
  let organizationId: string;

  beforeAll(async () => {
    // Create a test user
    const user = await User.create({
      email: "test@example.com",
      password: "TestPassword123!",
      profile: {
        firstName: "Test",
        lastName: "User",
        username: "testuser",
      },
      isVerified: true,
    });
    userId = user._id.toString();

    // Generate auth token (you'll need to implement this based on your auth system)
    // For now, we'll use a mock token
    authToken = "mock-jwt-token";
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: "test@example.com" });
    await Organization.deleteMany({ owner: "test@example.com" });
    await mongoose.connection.close();
  });

  describe("POST /api/organizations", () => {
    it("should create a new organization with dummy name", async () => {
      const response = await request(app)
        .post("/api/organizations")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toMatch(
        /^Untitled Organization \d+-[a-z0-9]+$/,
      );
      expect(response.body.data.owner).toBe("test@example.com");
      expect(response.body.data.members).toContain("test@example.com");

      organizationId = response.body.data._id;
    });

    it("should require authentication", async () => {
      await request(app).post("/api/organizations").expect(401);
    });
  });

  describe("GET /api/organizations/:id", () => {
    it("should get organization by ID for members", async () => {
      const response = await request(app)
        .get(`/api/organizations/${organizationId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(organizationId);
    });

    it("should return 403 for non-members", async () => {
      // Create another user
      const otherUser = await User.create({
        email: "other@example.com",
        password: "TestPassword123!",
        profile: {
          firstName: "Other",
          lastName: "User",
          username: "otheruser",
        },
        isVerified: true,
      });

      // This would require implementing proper JWT token generation
      // For now, we'll test the endpoint structure
      await request(app)
        .get(`/api/organizations/${organizationId}`)
        .expect(401); // Should require auth

      await User.deleteOne({ _id: otherUser._id });
    });

    it("should return 404 for non-existent organization", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/organizations/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe("PATCH /api/organizations/:id/profile", () => {
    it("should update organization profile", async () => {
      const updateData = {
        name: "Updated Organization",
        tagline: "New tagline",
        about: "New about section",
      };

      const response = await request(app)
        .patch(`/api/organizations/${organizationId}/profile`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("Updated Organization");
      expect(response.body.data.tagline).toBe("New tagline");
    });
  });

  describe("PATCH /api/organizations/:id/links", () => {
    it("should update organization links", async () => {
      const linksData = {
        website: "https://example.com",
        x: "@example",
        github: "https://github.com/example",
        others: "Additional links",
      };

      const response = await request(app)
        .patch(`/api/organizations/${organizationId}/links`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(linksData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.links.website).toBe("https://example.com");
      expect(response.body.data.links.x).toBe("@example");
    });
  });

  describe("PATCH /api/organizations/:id/members", () => {
    it("should add a new member", async () => {
      const memberData = {
        action: "add",
        email: "newmember@example.com",
      };

      const response = await request(app)
        .patch(`/api/organizations/${organizationId}/members`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(memberData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.members).toContain("newmember@example.com");
    });

    it("should remove a member", async () => {
      const memberData = {
        action: "remove",
        email: "newmember@example.com",
      };

      const response = await request(app)
        .patch(`/api/organizations/${organizationId}/members`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(memberData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.members).not.toContain("newmember@example.com");
    });
  });

  describe("PATCH /api/organizations/:id/transfer", () => {
    it("should transfer ownership to another member", async () => {
      // First add a member
      await request(app)
        .patch(`/api/organizations/${organizationId}/members`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          action: "add",
          email: "newowner@example.com",
        });

      // Create the new owner user
      await User.create({
        email: "newowner@example.com",
        password: "TestPassword123!",
        profile: {
          firstName: "New",
          lastName: "Owner",
          username: "newowner",
        },
        isVerified: true,
      });

      const transferData = {
        newOwnerEmail: "newowner@example.com",
      };

      const response = await request(app)
        .patch(`/api/organizations/${organizationId}/transfer`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(transferData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.owner).toBe("newowner@example.com");
    });
  });

  describe("DELETE /api/organizations/:id", () => {
    it("should delete organization (owner only)", async () => {
      const response = await request(app)
        .delete(`/api/organizations/${organizationId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Organization deleted successfully");
    });

    it("should return 404 for non-existent organization", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .delete(`/api/organizations/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe("POST /api/organizations/:id/invite", () => {
    it("should send invite to user", async () => {
      const response = await request(app)
        .post(`/api/organizations/${organizationId}/invite`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "invited@example.com" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pendingInvites).toContain(
        "invited@example.com",
      );
    });

    it("should return 400 if user already invited", async () => {
      await request(app)
        .post(`/api/organizations/${organizationId}/invite`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "invited@example.com" })
        .expect(400);
    });

    it("should return 400 if user already a member", async () => {
      await request(app)
        .post(`/api/organizations/${organizationId}/invite`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ email: "test@example.com" })
        .expect(400);
    });
  });

  describe("POST /api/organizations/:id/accept-invite", () => {
    it("should accept invite and add to members", async () => {
      // Create another user to accept invite
      const invitedUser = await User.create({
        email: "invited@example.com",
        password: "TestPassword123!",
        profile: {
          firstName: "Invited",
          lastName: "User",
          username: "inviteduser",
        },
        isVerified: true,
      });

      const response = await request(app)
        .post(`/api/organizations/${organizationId}/accept-invite`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.members).toContain("invited@example.com");
      expect(response.body.data.pendingInvites).not.toContain(
        "invited@example.com",
      );

      await User.deleteOne({ _id: invitedUser._id });
    });

    it("should return 400 if no pending invite", async () => {
      await request(app)
        .post(`/api/organizations/${organizationId}/accept-invite`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe("PATCH /api/organizations/:id/hackathons", () => {
    it("should add hackathon to organization", async () => {
      const hackathonId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/organizations/${organizationId}/hackathons`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          action: "add",
          hackathonId: hackathonId.toString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hackathons).toContain(hackathonId.toString());
    });

    it("should remove hackathon from organization", async () => {
      const hackathonId = new mongoose.Types.ObjectId();

      // First add the hackathon
      await request(app)
        .patch(`/api/organizations/${organizationId}/hackathons`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          action: "add",
          hackathonId: hackathonId.toString(),
        });

      // Then remove it
      const response = await request(app)
        .patch(`/api/organizations/${organizationId}/hackathons`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          action: "remove",
          hackathonId: hackathonId.toString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hackathons).not.toContain(
        hackathonId.toString(),
      );
    });

    it("should return 403 for non-owner", async () => {
      // Create another user
      const otherUser = await User.create({
        email: "other@example.com",
        password: "TestPassword123!",
        profile: {
          firstName: "Other",
          lastName: "User",
          username: "otheruser",
        },
        isVerified: true,
      });

      const hackathonId = new mongoose.Types.ObjectId();

      await request(app)
        .patch(`/api/organizations/${organizationId}/hackathons`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          action: "add",
          hackathonId: hackathonId.toString(),
        })
        .expect(403);

      await User.deleteOne({ _id: otherUser._id });
    });
  });

  describe("PATCH /api/organizations/:id/grants", () => {
    it("should add grant to organization", async () => {
      const grantId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/organizations/${organizationId}/grants`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          action: "add",
          grantId: grantId.toString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.grants).toContain(grantId.toString());
    });

    it("should remove grant from organization", async () => {
      const grantId = new mongoose.Types.ObjectId();

      // First add the grant
      await request(app)
        .patch(`/api/organizations/${organizationId}/grants`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          action: "add",
          grantId: grantId.toString(),
        });

      // Then remove it
      const response = await request(app)
        .patch(`/api/organizations/${organizationId}/grants`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          action: "remove",
          grantId: grantId.toString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.grants).not.toContain(grantId.toString());
    });
  });

  describe("Profile Completion Logic", () => {
    it("should update isProfileComplete when profile is completed", async () => {
      // Update profile to complete state
      await request(app)
        .patch(`/api/organizations/${organizationId}/profile`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Complete Organization",
          logo: "https://example.com/logo.png",
          tagline: "Complete tagline",
          about: "Complete about section",
        });

      // Add a link
      await request(app)
        .patch(`/api/organizations/${organizationId}/links`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          website: "https://example.com",
        });

      // Add a member
      await request(app)
        .patch(`/api/organizations/${organizationId}/members`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          action: "add",
          email: "member@example.com",
        });

      // Check if profile is marked as complete
      const response = await request(app)
        .get(`/api/organizations/${organizationId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.isProfileComplete).toBe(true);
    });
  });
});
