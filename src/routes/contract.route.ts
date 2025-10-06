// import { Router } from "express";
// import { ContractController } from "../controllers/contract.controller";
// import { authMiddleware } from "../utils/jwt.utils";

// const router = Router();

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     UnsignedTransaction:
//  *       type: object
//  *       properties:
//  *         transaction:
//  *           type: object
//  *           description: Stellar transaction object
//  *         networkPassphrase:
//  *           type: string
//  *           description: Network passphrase
//  *         contractId:
//  *           type: string
//  *           description: Contract ID
//  *         operation:
//  *           type: string
//  *           description: Contract operation
//  *         parameters:
//  *           type: array
//  *           description: Operation parameters
//  *         metadata:
//  *           type: object
//  *           description: Transaction metadata
//  *
//  *     MergedTransaction:
//  *       type: object
//  *       properties:
//  *         transaction:
//  *           type: object
//  *           description: Merged Stellar transaction
//  *         networkPassphrase:
//  *           type: string
//  *           description: Network passphrase
//  *         operations:
//  *           type: array
//  *           description: Array of operations
//  *         metadata:
//  *           type: object
//  *           description: Transaction metadata
//  *
//  *     ContractCallResult:
//  *       type: object
//  *       properties:
//  *         success:
//  *           type: boolean
//  *         result:
//  *           type: object
//  *         error:
//  *           type: string
//  *         transactionHash:
//  *           type: string
//  *         cost:
//  *           type: object
//  *           properties:
//  *             cpuInstructions:
//  *               type: number
//  *             memoryBytes:
//  *               type: number
//  *             fee:
//  *               type: string
//  *
//  *     NetworkInfo:
//  *       type: object
//  *       properties:
//  *         network:
//  *           type: string
//  *         networkPassphrase:
//  *           type: string
//  *         rpcUrl:
//  *           type: string
//  *         horizonUrl:
//  *           type: string
//  *         chainId:
//  *           type: string
//  *
//  *     AccountInfo:
//  *       type: object
//  *       properties:
//  *         accountId:
//  *           type: string
//  *         sequence:
//  *           type: string
//  *         balance:
//  *           type: string
//  *         subentryCount:
//  *           type: number
//  *         flags:
//  *           type: object
//  *           properties:
//  *             authRequired:
//  *               type: boolean
//  *             authRevocable:
//  *               type: boolean
//  *             authImmutable:
//  *               type: boolean
//  *             authClawbackEnabled:
//  *               type: boolean
//  */

// /**
//  * @swagger
//  * /api/contracts/network-info:
//  *   get:
//  *     summary: Get network informationß
//  *     tags: [Contracts]
//  *     parameters:
//  *       - in: query
//  *         name: network
//  *         schema:
//  *           type: string
//  *           enum: [testnet, public, futurenet]
//  *         description: Network to get information for
//  *     responses:
//  *       200:
//  *         description: Network information retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 message:
//  *                   type: string
//  *                 data:
//  *                   $ref: '#/components/schemas/NetworkInfo'
//  */
// router.get("/network-info", ContractController.getNetworkInfo);

// /**
//  * @swagger
//  * /api/contracts/account/{accountId}:
//  *   get:
//  *     summary: Get account information
//  *     tags: [Contracts]
//  *     parameters:
//  *       - in: path
//  *         name: accountId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Account ID
//  *       - in: query
//  *         name: network
//  *         schema:
//  *           type: string
//  *           enum: [testnet, public, futurenet]
//  *         description: Network to query
//  *     responses:
//  *       200:
//  *         description: Account information retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 message:
//  *                   type: string
//  *                 data:
//  *                   $ref: '#/components/schemas/AccountInfo'
//  */
// router.get("/account/:accountId", ContractController.getAccountInfo);

// /**
//  * @swagger
//  * /api/contracts/transaction/create:
//  *   post:
//  *     summary: Create unsigned transaction
//  *     tags: [Contracts]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - sourceAccount
//  *               - contractId
//  *               - method
//  *             properties:
//  *               sourceAccount:
//  *                 type: string
//  *                 description: Source account public key
//  *               contractId:
//  *                 type: string
//  *                 description: Contract ID
//  *               method:
//  *                 type: string
//  *                 description: Contract method to call
//  *               parameters:
//  *                 type: array
//  *                 description: Method parameters
//  *               network:
//  *                 type: string
//  *                 enum: [testnet, public, futurenet]
//  *                 description: Network to use
//  *               fee:
//  *                 type: string
//  *                 description: Transaction fee
//  *               memo:
//  *                 type: string
//  *                 description: Transaction memo
//  *     responses:
//  *       200:
//  *         description: Unsigned transaction created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 message:
//  *                   type: string
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     transaction:
//  *                       $ref: '#/components/schemas/UnsignedTransaction'
//  *                     serialized:
//  *                       type: string
//  *                       description: Serialized transaction for frontend
//  */
// router.post(
//   "/transaction/create",
//   ContractController.createUnsignedTransaction,
// );

