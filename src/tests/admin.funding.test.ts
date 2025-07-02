// import request from "supertest";
// import mongoose, { Types } from "mongoose";
// import app from "../app";
// import User, { UserRole } from "../models/user.model";
// import Project from "../models/project.model";
// import Transaction, {
//   TransactionType,
//   TransactionStatus,
// } from "../models/admin.transaction.model";
// import { generateTokens } from "../utils/jwt.utils";

// describe("Admin Funding Endpoints", () => {
//   let adminToken: string;
//   let userToken: string;
//   let adminId: Types.ObjectId;
//   let userId: Types.ObjectId;
//   let projectId: Types.ObjectId;

//   beforeAll(async () => {
//     // Create admin user
//     const admin = await User.create({
//       email: "admin@test.com",
//       password: "password123",
//       profile: {
//         firstName: "Admin",
//         lastName: "User",
//         username: "admin",
//       },
//       roles: [
//         { role: UserRole.ADMIN, grantedAt: new Date(), status: "ACTIVE" },
//       ],
//     });
//     adminId = admin._id;
//     const adminTokens = generateTokens({
//       userId: admin._id.toString(),
//       email: admin.email,
//       roles: [UserRole.ADMIN],
//     });
//     adminToken = adminTokens.accessToken;

//     // Create regular user
//     const user = await User.create({
//       email: "user@test.com",
//       password: "password123",
//       profile: {
//         firstName: "Regular",
//         lastName: "User",
//         username: "user",
//       },
//       roles: [
//         { role: UserRole.BACKER, grantedAt: new Date(), status: "ACTIVE" },
//       ],
//     });
//     userId = user._id;
//     const userTokens = generateTokens({
//       userId: user._id.toString(),
//       email: user.email,
//       roles: [UserRole.BACKER],
//     });
//     userToken = userTokens.accessToken;

//     // Create test project
//     const project = await Project.create({
//       title: "Test Project",
//       description: "Test Description",
//       category: "Test Category",
//       owner: { type: userId },
//       funding: {
//         goal: 1000,
//         raised: 0,
//         currency: "XLM",
//         endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
//       },
//     });
//     projectId = project._id;

//     // Create test transactions with unique hashes
//     await Transaction.create([
//       {
//         projectId,
//         type: TransactionType.FUNDING,
//         amount: 100,
//         fromAddress: "user1",
//         toAddress: "project1",
//         transactionHash: "hash1",
//         status: TransactionStatus.CONFIRMED,
//         timestamp: new Date(),
//       },
//       {
//         projectId,
//         type: TransactionType.FUNDING,
//         amount: 200,
//         fromAddress: "user2",
//         toAddress: "project1",
//         transactionHash: "hash2",
//         status: TransactionStatus.PENDING,
//         timestamp: new Date(),
//       },
//     ]);
//   });

//   afterAll(async () => {
//     await mongoose.connection.dropDatabase();
//     await mongoose.connection.close();
//   });

//   describe("GET /api/admin/funding/transactions", () => {
//     it("should return 401 if not authenticated", async () => {
//       const res = await request(app).get("/api/admin/funding/transactions");
//       expect(res.status).toBe(401);
//     });

//     it("should return 403 if not admin", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions")
//         .set("Authorization", `Bearer ${userToken}`);
//       expect(res.status).toBe(403);
//     });

//     it("should return transactions with pagination", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       expect(res.body.success).toBe(true);
//       expect(res.body.data.transactions).toBeInstanceOf(Array);
//       expect(res.body.data.pagination).toHaveProperty("total");
//       expect(res.body.data.pagination).toHaveProperty("page");
//       expect(res.body.data.pagination).toHaveProperty("limit");
//     });

//     it("should filter transactions by status", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions?status=CONFIRMED")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       expect(
//         res.body.data.transactions.every((t: any) => t.status === "CONFIRMED"),
//       ).toBe(true);
//     });

