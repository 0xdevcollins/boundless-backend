import "jest-extended";
import mongoose from "mongoose";
import { config } from "../config";
import { MongoMemoryReplSet } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/boundless-test";
process.env.JWT_SECRET = "test_jwt_secret";
process.env.ADMIN_SECRET_KEY =
  "SDUPS7MCL52JTACHZFKDDG3BUHNXU22WEOW2HBX4CIRDGAV6VY6NXWEM";
process.env.STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
process.env.PROJECT_FUNDING_CONTRACT_WASM_HASH = "test_contract_hash";

let mongoServer: MongoMemoryReplSet;

// Connect to test database
beforeAll(async () => {
  // Create a replica set with 1 member to support transactions
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [
      {
        args: [
          "--wiredTigerCacheSizeGB",
          "1",
          "--setParameter",
          "transactionLifetimeLimitSeconds=300",
          "--setParameter",
          "maxTransactionLockRequestTimeoutMillis=5000",
        ],
      },
    ],
  });
  const mongoUri = mongoServer.getUri();

  // Connect with transaction support
  await mongoose.connect(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
  });
}, 30000); // 30 second timeout

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
