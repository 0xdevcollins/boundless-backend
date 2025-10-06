// import { Request, Response } from "express";
// import { body, param, query, validationResult } from "express-validator";
// import { Networks } from "@stellar/stellar-sdk";
// import { contractService } from "../services/contract.service";
// import {
//   UnsignedTransaction,
//   MergedTransaction,
//   ContractMethodConfig,
//   TransactionMergeRequest,
// } from "../types/contract";
// import {
//   sendSuccess,
//   sendError,
//   sendValidationError,
// } from "../utils/apiResponse";

// /**
//  * Contract Controller for handling Soroban smart contract operations
//  */
// export class ContractController {
//   /**
//    * Get network information
//    */
//   static getNetworkInfo = async (req: Request, res: Response) => {
//     try {
//       const { network = "testnet" } = req.query;
//       const stellarNetwork = network as Networks;

//       const networkInfo = contractService.getNetworkInfo(stellarNetwork);

//       sendSuccess(
//         res,
//         networkInfo,
//         "Network information retrieved successfully",
//       );
//     } catch (error) {
//       sendError(
//         res,
//         "Failed to get network information",
//         500,
//         error instanceof Error ? error.message : "Unknown error",
//       );
//     }
//   };

//   /**
//    * Get account information
//    */
//   static getAccountInfo = [
//     param("accountId")
//       .isString()
//       .notEmpty()
//       .withMessage("Account ID is required"),
//     query("network")
//       .optional()
//       .isIn(["testnet", "public", "futurenet"])
//       .withMessage("Invalid network"),

//     async (req: Request, res: Response) => {
//       try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return sendValidationError(res, "Validation failed", errors.array());
//         }

//         const { accountId } = req.params;
//         const { network = "testnet" } = req.query;
//         const stellarNetwork = network as Networks;

//         const accountInfo = await contractService.getAccountInfo(
//           accountId,
//           stellarNetwork,
//         );

//         sendSuccess(
//           res,
//           accountInfo,
//           "Account information retrieved successfully",
//         );
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to get account information",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];

//   /**
//    * Create unsigned transaction
//    */
//   static createUnsignedTransaction = [
//     body("sourceAccount")
//       .isString()
//       .notEmpty()
//       .withMessage("Source account is required"),
//     body("contractId")
//       .isString()
//       .notEmpty()
//       .withMessage("Contract ID is required"),
//     body("method").isString().notEmpty().withMessage("Method is required"),
//     body("parameters")
//       .optional()
//       .isArray()
//       .withMessage("Parameters must be an array"),
//     body("network")
//       .optional()
//       .isIn(["testnet", "public", "futurenet"])
//       .withMessage("Invalid network"),
//     body("fee").optional().isString().withMessage("Fee must be a string"),
//     body("memo").optional().isString().withMessage("Memo must be a string"),

//     async (req: Request, res: Response) => {
//       try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return sendValidationError(res, "Validation failed", errors.array());
//         }

//         const {
//           sourceAccount,
//           contractId,
//           method,
//           parameters = [],
//           network = "testnet",
//           fee,
//           memo,
//         } = req.body;

//         const stellarNetwork = network as Networks;
//         const unsignedTransaction = contractService.createUnsignedTransaction(
//           sourceAccount,
//           contractId,
//           method,
//           parameters,
//           stellarNetwork,
//           fee,
//           memo,
//         );

//         // Validate the transaction
//         if (!contractService.validateTransaction(unsignedTransaction)) {
//           return sendError(res, "Invalid transaction created", 400);
//         }

//         // Serialize for frontend
//         const serializedTransaction =
//           contractService.serializeTransaction(unsignedTransaction);

//         sendSuccess(
//           res,
//           {
//             transaction: unsignedTransaction,
//             serialized: serializedTransaction,
//           },
//           "Unsigned transaction created successfully",
//         );
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to create unsigned transaction",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];

//   /**
//    * Create multiple unsigned transactions
//    */
//   static createMultipleTransactions = [
//     body("sourceAccount")
//       .isString()
//       .notEmpty()
//       .withMessage("Source account is required"),
//     body("operations")
//       .isArray({ min: 1 })
//       .withMessage("At least one operation is required"),
//     body("operations.*.contractId")
//       .isString()
//       .notEmpty()
//       .withMessage("Contract ID is required for each operation"),
//     body("operations.*.method")
//       .isString()
//       .notEmpty()
//       .withMessage("Method is required for each operation"),
//     body("operations.*.parameters")
//       .optional()
//       .isArray()
//       .withMessage("Parameters must be an array"),
//     body("network")
//       .optional()
//       .isIn(["testnet", "public", "futurenet"])
//       .withMessage("Invalid network"),
//     body("fee").optional().isString().withMessage("Fee must be a string"),

