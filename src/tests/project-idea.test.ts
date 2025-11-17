import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import User from "../models/user.model.js";
import Project, {
  ProjectStatus,
  ProjectType,
} from "../models/project.model.js";
import Crowdfund, { CrowdfundStatus } from "../models/crowdfund.model.js";
import { TestUserFactory, cleanupTestData } from "./testHelpers.js";

describe("Project Idea Endpoints", () => {
  let userToken: string;
  let userId: mongoose.Types.ObjectId;
  let otherUserToken: string;
  let otherUserId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Clean up existing data
    await User.deleteMany({});
    await Project.deleteMany({});
    await Crowdfund.deleteMany({});

    // Create test users using TestUserFactory
    const user = await TestUserFactory.creator({
      email: "creator@test.com",
      profile: {
        firstName: "Test",
        lastName: "Creator",
        username: "testcreator",
      },
    });
    userId = user.user._id;
    userToken = user.token;

    const otherUser = await TestUserFactory.regular({
      email: "other@test.com",
      profile: {
        firstName: "Other",
        lastName: "User",
        username: "otheruser",
      },
    });
    otherUserId = otherUser.user._id;
    otherUserToken = otherUser.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("POST /api/projects", () => {
    it("should create a new project idea with default values", async () => {
      const projectData = {
        title: "Test Project Idea",
        description: "This is a test project description",
        category: "Technology",
      };

      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${userToken}`)
        .send(projectData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project.title).toBe(projectData.title);
      expect(res.body.data.project.type).toBe(ProjectType.CROWDFUND);
      expect(res.body.data.project.status).toBe(ProjectStatus.IDEA);
      expect(res.body.data.project.votes).toBe(0);
      expect(res.body.data.crowdfund).toBeDefined();
      expect(res.body.data.crowdfund.thresholdVotes).toBe(100);
      expect(res.body.data.crowdfund.status).toBe(CrowdfundStatus.PENDING);
    }, 30000);

    it("should create a grant project without crowdfund record", async () => {
      const projectData = {
        title: "Test Grant Project",
        description: "This is a test grant project",
        type: ProjectType.GRANT,
        category: "Research",
      };

      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${userToken}`)
        .send(projectData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project.type).toBe(ProjectType.GRANT);
      expect(res.body.data.crowdfund).toBeUndefined();
    });

    it("should validate required fields", async () => {
      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.data.errors).toBeDefined();
    });

    it("should validate URL formats", async () => {
      const projectData = {
        title: "Test Project",
        description: "Test description",
        category: "Technology",
        whitepaperUrl: "invalid-url",
        thumbnail: "also-invalid",
      };

      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${userToken}`)
        .send(projectData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const projectData = {
        title: "Test Project",
        description: "Test description",
        category: "Technology",
      };

      const res = await request(app).post("/api/projects").send(projectData);

      expect(res.status).toBe(401);
    });

    it("should create a project with milestones and map them correctly", async () => {
      const projectData = {
        title: "Milestone Project",
        description: "Project with milestones",
        category: "Technology",
        fundAmount: 3000,
        milestones: [
          {
            title: "Phase 1",
            description: "Initial phase",
            deliveryDate: "2025-01-01",
            fundPercentage: 33.33,
            fundAmount: 1000,
          },
          {
            title: "Phase 2",
            description: "Second phase",
            deliveryDate: "2025-02-01",
            fundPercentage: 33.33,
            fundAmount: 1000,
          },
          {
            title: "Phase 3",
            description: "Final phase",
            deliveryDate: "2025-03-01",
            fundPercentage: 33.34,
            fundAmount: 1000,
          },
        ],
      };

      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${userToken}`)
        .send(projectData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const project = res.body.data.project;
      expect(project.milestones).toHaveLength(3);
      expect(project.milestones[0].title).toBe("Phase 1");
      expect(project.milestones[0].description).toBe("Initial phase");
      expect(new Date(project.milestones[0].dueDate).toISOString()).toContain(
        "2025-01-01",
      );
      expect(project.milestones[0].amount).toBe(1000);
      expect(project.milestones[0].status).toBe("pending");
      expect(project.funding.goal).toBe(3000);
    }, 30000);

    it("should compute funding goal from milestones if fundAmount not provided", async () => {
      const projectData = {
        title: "Auto Goal Project",
        description: "Computes goal from milestones",
        category: "Technology",
        milestones: [
          {
            title: "A",
            description: "A",
            deliveryDate: "2025-01-01",
            fundAmount: 150,
          },
          {
            title: "B",
            description: "B",
            deliveryDate: "2025-02-01",
            fundAmount: 50,
          },
        ],
      };

      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${userToken}`)
        .send(projectData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project.funding.goal).toBe(200);
      expect(res.body.data.project.milestones).toHaveLength(2);
    }, 30000);

    it("should fail if milestones sum does not equal fundAmount", async () => {
      const projectData = {
        title: "Mismatch Goal Project",
        description: "Mismatch",
        category: "Technology",
        fundAmount: 100,
        milestones: [
          {
            title: "Only",
            description: "Only",
            deliveryDate: "2025-01-01",
            fundAmount: 50,
          },
        ],
      };

      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${userToken}`)
        .send(projectData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /(Sum of milestone amounts must equal project fundAmount|Validation failed)/,
      );
    }, 30000);
  });

  describe("GET /api/projects", () => {
    beforeEach(async () => {
      // Create test projects
      await Project.create([
        {
          title: "Project 1",
          description: "Description 1",
          type: ProjectType.CROWDFUND,
          status: ProjectStatus.IDEA,
          votes: 10,
          creator: userId,
          owner: { type: userId },
          category: "Technology",
          funding: {
            goal: 1000,
            raised: 0,
            currency: "USD",
            endDate: new Date(),
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
        },
        {
          title: "Project 2",
          description: "Description 2",
          type: ProjectType.GRANT,
          status: ProjectStatus.REVIEWING,
          votes: 5,
          creator: otherUserId,
          owner: { type: otherUserId },
          category: "Research",
          funding: {
            goal: 2000,
            raised: 0,
            currency: "USD",
            endDate: new Date(),
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
        },
      ]);
    });

    it("should return paginated project ideas", async () => {
      const res = await request(app)
        .get("/api/projects")
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.projects).toHaveLength(2);
      expect(res.body.data.pagination.totalItems).toBe(2);
    });

    it("should filter by status", async () => {
      const res = await request(app)
        .get("/api/projects")
        .query({ status: ProjectStatus.IDEA });

      expect(res.status).toBe(200);
      expect(res.body.data.projects).toHaveLength(1);
      expect(res.body.data.projects[0].status).toBe(ProjectStatus.IDEA);
    });

    it("should filter by type", async () => {
      const res = await request(app)
        .get("/api/projects")
        .query({ type: ProjectType.GRANT });

      expect(res.status).toBe(200);
      expect(res.body.data.projects).toHaveLength(1);
      expect(res.body.data.projects[0].type).toBe(ProjectType.GRANT);
    });

    it("should search in title and description", async () => {
      const res = await request(app)
        .get("/api/projects")
        .query({ search: "Project 1" });

      expect(res.status).toBe(200);
      expect(res.body.data.projects).toHaveLength(1);
      expect(res.body.data.projects[0].title).toBe("Project 1");
    });

    it("should sort by votes", async () => {
      const res = await request(app)
        .get("/api/projects")
        .query({ sortBy: "votes", sortOrder: "desc" });

      expect(res.status).toBe(200);
      expect(res.body.data.projects[0].votes).toBe(10);
      expect(res.body.data.projects[1].votes).toBe(5);
    });
  });

  describe("GET /api/projects/:id", () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await Project.create({
        title: "Test Project",
        description: "Test Description",
        type: ProjectType.CROWDFUND,
        status: ProjectStatus.IDEA,
        votes: 0,
        creator: userId,
        owner: { type: userId },
        category: "Technology",
        funding: {
          goal: 1000,
          raised: 0,
          currency: "USD",
          endDate: new Date(),
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
      });
      projectId = project._id.toString();

      await Crowdfund.create({
        projectId: project._id,
        thresholdVotes: 100,
        totalVotes: 0,
        status: CrowdfundStatus.PENDING,
      });
    });

    it("should return project with crowdfund data", async () => {
      const res = await request(app).get(`/api/projects/${projectId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project.title).toBe("Test Project");
      expect(res.body.data.crowdfund).toBeDefined();
      expect(res.body.data.crowdfund.thresholdVotes).toBe(100);
    });

    it("should return 404 for non-existent project", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/projects/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for invalid project ID", async () => {
      const res = await request(app).get("/api/projects/invalid-id");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PUT /api/projects/:id", () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await Project.create({
        title: "Original Title",
        description: "Original Description",
        type: ProjectType.CROWDFUND,
        status: ProjectStatus.IDEA,
        votes: 0,
        creator: userId,
        owner: { type: userId },
        category: "Original Category",
        funding: {
          goal: 1000,
          raised: 0,
          currency: "USD",
          endDate: new Date(),
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
      });
      projectId = project._id.toString();
    });

    it("should update project idea successfully", async () => {
      const updateData = {
        title: "Updated Title",
        description: "Updated Description",
        category: "Updated Category",
      };

      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project.title).toBe(updateData.title);
      expect(res.body.data.project.description).toBe(updateData.description);
    });

    it("should not allow non-owner to update", async () => {
      const updateData = {
        title: "Unauthorized Update",
      };

      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send(updateData);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should not allow update for non-idea status", async () => {
      await Project.findByIdAndUpdate(projectId, {
        status: ProjectStatus.REVIEWING,
      });

      const updateData = {
        title: "Should Not Update",
      };

      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send(updateData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /api/projects/:id", () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await Project.create({
        title: "To Be Deleted",
        description: "This will be deleted",
        type: ProjectType.CROWDFUND,
        status: ProjectStatus.IDEA,
        votes: 0,
        creator: userId,
        owner: { type: userId },
        category: "Delete Category",
        funding: {
          goal: 1000,
          raised: 0,
          currency: "USD",
          endDate: new Date(),
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
      });
      projectId = project._id.toString();

      await Crowdfund.create({
        projectId: project._id,
        thresholdVotes: 100,
        totalVotes: 0,
        status: CrowdfundStatus.PENDING,
      });
    });

    it("should delete project and associated crowdfund", async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify project is deleted
      const project = await Project.findById(projectId);
      expect(project).toBeNull();

      // Verify crowdfund is deleted
      const crowdfund = await Crowdfund.findOne({ projectId });
      expect(crowdfund).toBeNull();
    });

    it("should not allow non-owner to delete", async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should not allow deletion for non-idea status", async () => {
      await Project.findByIdAndUpdate(projectId, {
        status: ProjectStatus.REVIEWING,
      });

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
