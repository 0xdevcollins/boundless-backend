import mongoose from "mongoose";
import { config } from "../config";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/boundless-test";
process.env.JWT_SECRET = "test_jwt_secret";

// Connect to test database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI as string);
});

// Clear database between tests
beforeEach(async () => {
  if (mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});

// Close database connection after all tests
afterAll(async () => {
  await mongoose.connection.close();
});
