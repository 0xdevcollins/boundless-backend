// import mongoose from "mongoose";
// import { MongoMemoryServer } from "mongodb-memory-server";
// import Transaction, {
//   TransactionType,
//   TransactionStatus,
// } from "../models/admin.transaction.model";

// let mongoServer: MongoMemoryServer;

// beforeAll(async () => {
//   // Disconnect from any existing connections
//   await mongoose.disconnect();

//   mongoServer = await MongoMemoryServer.create();
//   const mongoUri = mongoServer.getUri();

//   // Connect to the in-memory database
//   await mongoose.connect(mongoUri);
// });

// afterAll(async () => {
//   // Clean up
//   await mongoose.disconnect();
//   await mongoServer.stop();
// });

// beforeEach(async () => {
//   // Clear all collections before each test
//   const collections = mongoose.connection.collections;
//   for (const key in collections) {
//     await collections[key].deleteMany({});
//   }
// });

// describe("Transaction Model Test", () => {
//   const mockTransaction = {
//     projectId: new mongoose.Types.ObjectId(),
//     type: TransactionType.FUNDING,
//     amount: 1000,
//     fromAddress: "0x1234567890abcdef",
//     toAddress: "0xabcdef1234567890",
//     transactionHash:
//       "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
//     status: TransactionStatus.PENDING,
//     timestamp: new Date(),
//   };

//   it("should create & save transaction successfully", async () => {
//     const validTransaction = new Transaction(mockTransaction);
//     const savedTransaction = await validTransaction.save();

//     expect(savedTransaction._id).toBeDefined();
//     expect(savedTransaction.projectId).toBe(mockTransaction.projectId);
//     expect(savedTransaction.type).toBe(mockTransaction.type);
//     expect(savedTransaction.amount).toBe(mockTransaction.amount);
//     expect(savedTransaction.fromAddress).toBe(mockTransaction.fromAddress);
//     expect(savedTransaction.toAddress).toBe(mockTransaction.toAddress);
//     expect(savedTransaction.transactionHash).toBe(
//       mockTransaction.transactionHash,
//     );
//     expect(savedTransaction.status).toBe(mockTransaction.status);
//     expect(savedTransaction.timestamp).toBe(mockTransaction.timestamp);
//   });

//   it("should fail to save transaction without required fields", async () => {
//     const transactionWithoutRequiredField = new Transaction({});
//     let err: mongoose.Error.ValidationError | undefined;

//     try {
//       await transactionWithoutRequiredField.save();
//     } catch (error) {
//       err = error as mongoose.Error.ValidationError;
//     }

//     expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
//   });

//   it("should fail to save transaction with invalid transaction type", async () => {
//     const transactionWithInvalidType = new Transaction({
//       ...mockTransaction,
//       type: "INVALID_TYPE" as TransactionType,
//     });

//     let err: mongoose.Error.ValidationError | undefined;
//     try {
//       await transactionWithInvalidType.save();
//     } catch (error) {
//       err = error as mongoose.Error.ValidationError;
//     }

//     expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
//   });

//   it("should fail to save transaction with invalid status", async () => {
//     const transactionWithInvalidStatus = new Transaction({
//       ...mockTransaction,
//       status: "INVALID_STATUS" as TransactionStatus,
//     });

//     let err: mongoose.Error.ValidationError | undefined;
//     try {
//       await transactionWithInvalidStatus.save();
//     } catch (error) {
//       err = error as mongoose.Error.ValidationError;
//     }

//     expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
//   });

//   it("should fail to save transaction with duplicate transaction hash", async () => {
//     const transaction1 = new Transaction(mockTransaction);
//     await transaction1.save();

//     const transaction2 = new Transaction({
//       ...mockTransaction,
//       projectId: new mongoose.Types.ObjectId(),
//     });

//     let err: { code?: number } | undefined;
//     try {
//       await transaction2.save();
//     } catch (error) {
//       err = error as { code?: number };
//     }

//     expect(err).toBeDefined();
//     expect(err?.code).toBe(11000); // Duplicate key error
//   });

//   it("should update transaction status successfully", async () => {
//     const transaction = new Transaction(mockTransaction);
//     await transaction.save();

//     const updatedTransaction = await Transaction.findByIdAndUpdate(
//       transaction._id,
//       {
//         status: TransactionStatus.CONFIRMED,
//         confirmedAt: new Date(),
//       },
//       { new: true },
//     );

//     expect(updatedTransaction?.status).toBe(TransactionStatus.CONFIRMED);
//     expect(updatedTransaction?.confirmedAt).toBeDefined();
//   });

//   it("should find transactions by projectId and status", async () => {
//     const transaction1 = new Transaction(mockTransaction);
//     const transaction2 = new Transaction({
//       ...mockTransaction,
//       projectId: new mongoose.Types.ObjectId(),
//       transactionHash: "0xuniquehash1",
//     });

//     await Promise.all([transaction1.save(), transaction2.save()]);

//     const transactions = await Transaction.find({
//       projectId: mockTransaction.projectId,
//       status: TransactionStatus.PENDING,
//     });

//     expect(transactions).toHaveLength(1);
//     expect(transactions[0].projectId).toEqual(mockTransaction.projectId);
//   });

//   it("should find transactions by type and status", async () => {
//     const transaction1 = new Transaction(mockTransaction);
//     const transaction2 = new Transaction({
//       ...mockTransaction,
//       type: TransactionType.MILESTONE_RELEASE,
//       transactionHash: "0xuniquehash2",
//     });

//     await Promise.all([transaction1.save(), transaction2.save()]);

//     const transactions = await Transaction.find({
//       type: TransactionType.FUNDING,
//       status: TransactionStatus.PENDING,
//     });

//     expect(transactions).toHaveLength(1);
//     expect(transactions[0].type).toBe(TransactionType.FUNDING);
//   });
// });
