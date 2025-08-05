import request from "supertest";
import app from "../app";
import { createTestUser, cleanupTestData } from "./testHelpers";

describe("Auth with Cookies and Bearer Tokens", () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    // Create a test user
    const userData = await createTestUser({
      email: "cookie-test@example.com",
      password: "TestPassword123!",
      isVerified: true,
    });
    testUser = userData.user;
    authToken = userData.token;
  });

  describe("GET /api/auth/me", () => {
    it("should authenticate with Bearer token in Authorization header", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email);
    });

    it("should authenticate with token in cookie", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `token=${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email);
    });

    it("should authenticate with accessToken in cookie", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `accessToken=${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email);
    });

    it("should fail without authentication", async () => {
      const response = await request(app).get("/api/auth/me").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Authentication required");
    });

    it("should fail with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Not authorized, token failed");
    });
  });

  describe("Login with cookie setting", () => {
    it("should set cookies when user logs in", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "TestPassword123!",
        })
        .expect(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Check that cookies are set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();

      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const tokenCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith("accessToken="),
      );
      const refreshTokenCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith("refreshToken="),
      );

      expect(tokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeDefined();
      expect(tokenCookie).toContain("HttpOnly");
      expect(refreshTokenCookie).toContain("HttpOnly");
    });
  });

  describe("Logout with cookie clearing", () => {
    it("should clear cookies when user logs out", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check that cookies are cleared
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();

      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const tokenCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith("accessToken="),
      );
      const refreshTokenCookie = cookieArray.find((cookie: string) =>
        cookie.startsWith("refreshToken="),
      );

      expect(tokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeDefined();
      expect(tokenCookie).toContain("Expires=Thu, 01 Jan 1970");
      expect(refreshTokenCookie).toContain("Expires=Thu, 01 Jan 1970");
    });
  });
});