// /**
//  * @swagger
//  * /api/contracts/transaction/create-multiple:
//  *   post:
//  *     summary: Create multiple unsigned transactions
//  *     tags: [Contracts]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - sourceAccount
//  *               - operations
//  *             properties:
//  *               sourceAccount:
//  *                 type: string
//  *                 description: Source account public key
//  *               operations:
//  *                 type: array
//  *                 items:
//  *                   type: object
//  *                   required:
//  *                     - contractId
//  *                     - method
//  *                   properties:
//  *                     contractId:
//  *                       type: string
//  *                     method:
//  *                       type: string
//  *                     parameters:
//  *                       type: array
//  *                     description:
//  *                       type: string
//  *                     requiresAuth:
//  *                       type: boolean
//  *                     estimatedFee:
//  *                       type: string
//  *               network:
//  *                 type: string
//  *                 enum: [testnet, public, futurenet]
//  *               fee:
//  *                 type: string
//  *     responses:
//  *       200:
//  *         description: Multiple unsigned transactions created successfully
//  */
// router.post(
//   "/transaction/create-multiple",
//   ContractController.createMultipleTransactions,
// );

// /**
//  * @swagger
//  * /api/contracts/transaction/merge:
//  *   post:
//  *     summary: Merge multiple transactions into one
//  *     tags: [Contracts]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - transactions
//  *             properties:
//  *               transactions:
//  *                 type: array
//  *                 items:
//  *                   $ref: '#/components/schemas/UnsignedTransaction'
//  *               mergeStrategy:
//  *                 type: string
//  *                 enum: [sequential, parallel]
//  *                 description: How to merge transactions
//  *               metadata:
//  *                 type: object
//  *                 description: Additional metadata
//  *     responses:
//  *       200:
//  *         description: Transactions merged successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 message:
//  *                   type: string
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     mergedTransaction:
//  *                       $ref: '#/components/schemas/MergedTransaction'
//  *                     serialized:
//  *                       type: string
//  *                     originalCount:
//  *                       type: number
//  */
// router.post("/transaction/merge", ContractController.mergeTransactions);

// /**
//  * @swagger
//  * /api/contracts/transaction/simulate:
//  *   post:
//  *     summary: Simulate transaction execution
//  *     tags: [Contracts]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - transaction
//  *             properties:
//  *               transaction:
//  *                 oneOf:
//  *                   - $ref: '#/components/schemas/UnsignedTransaction'
//  *                   - $ref: '#/components/schemas/MergedTransaction'
//  *               network:
//  *                 type: string
//  *                 enum: [testnet, public, futurenet]
//  *     responses:
//  *       200:
//  *         description: Transaction simulation completed
//  */
// router.post("/transaction/simulate", ContractController.simulateTransaction);

// /**
//  * @swagger
//  * /api/contracts/transaction/submit:
//  *   post:
//  *     summary: Submit signed transaction to network
//  *     tags: [Contracts]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - signedTransaction
//  *             properties:
//  *               signedTransaction:
//  *                 type: object
//  *                 description: Signed transaction object
//  *               network:
//  *                 type: string
//  *                 enum: [testnet, public, futurenet]
//  *     responses:
//  *       200:
//  *         description: Transaction submitted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 message:
//  *                   type: string
//  *                 data:
//  *                   $ref: '#/components/schemas/ContractCallResult'
//  */
// router.post("/transaction/submit", ContractController.submitTransaction);

// /**
//  * @swagger
//  * /api/contracts/call:
//  *   post:
//  *     summary: Call contract method (read-only)
//  *     tags: [Contracts]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - contractId
//  *               - method
//  *             properties:
//  *               contractId:
//  *                 type: string
//  *                 description: Contract ID
//  *               method:
//  *                 type: string
//  *                 description: Method to call
//  *               parameters:
//  *                 type: array
//  *                 description: Method parameters
//  *               network:
//  *                 type: string
//  *                 enum: [testnet, public, futurenet]
//  *     responses:
//  *       200:
//  *         description: Contract method called successfully
//  */
// router.post("/call", ContractController.callContractMethod);

// /**
//  * @swagger
//  * /api/contracts/{contractId}:
//  *   get:
//  *     summary: Get contract information
//  *     tags: [Contracts]
//  *     parameters:
//  *       - in: path
//  *         name: contractId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Contract ID
//  *       - in: query
//  *         name: network
//  *         schema:
//  *           type: string
//  *           enum: [testnet, public, futurenet]
//  *         description: Network to query
//  *     responses:
//  *       200:
//  *         description: Contract information retrieved successfully
//  */
// router.get("/:contractId", ContractController.getContractInfo);

// /**
//  * @swagger
//  * /api/contracts/network/status:
//  *   get:
//  *     summary: Get network status
//  *     tags: [Contracts]
//  *     parameters:
//  *       - in: query
//  *         name: network
//  *         schema:
//  *           type: string
//  *           enum: [testnet, public, futurenet]
//  *         description: Network to check status for
//  *     responses:
//  *       200:
//  *         description: Network status retrieved successfully
//  */
// router.get("/network/status", ContractController.getNetworkStatus);

// /**
//  * @swagger
//  * /api/contracts/deploy:
//  *   post:
//  *     summary: Deploy contract to network
//  *     tags: [Contracts]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - wasmBuffer
//  *               - sourceAccount
//  *             properties:
//  *               wasmBuffer:
//  *                 type: string
//  *                 description: Base64 encoded WASM buffer
//  *               sourceAccount:
//  *                 type: string
//  *                 description: Source account for deployment
//  *               network:
//  *                 type: string
//  *                 enum: [testnet, public, futurenet]
//  *               fee:
//  *                 type: string
//  *                 description: Deployment fee
//  *     responses:
//  *       200:
//  *         description: Contract deployed successfully
//  */
// router.post("/deploy", authMiddleware, ContractController.deployContract);

// export default router;
