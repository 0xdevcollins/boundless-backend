import express from "express";
import { protect, admin } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  listTransactions,
  getProjectTransactions,
  getPendingTransactions,
  getFundingStatistics,
  listTransactionsSchema,
  getProjectTransactionsSchema,
  getPendingTransactionsSchema,
  getFundingStatisticsSchema,
} from "../controllers/admin.funding.controller";

const router = express.Router();

// Apply protect and admin middleware to all routes
router.use(protect, admin);

/**
 * @swagger
 * /api/admin/funding/transactions:
 *   get:
 *     summary: List all funding transactions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, FAILED]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [timestamp, amount, projectName]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: List of transactions with pagination
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/transactions",
  validateRequest(listTransactionsSchema),
  listTransactions,
);

/**
 * @swagger
 * /api/admin/funding/transactions/{projectId}:
 *   get:
 *     summary: Get detailed transactions for a specific project
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Project transactions with statistics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Project not found
 */
router.get(
  "/transactions/:projectId",
  validateRequest(getProjectTransactionsSchema),
  getProjectTransactions,
);

/**
 * @swagger
 * /api/admin/funding/pending:
 *   get:
 *     summary: List all pending funding requests
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [timestamp, amount]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: List of pending transactions with pagination
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/pending",
  validateRequest(getPendingTransactionsSchema),
  getPendingTransactions,
);

/**
 * @swagger
 * /api/admin/funding/statistics:
 *   get:
 *     summary: Get comprehensive funding statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year, all]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Funding statistics including overview, trends, and breakdowns
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/statistics",
  validateRequest(getFundingStatisticsSchema),
  getFundingStatistics,
);

export default router;
