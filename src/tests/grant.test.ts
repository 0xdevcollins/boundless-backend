import request from "supertest";
import mongoose from "mongoose";
import app from "../app";
import User, { UserRole, UserStatus } from "../models/user.model";
import Grant from "../models/grant.model";
import { generateTokens } from "../utils/jwt.utils";
import bcrypt from "bcryptjs";

describe("Grant API", () => {
  let creatorUser: any;
  let regularUser: any;
  let creatorToken: string;
  let regularToken: string;

  const validGrantData = {
    title: "Open Source Development Grant",
    description:
      "A grant program to support open source blockchain development projects. This program aims to fund innovative projects that contribute to the blockchain ecosystem.",
    totalBudget: 50000,
    rules:
      "1. Projects must be open source\n2. Must have a working prototype\n3. Must provide regular updates\n4. Must be completed within 6 months",
    milestones: [
      {
        title: "Project Planning",
        description: "Complete project planning and architecture design",
        expectedPayout: 10000,
      },
      {
        title: "MVP Development",
        description: "Develop and test minimum viable product",
        expectedPayout: 20000,
      },
      {
        title: "Final Implementation",
        description: "Complete the full implementation and documentation",
        expectedPayout: 20000,
      },
    ],
  };

  beforeAll(async () => {
    // Create test users
    const hashedPassword = await bcrypt.hash("TestPassword123!", 10);

    // Create creator user
    creatorUser = await User.create({
      email: "creator@test.com",
      password: hashedPassword,
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
      status: UserStatus.ACTIVE,
      roles: [
        {
          role: UserRole.CREATOR,
          grantedAt: new Date(),
          status: "ACTIVE",
        },
      ],
    });

    // Create regular user (no creator role)
    regularUser = await User.create({
      email: "regular@test.com",
      password: hashedPassword,
      profile: {
        firstName: "Jane",
        lastName: "Regular",
        username: "janeregular",
        avatar: "https://example.com/avatar2.jpg",
        bio: "Regular User",
        location: "Los Angeles",
        website: "https://janeregular.com",
        socialLinks: {
          twitter: "https://twitter.com/janeregular",
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
        reputation: 50,
        communityScore: 60,
      },
      status: UserStatus.ACTIVE,
      roles: [
        {
          role: UserRole.USER,
          grantedAt: new Date(),
          status: "ACTIVE",
        },
      ],
    });

    // Generate tokens
    creatorToken = generateToken({ userId: creatorUser._id.toString() });
    regularToken = generateToken({ userId: regularUser._id.toString() });
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({
      email: { $in: ["creator@test.com", "regular@test.com"] },
    });
    await Grant.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear grants before each test
    await Grant.deleteMany({});
  });

  describe("POST /api/grants", () => {
    describe("Authentication", () => {
      it("should return 401 when no token is provided", async () => {
        const response = await request(app)
          .post("/api/grants")
          .send(validGrantData);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Authentication required");
      });

      it("should return 401 when invalid token is provided", async () => {
        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", "Bearer invalid-token")
          .send(validGrantData);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });

    describe("Authorization", () => {
      it("should return 403 when user without creator role tries to create grant", async () => {
        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${regularToken}`)
          .send(validGrantData);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Only creators can create grants");
      });

      it("should allow user with creator role to create grant", async () => {
        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(validGrantData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Grant created successfully");
      });
    });

    describe("Validation", () => {
      it("should return 400 when title is missing", async () => {
        const invalidData = { ...validGrantData };
        delete invalidData.title;

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.title).toBeDefined();
      });

      it("should return 400 when title is too long", async () => {
        const invalidData = {
          ...validGrantData,
          title: "a".repeat(201), // 201 characters
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.title).toBeDefined();
      });

      it("should return 400 when description is missing", async () => {
        const invalidData = { ...validGrantData };
        delete invalidData.description;

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.description).toBeDefined();
      });

      it("should return 400 when description is too long", async () => {
        const invalidData = {
          ...validGrantData,
          description: "a".repeat(5001), // 5001 characters
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.description).toBeDefined();
      });

      it("should return 400 when totalBudget is missing", async () => {
        const invalidData = { ...validGrantData };
        delete invalidData.totalBudget;

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.totalBudget).toBeDefined();
      });

      it("should return 400 when totalBudget is not positive", async () => {
        const invalidData = {
          ...validGrantData,
          totalBudget: 0,
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.totalBudget).toBeDefined();
      });

      it("should return 400 when rules are missing", async () => {
        const invalidData = { ...validGrantData };
        delete invalidData.rules;

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.rules).toBeDefined();
      });

      it("should return 400 when rules are too long", async () => {
        const invalidData = {
          ...validGrantData,
          rules: "a".repeat(2001), // 2001 characters
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.rules).toBeDefined();
      });

      it("should return 400 when milestones array is missing", async () => {
        const invalidData = { ...validGrantData };
        delete invalidData.milestones;

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.milestones).toBeDefined();
      });

      it("should return 400 when milestones array is empty", async () => {
        const invalidData = {
          ...validGrantData,
          milestones: [],
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors.milestones).toBeDefined();
      });

      it("should return 400 when milestone title is missing", async () => {
        const invalidData = {
          ...validGrantData,
          milestones: [
            {
              description: "Test milestone",
              expectedPayout: 1000,
            },
          ],
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors["milestones[0].title"]).toBeDefined();
      });

      it("should return 400 when milestone description is missing", async () => {
        const invalidData = {
          ...validGrantData,
          milestones: [
            {
              title: "Test milestone",
              expectedPayout: 1000,
            },
          ],
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors["milestones[0].description"]).toBeDefined();
      });

      it("should return 400 when milestone expectedPayout is negative", async () => {
        const invalidData = {
          ...validGrantData,
          milestones: [
            {
              title: "Test milestone",
              description: "Test milestone description",
              expectedPayout: -100,
            },
          ],
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(
          response.body.errors["milestones[0].expectedPayout"],
        ).toBeDefined();
      });

      it("should return 400 when total milestone payouts exceed total budget", async () => {
        const invalidData = {
          ...validGrantData,
          totalBudget: 1000,
          milestones: [
            {
              title: "Milestone 1",
              description: "First milestone",
              expectedPayout: 600,
            },
            {
              title: "Milestone 2",
              description: "Second milestone",
              expectedPayout: 600,
            },
          ],
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
          "Total milestone payouts cannot exceed total budget",
        );
      });
    });

    describe("Success Scenarios", () => {
      it("should create grant successfully with valid data", async () => {
        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(validGrantData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Grant created successfully");
        expect(response.body.data).toBeDefined();

        const grant = response.body.data;
        expect(grant.title).toBe(validGrantData.title);
        expect(grant.description).toBe(validGrantData.description);
        expect(grant.totalBudget).toBe(validGrantData.totalBudget);
        expect(grant.rules).toBe(validGrantData.rules);
        expect(grant.status).toBe("draft");
        expect(grant.creatorId._id).toBe(creatorUser._id.toString());
        expect(grant.milestones).toHaveLength(3);
        expect(grant.milestones[0].title).toBe("Project Planning");
        expect(grant.milestones[0].expectedPayout).toBe(10000);
        expect(grant.createdAt).toBeDefined();
        expect(grant.updatedAt).toBeDefined();
      });

      it("should create grant with single milestone", async () => {
        const singleMilestoneData = {
          ...validGrantData,
          totalBudget: 10000,
          milestones: [
            {
              title: "Complete Project",
              description: "Finish the entire project",
              expectedPayout: 10000,
            },
          ],
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(singleMilestoneData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.milestones).toHaveLength(1);
        expect(response.body.data.milestones[0].expectedPayout).toBe(10000);
      });

      it("should create grant with multiple milestones that sum to total budget", async () => {
        const multipleMilestoneData = {
          ...validGrantData,
          totalBudget: 30000,
          milestones: [
            {
              title: "Phase 1",
              description: "Initial development phase",
              expectedPayout: 10000,
            },
            {
              title: "Phase 2",
              description: "Core development phase",
              expectedPayout: 15000,
            },
            {
              title: "Phase 3",
              description: "Finalization phase",
              expectedPayout: 5000,
            },
          ],
        };

        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(multipleMilestoneData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.milestones).toHaveLength(3);

        const totalPayouts = response.body.data.milestones.reduce(
          (sum: number, milestone: any) => sum + milestone.expectedPayout,
          0,
        );
        expect(totalPayouts).toBe(30000);
      });

      it("should populate creator information in response", async () => {
        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(validGrantData);

        expect(response.status).toBe(201);
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
      it("should save grant to database", async () => {
        const response = await request(app)
          .post("/api/grants")
          .set("Authorization", `Bearer ${creatorToken}`)
          .send(validGrantData);

        expect(response.status).toBe(201);

        // Verify grant was saved in database
        const savedGrant = await Grant.findById(response.body.data._id);
        expect(savedGrant).toBeDefined();
        expect(savedGrant?.title).toBe(validGrantData.title);
        expect(savedGrant?.creatorId.toString()).toBe(
          creatorUser._id.toString(),
        );
        expect(savedGrant?.status).toBe("draft");
      });

      it("should handle concurrent grant creation", async () => {
        const promises = [
          request(app)
            .post("/api/grants")
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
              ...validGrantData,
              title: "Grant 1",
            }),
          request(app)
            .post("/api/grants")
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({
              ...validGrantData,
              title: "Grant 2",
            }),
        ];

        const responses = await Promise.all(promises);

        expect(responses[0].status).toBe(201);
        expect(responses[1].status).toBe(201);

        const grants = await Grant.find({ creatorId: creatorUser._id });
        expect(grants).toHaveLength(2);
      });
    });
  });
});
