import request from "supertest";
import app from "../app.js";
import GrantApplication from "../models/grant-application.model.js";
import User from "../models/user.model.js";
import Project from "../models/project.model.js";
import mongoose from "mongoose";
import {
  TestUserFactory,
  cleanupTestData,
  generateTestToken,
} from "./testHelpers.js";

describe("PATCH /api/grant-applications/:id/milestones", () => {
  let adminUser: any;
  let grantCreatorUser: any;
  let regularUser: any;
  let adminToken: string;
  let grantCreatorToken: string;
  let regularUserToken: string;
  let grantApplicationId: string;
  let grantCreatorUserId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      const testDbUri =
        process.env.MONGODB_TEST_URI ||
        "mongodb://localhost:27017/boundless-test";
      await mongoose.connect(testDbUri);
    }

    // Clean up existing data
    await Project.deleteMany({});
    await User.deleteMany({});

    // Create test users using TestUserFactory
    adminUser = await TestUserFactory.admin({
      email: "admin@example.com",
      profile: {
        firstName: "Admin",
        lastName: "User",
        username: "adminuser",
      },
    });

    grantCreatorUser = await TestUserFactory.creator({
      email: "creator@example.com",
      profile: {
        firstName: "Grant",
        lastName: "Creator",
        username: "grantcreator",
      },
    });

    regularUser = await TestUserFactory.regular({
      email: "user@example.com",
      profile: {
        firstName: "Regular",
        lastName: "User",
        username: "regularuser",
      },
    });

    grantCreatorUserId = grantCreatorUser.user._id as mongoose.Types.ObjectId;

    adminToken = adminUser.token;
    grantCreatorToken = grantCreatorUser.token;
    regularUserToken = regularUser.token;

    // Create a test project with grant application
    const project = await Project.create({
      title: "Test Grant Project",
      description: "Test project description",
      type: "grant",
      category: "blockchain",
      creator: grantCreatorUserId,
      owner: {
        type: grantCreatorUserId,
      },
      funding: {
        goal: 10000,
        raised: 0,
        currency: "USD",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        contributors: [],
      },
      grant: {
        isGrant: true,
        applications: [
          {
            applicant: regularUser.user._id,
            status: "SUBMITTED",
            submittedAt: new Date(),
            escrowedAmount: 0,
            milestonesCompleted: 0,
            milestones: [
              {
                title: "Initial Milestone 1",
                description: "Desc 1",
                amount: 100,
              },
              {
                title: "Initial Milestone 2",
                description: "Desc 2",
                amount: 200,
              },
            ],
          },
        ],
      },
    });

    projectId = project._id as mongoose.Types.ObjectId;

    // Safe access to grant application ID
    if (
      project.grant &&
      project.grant.applications &&
      project.grant.applications.length > 0
    ) {
      const applicationId = project.grant.applications[0]._id;
      if (applicationId) {
        grantApplicationId = (
          applicationId as mongoose.Types.ObjectId
        ).toString();
      } else {
        throw new Error("Failed to create grant application with ID");
      }
    } else {
      throw new Error("Failed to create project with grant applications");
    }
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should update milestones and set status to awaiting-final-approval for grant creator", async () => {
    const updatedMilestones = [
      {
        title: "Updated Milestone 1",
        description: "New Desc 1",
        expectedPayout: 150,
      },
      {
        title: "Updated Milestone 2",
        description: "New Desc 2",
        expectedPayout: 250,
      },
    ];

    const res = await request(app)
      .patch(`/api/grant-applications/${grantApplicationId}/milestones`)
      .set("Authorization", `Bearer ${grantCreatorToken}`)
      .send({ milestones: updatedMilestones });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual(
      "Milestones updated and application status set to awaiting-final-approval",
    );
    expect(res.body.data.status).toEqual("AWAITING_FINAL_APPROVAL");
    expect(res.body.data.milestones).toHaveLength(2);
    expect(res.body.data.milestones[0].title).toEqual("Updated Milestone 1");
    expect(res.body.data.milestones[1].amount).toEqual(250);

    // Verify in database
    const updatedProject = await Project.findById(projectId);
    if (
      updatedProject?.grant?.applications &&
      updatedProject.grant.applications.length > 0
    ) {
      const updatedApp = updatedProject.grant.applications[0];
      expect(updatedApp.status).toEqual("AWAITING_FINAL_APPROVAL");
      // Type-safe access to milestones
      if ("milestones" in updatedApp && Array.isArray(updatedApp.milestones)) {
        expect(updatedApp.milestones[0].title).toEqual("Updated Milestone 1");
      }
    }
  });

  it("should return 400 if milestones array is empty", async () => {
    const res = await request(app)
      .patch(`/api/grant-applications/${grantApplicationId}/milestones`)
      .set("Authorization", `Bearer ${grantCreatorToken}`)
      .send({ milestones: [] });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toEqual(
      "Milestones array is required and cannot be empty",
    );
  });

  it("should return 400 if milestones array contains invalid data (missing title)", async () => {
    const invalidMilestones = [
      { description: "New Desc 1", expectedPayout: 150 },
    ];

    const res = await request(app)
      .patch(`/api/grant-applications/${grantApplicationId}/milestones`)
      .set("Authorization", `Bearer ${grantCreatorToken}`)
      .send({ milestones: invalidMilestones });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain("Milestone title is required");
  });

  it("should return 404 if grant application ID is not found", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const updatedMilestones = [
      {
        title: "Updated Milestone 1",
        description: "New Desc 1",
        expectedPayout: 150,
      },
    ];

    const res = await request(app)
      .patch(`/api/grant-applications/${nonExistentId}/milestones`)
      .set("Authorization", `Bearer ${grantCreatorToken}`)
      .send({ milestones: updatedMilestones });

    expect(res.statusCode).toEqual(404);
    expect(res.body.message).toEqual("Grant application not found");
  });

  it("should return 403 if user is not the grant creator", async () => {
    const updatedMilestones = [
      {
        title: "Updated Milestone 1",
        description: "New Desc 1",
        expectedPayout: 150,
      },
    ];

    const res = await request(app)
      .patch(`/api/grant-applications/${grantApplicationId}/milestones`)
      .set("Authorization", `Bearer ${regularUserToken}`)
      .send({ milestones: updatedMilestones });

    expect(res.statusCode).toEqual(403);
    expect(res.body.message).toEqual(
      "Unauthorized: Only grant creators can modify milestones",
    );
  });

  it("should allow project creator to update milestones", async () => {
    const updatedMilestones = [
      {
        title: "Creator Updated Milestone",
        description: "Creator Desc",
        expectedPayout: 300,
      },
    ];

    const res = await request(app)
      .patch(`/api/grant-applications/${grantApplicationId}/milestones`)
      .set("Authorization", `Bearer ${grantCreatorToken}`)
      .send({ milestones: updatedMilestones });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual(
      "Milestones updated and application status set to awaiting-final-approval",
    );
    expect(res.body.data.status).toEqual("AWAITING_FINAL_APPROVAL");
    expect(res.body.data.milestones[0].title).toEqual(
      "Creator Updated Milestone",
    );
  });
});
