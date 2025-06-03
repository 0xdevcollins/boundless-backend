import "jest-extended";
import mongoose from "mongoose";
import { config } from "../config";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/boundless-test";
process.env.JWT_SECRET = "test_jwt_secret";

let mongoServer: MongoMemoryServer;

// Connect to test database
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

// Clear database between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Close database connection after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
