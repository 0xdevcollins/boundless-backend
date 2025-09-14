import request from "supertest";
import app from "../app";
import NewsletterSubscriber from "../models/newsletter.model";

describe("Newsletter Subscription API", () => {
  beforeAll(async () => {
    await NewsletterSubscriber.deleteMany({});
  });

  it("should subscribe a new email", async () => {
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "test@example.com", source: "footer-form" });

    expect(res.status).toBe(201);
    expect(res.body.data.subscriber.email).toBe("test@example.com");
  });

  it("should reject duplicate email", async () => {
    await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "dup@example.com" });
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "dup@example.com" });

    expect(res.status).toBe(409);
  });

  it("should reject invalid email", async () => {
    const res = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "invalid-email" });
    expect(res.status).toBe(400);
  });
});
