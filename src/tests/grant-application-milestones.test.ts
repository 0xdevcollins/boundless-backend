import request from "supertest";
import app from "../app";
import GrantApplication from "../models/grant-application.model";
import User from "../models/user.model";
import Project from "../models/project.model";
import mongoose from "mongoose";

// Helper function to create JWT token - you'll need to implement this based on your JWT structure
const createToken = (
  userId: string | mongoose.Types.ObjectId,
  email: string,
) => {
  // This is a placeholder - replace with your actual JWT token generation logic
  // You might need to import and use your JWT utilities differently
  const payload = {
    userId: userId.toString(),
    email: email,
    roles: [],
  };

  // Option 1: If you have a direct sign function
  // return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });

  // Option 2: If you need to use your generateTokens function, make sure it's exported
  // const { accessToken } = generateTokens(payload);
  // return accessToken;

  // For now, returning a mock token - replace with actual implementation
  return "mock-jwt-token-" + userId.toString();
};

// Helper function to disconnect from database
const disconnectDB = async () => {
  await mongoose.disconnect();
};

describe("PATCH /api/grant-applications/:id/milestones", () => {
  let adminToken: string;
  let grantCreatorToken: string;
  let regularUserToken: string;
  let grantApplicationId: string;
  let grantCreatorUserId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

  beforeAll(async () => {
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

    // Create test users
    const adminUser = await User.create({
      email: "admin@example.com",
      role: "admin",
      password: "password123",
    });
    const grantCreatorUser = await User.create({
      email: "creator@example.com",
      role: "grant_creator",
      password: "password123",
    });
    const regularUser = await User.create({
      email: "user@example.com",
      role: "user",
      password: "password123",
    });

    grantCreatorUserId = grantCreatorUser._id as mongoose.Types.ObjectId;

    adminToken = createToken(
      adminUser._id as mongoose.Types.ObjectId,
      adminUser.email,
    );
    grantCreatorToken = createToken(grantCreatorUserId, grantCreatorUser.email);
    regularUserToken = createToken(
      regularUser._id as mongoose.Types.ObjectId,
      regularUser.email,
    );

    // Create a test project with grant application
    const project = await Project.create({
      title: "Test Grant Project",
      description: "Test project description",
      creator: grantCreatorUserId,
      grant: {
        isGrant: true,
        applications: [
          {
            applicant: regularUser._id,
            status: "pending",
            milestones: [
              {
                title: "Initial Milestone 1",
                description: "Desc 1",
                expectedPayout: 100,
              },
              {
                title: "Initial Milestone 2",
                description: "Desc 2",
                expectedPayout: 200,
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
    await Project.deleteMany({});
    await User.deleteMany({});
    await disconnectDB();
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
    expect(res.body.data.status).toEqual("awaiting-final-approval");
    expect(res.body.data.milestones).toHaveLength(2);
    expect(res.body.data.milestones[0].title).toEqual("Updated Milestone 1");
    expect(res.body.data.milestones[1].expectedPayout).toEqual(250);

    // Verify in database
    const updatedProject = await Project.findById(projectId);
    if (
      updatedProject?.grant?.applications &&
      updatedProject.grant.applications.length > 0
    ) {
      const updatedApp = updatedProject.grant.applications[0];
      expect(updatedApp.status).toEqual("awaiting-final-approval");
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
    expect(res.body.data.status).toEqual("awaiting-final-approval");
    expect(res.body.data.milestones[0].title).toEqual(
      "Creator Updated Milestone",
    );
  });
});
