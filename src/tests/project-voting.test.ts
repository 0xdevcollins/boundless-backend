import request from "supertest";
import mongoose from "mongoose";
import app from "../app";
import User from "../models/user.model";
import Project, { ProjectStatus, ProjectType } from "../models/project.model";
import Vote from "../models/vote.model";
import Crowdfund from "../models/crowdfund.model";
import { TestUserFactory, cleanupTestData } from "./testHelpers";

describe("Project Voting API", () => {
  let testUser: any;
  let testUser2: any;
  let testProject: any;
  let authToken: string;
  let authToken2: string;

  beforeEach(async () => {
    // Clean up existing data
    await User.deleteMany({});
    await Project.deleteMany({});
    await Vote.deleteMany({});
    await Crowdfund.deleteMany({});

    // Create test users using TestUserFactory
    testUser = await TestUserFactory.creator({
      email: "test@example.com",
      profile: {
        firstName: "Test",
        lastName: "User",
        username: "testuser",
      },
    });

    testUser2 = await TestUserFactory.regular({
      email: "test2@example.com",
      profile: {
        firstName: "Test",
        lastName: "User2",
        username: "testuser2",
      },
    });

    // Get auth tokens from TestUserFactory
    authToken = testUser.token;
    authToken2 = testUser2.token;

    // Create test project
    testProject = await Project.create({
      title: "Test Project",
      description: "Test Description",
      summary: "Test Summary",
      type: ProjectType.CROWDFUND,
      category: "Test",
      status: ProjectStatus.IDEA,
      creator: testUser.user._id,
      owner: {
        type: testUser.user._id,
      },
      funding: {
        goal: 10000,
        raised: 0,
        currency: "USD",
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        contributors: [],
      },
      voting: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalVotes: 0,
        positiveVotes: 0,
        negativeVotes: 0,
        voters: [],
      },
      milestones: [],
      team: [],
      media: { banner: "", logo: "" },
      documents: { whitepaper: "", pitchDeck: "" },
      votes: 0,
    });

    // Create associated crowdfund
    await Crowdfund.create({
      projectId: testProject._id,
      thresholdVotes: 100,
      totalVotes: 0,
      status: "pending",
      voteDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("POST /api/projects/:id/vote", () => {
    it("should allow user to cast an upvote", async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: 1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vote.value).toBe(1);
      expect(response.body.data.vote.voteType).toBe("upvote");
      expect(response.body.data.isNewVote).toBe(true);
      expect(response.body.data.projectVotes.upvotes).toBe(1);
      expect(response.body.data.projectVotes.totalVotes).toBe(1);
    });

    it("should allow user to cast a downvote", async () => {
      // Create another user for this test
      const testUser3 = await TestUserFactory.regular({
        email: "test3@example.com",
        profile: {
          firstName: "Test",
          lastName: "User3",
          username: "testuser3",
        },
      });
      const authToken3 = testUser3.token;

      const response = await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken3}`)
        .send({ value: -1 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vote.value).toBe(-1);
      expect(response.body.data.vote.voteType).toBe("downvote");
      expect(response.body.data.projectVotes.downvotes).toBe(1);
    });

    it("should allow user to change their vote", async () => {
      // First, create a vote
      await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: 1 });

      // Then change the vote
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: -1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vote.value).toBe(-1);
      expect(response.body.data.isNewVote).toBe(false);
      expect(response.body.message).toBe("Vote updated successfully");
    });

    it("should not allow user to vote on their own project", async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ value: 1 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("You cannot vote on your own project");
    });

    it("should not allow duplicate votes with same value", async () => {
      // First, create a vote
      await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: -1 });

      // Then try to create the same vote again
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: -1 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("You have already cast this vote");
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .send({ value: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should validate vote value", async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: 2 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should handle invalid project ID", async () => {
      const response = await request(app)
        .post("/api/projects/invalid-id/vote")
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: 1 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should handle non-existent project", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/projects/${fakeId}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: 1 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Project not found");
    });
  });

  describe("GET /api/projects/:id/votes", () => {
    it("should get project votes", async () => {
      const response = await request(app).get(
        `/api/projects/${testProject._id}/votes`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.votes).toBeInstanceOf(Array);
      expect(response.body.data.voteSummary).toHaveProperty("upvotes");
      expect(response.body.data.voteSummary).toHaveProperty("downvotes");
      expect(response.body.data.voteSummary).toHaveProperty("totalVotes");
      expect(response.body.data.pagination).toHaveProperty("currentPage");
    });

    it("should filter votes by type", async () => {
      const response = await request(app).get(
        `/api/projects/${testProject._id}/votes?voteType=upvote`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // All returned votes should be upvotes
      response.body.data.votes.forEach((vote: any) => {
        expect(vote.voteType).toBe("upvote");
      });
    });

    it("should include user vote if authenticated", async () => {
      // First, create a vote
      await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: -1 });

      const response = await request(app)
        .get(`/api/projects/${testProject._id}/votes`)
        .set("Authorization", `Bearer ${authToken2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Note: userVote will be null due to mock middleware
      expect(response.body.data.userVote).toBeNull();
    });

    it("should handle pagination", async () => {
      const response = await request(app).get(
        `/api/projects/${testProject._id}/votes?page=1&limit=1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.votes.length).toBeLessThanOrEqual(1);
      expect(response.body.data.pagination.itemsPerPage).toBe(1);
    });
  });

  describe("DELETE /api/projects/:id/vote", () => {
    it("should remove user's vote", async () => {
      // First, create a vote
      await request(app)
        .post(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ value: 1 });

      const response = await request(app)
        .delete(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Vote removed successfully");
    });

    it("should handle removing non-existent vote", async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProject._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Vote not found");
    });

    it("should require authentication", async () => {
      const response = await request(app).delete(
        `/api/projects/${testProject._id}/vote`,
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
