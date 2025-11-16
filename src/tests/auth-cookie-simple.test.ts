import request from "supertest";
import app from "../app.js";
import { generateTokens, verifyToken } from "../utils/jwt.utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

describe("Simple Auth Test", () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    // Create a test user directly
    const hashedPassword = await bcrypt.hash("TestPassword123!", 10);

    testUser = await User.create({
      email: "simple-test@example.com",
      password: hashedPassword,
      isVerified: true,
      profile: {
        firstName: "Test",
        lastName: "User",
        username: "simple-test",
        avatar: "",
        bio: "",
        location: "",
        website: "",
        socialLinks: {},
      },
      settings: {
        notifications: { email: true, push: true, inApp: true },
        privacy: {
          profileVisibility: "PUBLIC",
          showWalletAddress: false,
          showContributions: true,
        },
        preferences: { language: "en", timezone: "UTC", theme: "SYSTEM" },
      },
      roles: [
        {
          role: "BACKER",
          grantedAt: new Date(),
          grantedBy: null,
          status: "ACTIVE",
        },
      ],
    });

    // Generate token
    const tokens = generateTokens({
      userId: testUser._id.toString(),
      email: testUser.email,
      roles: testUser.roles.map((r: any) => r.role),
    });

    authToken = tokens.accessToken;
  });

  it("should authenticate with Bearer token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(testUser.email);
  });

  it("should authenticate with token cookie", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `token=${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(testUser.email);
  });

  it("should authenticate with accessToken cookie", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `accessToken=${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(testUser.email);
  });
});
