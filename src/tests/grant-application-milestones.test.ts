import request from "supertest";
import app from "../app";
import { connectDB, disconnectDB } from "../config/db";
import GrantApplication from "../models/grant-application.model";
import User from "../models/user.model";
import { signToken } from "../utils/jwt.utils";

describe("PATCH /api/grant-applications/:id/milestones", () => {
  let adminToken: string;
  let grantCreatorToken: string;
  let regularUserToken: string;
  let grantApplicationId: string;

  beforeAll(async () => {
    await connectDB();

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

    adminToken = signToken(adminUser._id);
    grantCreatorToken = signToken(grantCreatorUser._id);
    regularUserToken = signToken(regularUser._id);

    // Create a test grant application
    const grantApplication = await GrantApplication.create({
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
    });
    grantApplicationId = grantApplication._id.toString();
  });

  afterAll(async () => {
    await GrantApplication.deleteMany({});
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
      "Grant application milestones updated successfully",
    );
    expect(res.body.grantApplication.status).toEqual("awaiting-final-approval");
    expect(res.body.grantApplication.milestones).toHaveLength(2);
    expect(res.body.grantApplication.milestones[0].title).toEqual(
      "Updated Milestone 1",
    );
    expect(res.body.grantApplication.milestones[1].expectedPayout).toEqual(250);

    const updatedApp = await GrantApplication.findById(grantApplicationId);
    expect(updatedApp?.status).toEqual("awaiting-final-approval");
    expect(updatedApp?.milestones[0].title).toEqual("Updated Milestone 1");
  });

  it("should return 400 if milestones array is empty", async () => {
    const res = await request(app)
      .patch(`/api/grant-applications/${grantApplicationId}/milestones`)
      .set("Authorization", `Bearer ${grantCreatorToken}`)
      .send({ milestones: [] });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toEqual("Milestones array cannot be empty.");
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
    const nonExistentId = "60b8d6c7f8b3c2a9e0b1c2d3"; // A valid-looking but non-existent ID
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

  it("should return 403 if user is not a grant creator or admin", async () => {
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
      "Unauthorized: Only grant creators or administrators can perform this action.",
    );
  });

  it("should allow admin to update milestones", async () => {
    const updatedMilestones = [
      {
        title: "Admin Updated Milestone",
        description: "Admin Desc",
        expectedPayout: 300,
      },
    ];

    const res = await request(app)
      .patch(`/api/grant-applications/${grantApplicationId}/milestones`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ milestones: updatedMilestones });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual(
      "Grant application milestones updated successfully",
    );
    expect(res.body.grantApplication.status).toEqual("awaiting-final-approval");
    expect(res.body.grantApplication.milestones[0].title).toEqual(
      "Admin Updated Milestone",
    );
  });
});
