import request from "supertest";
import app from "../app";
import User from "../models/user.model";
import { generateTokens, verifyRefreshToken } from "../utils/jwt.utils";
import jwt from "jsonwebtoken";

describe("Refresh Token Tests", () => {
  let testUser: any;
  let validTokens: any;
  let expiredAccessToken: string;
  let validRefreshToken: string;

  beforeEach(async () => {
    // Create a test user
    testUser = new User({
      email: "refresh-test@example.com",
      password: "password123",
      profile: {
        firstName: "Test",
        lastName: "User",
        username: "refreshuser",
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
      isVerified: true,
    });

    await testUser.save();

    // Generate valid tokens
    validTokens = generateTokens({
      userId: testUser._id.toString(),
      email: testUser.email,
      roles: testUser.roles.map((role: any) => role.role),
    });

    // Generate expired access token
    const secret = process.env.JWT_SECRET || "fallback_secret";
    expiredAccessToken = jwt.sign(
      {
        userId: testUser._id.toString(),
        email: testUser.email,
        roles: testUser.roles.map((role: any) => role.role),
      },
      secret,
      { expiresIn: "0s" }, // Expired immediately
    );

    // Generate valid refresh token
    const refreshSecret =
      process.env.JWT_REFRESH_TOKEN_SECRET || "fallback_refresh_secret";
    validRefreshToken = jwt.sign(
      {
        userId: testUser._id.toString(),
        email: testUser.email,
        roles: testUser.roles.map((role: any) => role.role),
      },
      refreshSecret,
      { expiresIn: "7d" },
    );
  });

  describe("POST /auth/refresh", () => {
    it("should refresh tokens with valid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`refreshToken=${validRefreshToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.message).toBe("Token refreshed successfully");

      // Check that new cookies are set
      const cookies = response.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();

      const accessTokenCookie = cookies?.find((cookie: string) =>
        cookie.startsWith("accessToken="),
      );
      const refreshTokenCookie = cookies?.find((cookie: string) =>
        cookie.startsWith("refreshToken="),
      );

      expect(accessTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeDefined();
    });

    it("should return 401 when no refresh token is provided", async () => {
      const response = await request(app).post("/api/auth/refresh").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Refresh token not found");
    });

    it("should return 401 when refresh token is invalid", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", ["refreshToken=invalid_token"])
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid refresh token");
    });

    it("should return 401 when refresh token is expired", async () => {
      // Create an expired refresh token
      const refreshSecret =
        process.env.JWT_REFRESH_TOKEN_SECRET || "fallback_refresh_secret";
      const expiredRefreshToken = jwt.sign(
        {
          userId: testUser._id.toString(),
          email: testUser.email,
          roles: testUser.roles.map((role: any) => role.role),
        },
        refreshSecret,
        { expiresIn: "0s" }, // Expired immediately
      );

      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`refreshToken=${expiredRefreshToken}`])
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Refresh token expired");
    });

    it("should return 401 when user is not verified", async () => {
      // Create an unverified user
      const unverifiedUser = new User({
        email: "unverified@example.com",
        password: "password123",
        profile: {
          firstName: "Unverified",
          lastName: "User",
          username: "unverifieduser",
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
        isVerified: false,
      });

      await unverifiedUser.save();

      const refreshSecret =
        process.env.JWT_REFRESH_TOKEN_SECRET || "fallback_refresh_secret";
      const unverifiedRefreshToken = jwt.sign(
        {
          userId: unverifiedUser._id.toString(),
          email: unverifiedUser.email,
          roles: unverifiedUser.roles.map((role: any) => role.role),
        },
        refreshSecret,
        { expiresIn: "7d" },
      );

      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`refreshToken=${unverifiedRefreshToken}`])
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("User not verified");

      // Clean up
      await User.deleteOne({ email: "unverified@example.com" });
    });

    it("should return 401 when user does not exist", async () => {
      const refreshSecret =
        process.env.JWT_REFRESH_TOKEN_SECRET || "fallback_refresh_secret";
      const nonExistentUserRefreshToken = jwt.sign(
        {
          userId: "507f1f77bcf86cd799439011", // Non-existent user ID
          email: "nonexistent@example.com",
          roles: [],
        },
        refreshSecret,
        { expiresIn: "7d" },
      );

      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`refreshToken=${nonExistentUserRefreshToken}`])
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("User not found");
    });
  });

  describe("Token Verification", () => {
    it("should verify refresh token correctly", () => {
      const decoded = verifyRefreshToken(validRefreshToken) as any;
      expect(decoded.userId).toBe(testUser._id.toString());
      expect(decoded.email).toBe(testUser.email);
    });

    it("should throw error for invalid refresh token", () => {
      expect(() => {
        verifyRefreshToken("invalid_token");
      }).toThrow();
    });
  });
});
