import request from "supertest";
import app from "../app.js";
import mongoose from "mongoose";
import Project, { ProjectType } from "../models/project.model.js";

// Mock authentication middleware
jest.mock("../middleware/auth", () => ({
  protect: (req: any, res: any, next: any) => {
    req.user = {
      _id: new mongoose.Types.ObjectId(),
      roles: [{ role: "CREATOR", status: "ACTIVE" }],
    };
    next();
  },
}));

// Mock ContractService
jest.mock("../services/contract.service", () => ({
  fundProject: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock Account model
jest.mock("../models/account.model", () => ({
  findOne: jest.fn().mockResolvedValue({
    providerAccountId: "test-wallet-address",
  }),
}));

describe("PATCH /api/grant-applications/:id/escrow", () => {
  let project: any;
  let applicationId: string;

  beforeEach(async () => {
    // Create a project with a grant application
    project = await Project.create({
      title: "Test Project",
      description: "desc",
      category: "cat",
      type: ProjectType.GRANT,
      status: "DRAFT",
      creator: new mongoose.Types.ObjectId(),
      owner: { type: new mongoose.Types.ObjectId() },
      grant: {
        isGrant: true,
        applications: [
          {
            applicant: new mongoose.Types.ObjectId(),
            status: "SUBMITTED",
            submittedAt: new Date(),
            escrowedAmount: 0,
            milestonesCompleted: 0,
          },
        ],
        totalBudget: 1000,
        totalDisbursed: 0,
        proposalsReceived: 1,
        proposalsApproved: 0,
        status: "OPEN",
      },
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
    applicationId = project.grant.applications[0]._id;
  });

  afterAll(async () => {
    await Project.deleteMany({});
    await mongoose.connection.close();
  });

  it("should validate input", async () => {
    const res = await request(app)
      .patch(`/api/grant-applications/${applicationId}/escrow`)
      .send({ status: "not-locked", txHash: "", amount: -5 });
    expect(res.status).toBe(400);
  });

  it("should return 404 for invalid application", async () => {
    const res = await request(app)
      .patch(`/api/grant-applications/${new mongoose.Types.ObjectId()}/escrow`)
      .send({ status: "locked", txHash: "abc", amount: 100 });
    expect(res.status).toBe(404);
  });

  it("should lock escrow and update status", async () => {
    const res = await request(app)
      .patch(`/api/grant-applications/${applicationId}/escrow`)
      .send({ status: "locked", txHash: "tx123", amount: 100 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("IN_PROGRESS");
    expect(res.body.data.escrowedAmount).toBe(100);
    expect(res.body.data.txHash).toBe("tx123");
  });
});