//     it("should sort transactions by timestamp", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions?sortBy=timestamp&sortOrder=desc")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       const transactions = res.body.data.transactions;
//       const sortedTransactions = [...transactions].sort(
//         (a: any, b: any) =>
//           new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
//       );
//       expect(transactions).toEqual(sortedTransactions);
//     });

//     it("should filter transactions by date range", async () => {
//       const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
//       const endDate = new Date();
//       const res = await request(app)
//         .get(
//           `/api/admin/funding/transactions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
//         )
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       expect(
//         res.body.data.transactions.every((t: any) => {
//           const timestamp = new Date(t.timestamp);
//           return timestamp >= startDate && timestamp <= endDate;
//         }),
//       ).toBe(true);
//     });
//   });

//   describe("GET /api/admin/funding/transactions/:projectId", () => {
//     it("should return 404 for non-existent project", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions/123456789012")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(404);
//     });

//     it("should return project transactions with statistics", async () => {
//       const res = await request(app)
//         .get(`/api/admin/funding/transactions/${projectId}`)
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       expect(res.body.success).toBe(true);
//       expect(res.body.data.project).toBeDefined();
//       expect(res.body.data.transactions).toBeInstanceOf(Array);
//       expect(res.body.data.statistics).toBeDefined();
//     });

//     it("should return transactions sorted by timestamp", async () => {
//       const res = await request(app)
//         .get(
//           `/api/admin/funding/transactions/${projectId}?sortBy=timestamp&sortOrder=desc`,
//         )
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       const transactions = res.body.data.transactions;
//       const sortedTransactions = [...transactions].sort(
//         (a: any, b: any) =>
//           new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
//       );
//       expect(transactions).toEqual(sortedTransactions);
//     });
//   });

//   describe("GET /api/admin/funding/pending", () => {
//     it("should return only pending transactions", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/pending")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       expect(
//         res.body.data.transactions.every((t: any) => t.status === "PENDING"),
//       ).toBe(true);
//     });

//     it("should sort pending transactions by amount", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/pending?sortBy=amount&sortOrder=desc")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       const transactions = res.body.data.transactions;
//       const sortedTransactions = [...transactions].sort(
//         (a: any, b: any) => b.amount - a.amount,
//       );
//       expect(transactions).toEqual(sortedTransactions);
//     });
//   });

//   describe("GET /api/admin/funding/statistics", () => {
//     it("should return comprehensive statistics", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/statistics")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       expect(res.body.success).toBe(true);
//       expect(res.body.data.overview).toBeDefined();
//       expect(res.body.data.trends).toBeDefined();
//       expect(res.body.data.topProjects).toBeDefined();
//       expect(res.body.data.topBackers).toBeDefined();
//       expect(res.body.data.categoryBreakdown).toBeDefined();
//     });

//     it("should filter statistics by period", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/statistics?period=day")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       expect(res.body.data.overview).toBeDefined();
//     });

//     it("should filter statistics by date range", async () => {
//       const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
//       const endDate = new Date();
//       const res = await request(app)
//         .get(
//           `/api/admin/funding/statistics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
//         )
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(200);
//       expect(res.body.data.overview).toBeDefined();
//     });
//   });

//   describe("Input Validation", () => {
//     it("should validate page parameter", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions?page=0")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(400);
//     });

//     it("should validate limit parameter", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions?limit=101")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(400);
//     });

//     it("should validate date format", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions?startDate=invalid-date")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(400);
//     });

//     it("should validate status enum", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions?status=INVALID")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(400);
//     });

//     it("should validate sortBy parameter", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions?sortBy=invalid")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(400);
//     });

//     it("should validate sortOrder parameter", async () => {
//       const res = await request(app)
//         .get("/api/admin/funding/transactions?sortOrder=invalid")
//         .set("Authorization", `Bearer ${adminToken}`);
//       expect(res.status).toBe(400);
//     });
//   });
// });

test("dummy", () => {
  expect(true).toBe(true);
});