//     async (req: Request, res: Response) => {
//       try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return sendValidationError(res, "Validation failed", errors.array());
//         }

//         const {
//           sourceAccount,
//           operations,
//           network = "testnet",
//           fee,
//         } = req.body;

//         const stellarNetwork = network as Networks;
//         const contractOperations: ContractMethodConfig[] = operations.map(
//           (op: any) => ({
//             method: op.method,
//             parameters: op.parameters || [],
//             contractId: op.contractId,
//             description: op.description,
//             requiresAuth: op.requiresAuth,
//             estimatedFee: op.estimatedFee || fee,
//           }),
//         );

//         const unsignedTransactions = contractService.createMultipleTransactions(
//           sourceAccount,
//           contractOperations,
//           stellarNetwork,
//           fee,
//         );

//         // Validate all transactions
//         const validTransactions = unsignedTransactions.filter((tx) =>
//           contractService.validateTransaction(tx),
//         );

//         if (validTransactions.length !== unsignedTransactions.length) {
//           return sendError(res, "Some transactions are invalid", 400);
//         }

//         // Serialize for frontend
//         const serializedTransactions = validTransactions.map((tx) =>
//           contractService.serializeTransaction(tx),
//         );

//         sendSuccess(
//           res,
//           {
//             transactions: validTransactions,
//             serialized: serializedTransactions,
//             count: validTransactions.length,
//           },
//           "Multiple unsigned transactions created successfully",
//         );
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to create multiple transactions",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];

//   /**
//    * Merge transactions
//    */
//   static mergeTransactions = [
//     body("transactions")
//       .isArray({ min: 1 })
//       .withMessage("At least one transaction is required"),
//     body("mergeStrategy")
//       .optional()
//       .isIn(["sequential", "parallel"])
//       .withMessage("Invalid merge strategy"),
//     body("metadata")
//       .optional()
//       .isObject()
//       .withMessage("Metadata must be an object"),

//     async (req: Request, res: Response) => {
//       try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return sendValidationError(res, "Validation failed", errors.array());
//         }

//         const {
//           transactions,
//           mergeStrategy = "sequential",
//           metadata,
//         } = req.body;

//         // Deserialize transactions if they are strings
//         const deserializedTransactions: UnsignedTransaction[] =
//           transactions.map((tx: any) => {
//             if (typeof tx === "string") {
//               return contractService.deserializeTransaction(
//                 tx,
//               ) as UnsignedTransaction;
//             }
//             return tx;
//           });

//         // Validate all transactions
//         const validTransactions = deserializedTransactions.filter((tx) =>
//           contractService.validateTransaction(tx),
//         );

//         if (validTransactions.length !== deserializedTransactions.length) {
//           return sendError(res, "Some transactions are invalid", 400);
//         }

//         const mergedTransaction = contractService.mergeTransactions(
//           validTransactions,
//           mergeStrategy,
//         );

//         // Serialize for frontend
//         const serializedMergedTransaction =
//           contractService.serializeTransaction(mergedTransaction);

//         sendSuccess(
//           res,
//           {
//             mergedTransaction,
//             serialized: serializedMergedTransaction,
//             originalCount: validTransactions.length,
//           },
//           "Transactions merged successfully",
//         );
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to merge transactions",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];

//   /**
//    * Simulate transaction
//    */
//   static simulateTransaction = [
//     body("transaction").isObject().withMessage("Transaction is required"),
//     body("network")
//       .optional()
//       .isIn(["testnet", "public", "futurenet"])
//       .withMessage("Invalid network"),

//     async (req: Request, res: Response) => {
//       try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return sendValidationError(res, "Validation failed", errors.array());
//         }

//         const { transaction, network = "testnet" } = req.body;
//         const stellarNetwork = network as Networks;

//         // Deserialize transaction if it's a string
//         let deserializedTransaction: UnsignedTransaction | MergedTransaction;
//         if (typeof transaction === "string") {
//           deserializedTransaction =
//             contractService.deserializeTransaction(transaction);
//         } else {
//           deserializedTransaction = transaction;
//         }

//         const simulation = await contractService.simulateTransaction(
//           deserializedTransaction,
//           stellarNetwork,
//         );

//         sendSuccess(res, simulation, "Transaction simulation completed");
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to simulate transaction",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];

