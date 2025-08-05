import request from "supertest";
import mongoose from "mongoose";
import app from "../app";
import User from "../models/user.model";
import Project, { ProjectStatus, ProjectType } from "../models/project.model";
import ProjectComment from "../models/project-comment.model";
import { TestUserFactory, cleanupTestData } from "./testHelpers";

describe("Project Comment API", () => {
  let testUser: any;
  let testUser2: any;
  let testProject: any;
  let testComment: any;
  let authToken: string;
  let authToken2: string;

  beforeEach(async () => {
    // Clean up any existing data
    await ProjectComment.deleteMany({});
    await Project.deleteMany({});
    await User.deleteMany({
      email: { $in: ["test@example.com", "test2@example.com"] },
    });

    // Create test users using TestUserFactory
    const user1 = await TestUserFactory.regular({
      email: "test@example.com",
      profile: {
        firstName: "Test",
        lastName: "User",
        username: "testuser",
      },
    });

    const user2 = await TestUserFactory.regular({
      email: "test2@example.com",
      profile: {
        firstName: "Test",
        lastName: "User2",
        username: "testuser2",
      },
    });

    testUser = user1.user;
    testUser2 = user2.user;
    authToken = user1.token;
    authToken2 = user2.token;

    // Create test project
    testProject = await Project.create({
      title: "Test Project",
      description: "Test Description",
      summary: "Test Summary",
      type: ProjectType.CROWDFUND,
      category: "Test",
      status: ProjectStatus.IDEA,
      creator: testUser._id,
      owner: {
        type: testUser._id,
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

    // Create a test comment for reply tests
    testComment = await ProjectComment.create({
      userId: testUser._id,
      projectId: testProject._id,
      content: "This is a test comment for replies",
      status: "active",
      reactionCounts: { LIKE: 0, DISLIKE: 0, HELPFUL: 0 },
      totalReactions: 0,
      replyCount: 0,
      reports: [],
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("POST /api/projects/:id/comments", () => {
    it("should add a comment to a project", async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content:
            "This is a great project idea! I'm excited to see how it develops.",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.content).toBe(
        "This is a great project idea! I'm excited to see how it develops.",
      );
      expect(response.body.data.comment.userId._id).toBe(
        testUser2._id.toString(),
      );
      expect(response.body.data.comment.projectId).toBe(
        testProject._id.toString(),
      );
      expect(response.body.data.comment.status).toBe("active");
      expect(response.body.data.moderationResult.flagged).toBe(false);

      // Store for later tests
      testComment = response.body.data.comment;
    }, 30000);

    it("should add a reply to a comment", async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: "Thank you for your support!",
          parentCommentId: testComment._id,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.content).toBe(
        "Thank you for your support!",
      );
      expect(response.body.data.comment.parentCommentId).toBe(
        testComment._id.toString(),
      );
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .send({
          content: "This should fail",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should validate comment content", async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should validate content length", async () => {
      const longContent = "a".repeat(2001);
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: longContent,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should handle invalid project ID", async () => {
      const response = await request(app)
        .post("/api/projects/invalid-id/comments")
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "This should fail",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should handle non-existent project", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/projects/${fakeId}/comments`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "This should fail",
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Project not found");
    });

    it("should handle invalid parent comment ID", async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "This should fail",
          parentCommentId: "invalid-id",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should not allow nested replies", async () => {
      // First create a reply
      const replyResponse = await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "This is a reply",
          parentCommentId: testComment._id,
        });

      const replyId = replyResponse.body.data.comment._id;

      // Try to reply to the reply
      const response = await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: "This should fail",
          parentCommentId: replyId,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Cannot reply to a reply. Please reply to the original comment.",
      );
    });
  });

  describe("GET /api/projects/:id/comments", () => {
    it("should get project comments", async () => {
      const response = await request(app).get(
        `/api/projects/${testProject._id}/comments`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comments).toBeInstanceOf(Array);
      expect(response.body.data.comments.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toHaveProperty("currentPage");
      expect(response.body.data.pagination).toHaveProperty("totalItems");
    });

    it("should get replies for a comment", async () => {
      // First create a reply to the test comment
      await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "This is a reply to the test comment",
          parentCommentId: testComment._id,
        });

      const response = await request(app).get(
        `/api/projects/${testProject._id}/comments?parentCommentId=${testComment._id}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comments).toBeInstanceOf(Array);
      // Should have at least one reply
      expect(response.body.data.comments.length).toBeGreaterThan(0);
      response.body.data.comments.forEach((comment: any) => {
        expect(comment.parentCommentId).toBe(testComment._id.toString());
      });
    });

    it("should handle pagination", async () => {
      const response = await request(app).get(
        `/api/projects/${testProject._id}/comments?page=1&limit=1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comments.length).toBeLessThanOrEqual(1);
      expect(response.body.data.pagination.itemsPerPage).toBe(1);
    });

    it("should handle sorting", async () => {
      const response = await request(app).get(
        `/api/projects/${testProject._id}/comments?sortBy=createdAt&sortOrder=asc`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.sortBy).toBe("createdAt");
      expect(response.body.data.filters.sortOrder).toBe("asc");
    });
  });

  describe("PUT /api/projects/:id/comments/:commentId", () => {
    it("should update a comment", async () => {
      const response = await request(app)
        .put(`/api/projects/${testProject._id}/comments/${testComment._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          content: "This is my updated comment with additional thoughts.",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comment.content).toBe(
        "This is my updated comment with additional thoughts.",
      );
      expect(response.body.data.comment.editHistory).toBeGreaterThan(0);
    });

    it("should not allow updating other user's comment", async () => {
      const response = await request(app)
        .put(`/api/projects/${testProject._id}/comments/${testComment._id}`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "This should fail",
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .put(`/api/projects/${testProject._id}/comments/${testComment._id}`)
        .send({
          content: "This should fail",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should validate content", async () => {
      const response = await request(app)
        .put(`/api/projects/${testProject._id}/comments/${testComment._id}`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });
  });

  describe("DELETE /api/projects/:id/comments/:commentId", () => {
    it("should delete a comment", async () => {
      // Create a comment to delete
      const createResponse = await request(app)
        .post(`/api/projects/${testProject._id}/comments`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "This comment will be deleted",
        });

      const commentId = createResponse.body.data.comment._id;

      const response = await request(app)
        .delete(`/api/projects/${testProject._id}/comments/${commentId}`)
        .set("Authorization", `Bearer ${authToken2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Comment deleted successfully");
    });

    it("should not allow deleting other user's comment", async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProject._id}/comments/${testComment._id}`)
        .set("Authorization", `Bearer ${authToken2}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app).delete(
        `/api/projects/${testProject._id}/comments/${testComment._id}`,
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/projects/:id/comments/:commentId/report", () => {
    it("should report a comment", async () => {
      const response = await request(app)
        .post(
          `/api/projects/${testProject._id}/comments/${testComment._id}/report`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          reason: "spam",
          description:
            "This comment contains promotional content unrelated to the project",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Comment reported successfully");
    });

    it("should not allow duplicate reports", async () => {
      // First create a report
      await request(app)
        .post(
          `/api/projects/${testProject._id}/comments/${testComment._id}/report`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          reason: "spam",
          description: "First report",
        });

      // Try to create another report with the same user
      const response = await request(app)
        .post(
          `/api/projects/${testProject._id}/comments/${testComment._id}/report`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          reason: "inappropriate",
          description: "Another report",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "You have already reported this comment",
      );
    });

    it("should validate report reason", async () => {
      const response = await request(app)
        .post(
          `/api/projects/${testProject._id}/comments/${testComment._id}/report`,
        )
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          reason: "invalid-reason",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post(
          `/api/projects/${testProject._id}/comments/${testComment._id}/report`,
        )
        .send({
          reason: "spam",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
