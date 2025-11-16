import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Waitlist, { WaitlistStatus } from "../models/waitlist.model.js";
import { createTestUser } from "./testHelpers.js";
import { UserRole } from "../models/user.model.js";

// Mock the email utility to avoid sending real emails during tests
jest.mock("../utils/email.utils", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

describe("Waitlist API", () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Create test user and get auth token
    testUser = await createTestUser({
      email: "christroa01@gmail.com",
      role: UserRole.ADMIN,
    });

    // Get token from the created test user
    authToken = testUser.token;
  });

  beforeEach(async () => {
    // Clear waitlist before each test
    await Waitlist.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("POST /api/waitlist/subscribe", () => {
    it("should subscribe a new email to waitlist", async () => {
      const response = await request(app).post("/api/waitlist/subscribe").send({
        email: "collinschristroa@gmail.com",
        firstName: "John",
        lastName: "Doe",
        source: "landing_page",
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriber.email).toBe(
        "collinschristroa@gmail.com",
      );
      expect(response.body.data.subscriber.status).toBe(WaitlistStatus.ACTIVE);

      // Check if email was sent (you might need to mock this in tests)
      const subscriber = await Waitlist.findOne({
        email: "collinschristroa@gmail.com",
      });
      expect(subscriber).toBeTruthy();
      expect(subscriber?.unsubscribeToken).toBeTruthy();
    });

    it("should handle duplicate email subscription", async () => {
      // First subscription
      await request(app).post("/api/waitlist/subscribe").send({
        email: "collinschristroa@gmail.com",
        firstName: "John",
      });

      // Second subscription with same email
      const response = await request(app).post("/api/waitlist/subscribe").send({
        email: "collinschristroa@gmail.com",
        firstName: "Jane",
      });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("should validate email format", async () => {
      const response = await request(app).post("/api/waitlist/subscribe").send({
        email: "invalid-email",
        firstName: "John",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should handle UTM parameters", async () => {
      const response = await request(app)
        .post(
          "/api/waitlist/subscribe?utm_source=google&utm_medium=cpc&utm_campaign=launch",
        )
        .send({
          email: "collinschristroa@gmail.com",
          firstName: "John",
        });

      expect(response.status).toBe(201);

      const subscriber = await Waitlist.findOne({
        email: "collinschristroa@gmail.com",
      });
      expect(subscriber?.metadata?.utmSource).toBe("google");
      expect(subscriber?.metadata?.utmMedium).toBe("cpc");
      expect(subscriber?.metadata?.utmCampaign).toBe("launch");
    });
  });

  describe("GET /api/waitlist/unsubscribe/:token", () => {
    it("should unsubscribe with valid token", async () => {
      const subscriber = await Waitlist.create({
        email: "collinschristroa@gmail.com",
        firstName: "John",
        status: WaitlistStatus.ACTIVE,
        unsubscribeToken: "test-token-123",
      });

      const response = await request(app).get(
        `/api/waitlist/unsubscribe/${subscriber.unsubscribeToken}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriber.status).toBe(
        WaitlistStatus.UNSUBSCRIBED,
      );

      const updatedSubscriber = await Waitlist.findById(subscriber._id);
      expect(updatedSubscriber?.status).toBe(WaitlistStatus.UNSUBSCRIBED);
      expect(updatedSubscriber?.unsubscribedAt).toBeTruthy();
      expect(updatedSubscriber?.isActive).toBe(false);
    });

    it("should handle invalid unsubscribe token", async () => {
      const response = await request(app).get(
        "/api/waitlist/unsubscribe/invalid-token",
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/waitlist/stats", () => {
    it("should return waitlist statistics", async () => {
      // Create test data
      await Waitlist.create([
        {
          email: "ezugwueucharia2016@gmail.com",
          status: WaitlistStatus.ACTIVE,
        },
        { email: "christroa01@gmail.com", status: WaitlistStatus.ACTIVE },
        {
          email: "0xdevcollins@gmail.com",
          status: WaitlistStatus.UNSUBSCRIBED,
        },
        { email: "ngwunwaka@gmail.com", status: WaitlistStatus.BOUNCED },
      ]);

      const response = await request(app).get("/api/waitlist/stats");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats.total).toBe(4);
      expect(response.body.data.stats.pending).toBe(0);
      expect(response.body.data.stats.confirmed).toBe(2);
      expect(response.body.data.stats.unsubscribed).toBe(1);
      expect(response.body.data.stats.bounced).toBe(1);
      expect(response.body.data.stats.active).toBe(2);
    });
  });

  describe("GET /api/waitlist/subscribers", () => {
    it("should return subscribers with pagination", async () => {
      // Create test subscribers
      await Waitlist.create([
        {
          email: "ezugwueucharia2016@gmail.com",
          status: WaitlistStatus.ACTIVE,
        },
        { email: "christroa01@gmail.com", status: WaitlistStatus.ACTIVE },
        { email: "0xdevcollins@gmail.com", status: WaitlistStatus.ACTIVE },
      ]);

      const response = await request(app)
        .get("/api/waitlist/subscribers?page=1&limit=2")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscribers).toHaveLength(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });

    it("should filter by status", async () => {
      await Waitlist.create([
        {
          email: "ezugwueucharia2016@gmail.com",
          status: WaitlistStatus.ACTIVE,
        },
        { email: "christroa01@gmail.com", status: WaitlistStatus.ACTIVE },
      ]);

      const response = await request(app)
        .get("/api/waitlist/subscribers?status=ACTIVE")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.subscribers).toHaveLength(2);
      expect(response.body.data.subscribers[0].status).toBe(
        WaitlistStatus.ACTIVE,
      );
    });

    it("should search subscribers", async () => {
      await Waitlist.create([
        { email: "john@example.com", firstName: "John", lastName: "Doe" },
        { email: "jane@example.com", firstName: "Jane", lastName: "Smith" },
      ]);

      const response = await request(app)
        .get("/api/waitlist/subscribers?search=john")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.subscribers).toHaveLength(1);
      expect(response.body.data.subscribers[0].email).toBe("john@example.com");
    });
  });

  describe("POST /api/waitlist/subscribers/:id/tags", () => {
    it("should add tags to subscriber", async () => {
      const subscriber = await Waitlist.create({
        email: "collinschristroa@gmail.com",
        status: WaitlistStatus.ACTIVE,
      });

      const response = await request(app)
        .post(`/api/waitlist/subscribers/${subscriber._id}/tags`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ tags: ["vip", "early-adopter"] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriber.tags).toContain("vip");
      expect(response.body.data.subscriber.tags).toContain("early-adopter");
    });
  });

  describe("DELETE /api/waitlist/subscribers/:id/tags", () => {
    it("should remove tags from subscriber", async () => {
      const subscriber = await Waitlist.create({
        email: "collinschristroa@gmail.com",
        status: WaitlistStatus.ACTIVE,
        tags: ["vip", "early-adopter", "beta-tester"],
      });

      const response = await request(app)
        .delete(`/api/waitlist/subscribers/${subscriber._id}/tags`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ tags: ["vip"] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscriber.tags).not.toContain("vip");
      expect(response.body.data.subscriber.tags).toContain("early-adopter");
      expect(response.body.data.subscriber.tags).toContain("beta-tester");
    });
  });

  describe("GET /api/waitlist/export", () => {
    it("should export subscribers as CSV", async () => {
      await Waitlist.create([
        {
          email: "ezugwueucharia2016@gmail.com",
          firstName: "John",
          status: WaitlistStatus.ACTIVE,
        },
        {
          email: "christroa01@gmail.com",
          firstName: "Jane",
          status: WaitlistStatus.ACTIVE,
        },
      ]);

      const response = await request(app)
        .get("/api/waitlist/export")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("text/csv");
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.text).toContain("ezugwueucharia2016@gmail.com");
      expect(response.text).toContain("christroa01@gmail.com");
    });
  });

  describe("POST /api/waitlist/webhook/bounce", () => {
    it("should handle bounced email", async () => {
      const subscriber = await Waitlist.create({
        email: "bounced@example.com",
        status: WaitlistStatus.ACTIVE,
      });

      const response = await request(app)
        .post("/api/waitlist/webhook/bounce")
        .send({ email: "bounced@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const updatedSubscriber = await Waitlist.findOne({
        email: "bounced@example.com",
      });
      expect(updatedSubscriber?.status).toBe(WaitlistStatus.BOUNCED);
      expect(updatedSubscriber?.isActive).toBe(false);
    });
  });

  describe("POST /api/waitlist/webhook/spam", () => {
    it("should handle spam report", async () => {
      const subscriber = await Waitlist.create({
        email: "spam@example.com",
        status: WaitlistStatus.ACTIVE,
      });

      const response = await request(app)
        .post("/api/waitlist/webhook/spam")
        .send({ email: "spam@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const updatedSubscriber = await Waitlist.findOne({
        email: "spam@example.com",
      });
      expect(updatedSubscriber?.status).toBe(WaitlistStatus.SPAM);
      expect(updatedSubscriber?.isActive).toBe(false);
    });
  });
});