//   /**
//    * Submit signed transaction
//    */
//   static submitTransaction = [
//     body("signedTransaction")
//       .isObject()
//       .withMessage("Signed transaction is required"),
//     body("network")
//       .optional()
//       .isIn(["testnet", "public", "futurenet"])
//       .withMessage("Invalid network"),

//     async (req: Request, res: Response) => {
//       try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return sendValidationError(res, "Validation failed", errors.array());
//         }

//         const { signedTransaction, network = "testnet" } = req.body;
//         const stellarNetwork = network as Networks;

//         const result = await contractService.submitTransaction(
//           signedTransaction,
//           stellarNetwork,
//         );

//         if (result.success) {
//           sendSuccess(res, result, "Transaction submitted successfully");
//         } else {
//           sendError(res, "Transaction submission failed", 400, result.error);
//         }
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to submit transaction",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];

//   /**
//    * Call contract method (read-only)
//    */
//   static callContractMethod = [
//     body("contractId")
//       .isString()
//       .notEmpty()
//       .withMessage("Contract ID is required"),
//     body("method").isString().notEmpty().withMessage("Method is required"),
//     body("parameters")
//       .optional()
//       .isArray()
//       .withMessage("Parameters must be an array"),
//     body("network")
//       .optional()
//       .isIn(["testnet", "public", "futurenet"])
//       .withMessage("Invalid network"),

//     async (req: Request, res: Response) => {
//       try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return sendValidationError(res, "Validation failed", errors.array());
//         }

//         const {
//           contractId,
//           method,
//           parameters = [],
//           network = "testnet",
//         } = req.body;

//         const stellarNetwork = network as Networks;
//         const result = await contractService.callContractMethod(
//           contractId,
//           method,
//           parameters,
//           stellarNetwork,
//         );

//         if (result.success) {
//           sendSuccess(res, result, "Contract method called successfully");
//         } else {
//           sendError(res, "Contract method call failed", 400, result.error);
//         }
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to call contract method",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];

//   /**
//    * Get contract information
//    */
//   static getContractInfo = [
//     param("contractId")
//       .isString()
//       .notEmpty()
//       .withMessage("Contract ID is required"),
//     query("network")
//       .optional()
//       .isIn(["testnet", "public", "futurenet"])
//       .withMessage("Invalid network"),

//     async (req: Request, res: Response) => {
//       try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return sendValidationError(res, "Validation failed", errors.array());
//         }

//         const { contractId } = req.params;
//         const { network = "testnet" } = req.query;
//         const stellarNetwork = network as Networks;

//         const contractInfo = await contractService.getContractInfo(
//           contractId,
//           stellarNetwork,
//         );

//         sendSuccess(
//           res,
//           contractInfo,
//           "Contract information retrieved successfully",
//         );
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to get contract information",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];

//   /**
//    * Get network status
//    */
//   static getNetworkStatus = [
//     query("network")
//       .optional()
//       .isIn(["testnet", "public", "futurenet"])
//       .withMessage("Invalid network"),

//     async (req: Request, res: Response) => {
//       try {
//         const { network = "testnet" } = req.query;
//         const stellarNetwork = network as Networks;

//         const status = await contractService.getNetworkStatus(stellarNetwork);

//         sendSuccess(res, status, "Network status retrieved successfully");
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to get network status",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];

//   /**
//    * Deploy contract
//    */
//   static deployContract = [
//     body("wasmBuffer")
//       .isString()
//       .notEmpty()
//       .withMessage("WASM buffer is required"),
//     body("sourceAccount")
//       .isString()
//       .notEmpty()
//       .withMessage("Source account is required"),
//     body("network")
//       .optional()
//       .isIn(["testnet", "public", "futurenet"])
//       .withMessage("Invalid network"),
//     body("fee").optional().isString().withMessage("Fee must be a string"),

//     async (req: Request, res: Response) => {
//       try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//           return sendValidationError(res, "Validation failed", errors.array());
//         }

//         const {
//           wasmBuffer,
//           sourceAccount,
//           network = "testnet",
//           fee,
//         } = req.body;

//         const stellarNetwork = network as Networks;
//         const wasmBufferObj = Buffer.from(wasmBuffer, "base64");

//         const result = await contractService.deployContract(
//           wasmBufferObj,
//           sourceAccount,
//           stellarNetwork,
//           fee,
//         );

//         if (result.success) {
//           sendSuccess(res, result, "Contract deployed successfully");
//         } else {
//           sendError(res, "Contract deployment failed", 400, result.error);
//         }
//       } catch (error) {
//         sendError(
//           res,
//           "Failed to deploy contract",
//           500,
//           error instanceof Error ? error.message : "Unknown error",
//         );
//       }
//     },
//   ];
// }
