import express from "express";
import {
  getDashboardOverview,
  getUserStatistics,
  getProjectStatistics,
} from "../controllers/admin.controller";
import { protect, admin } from "../middleware/auth";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardOverview:
 *       type: object
 *       properties:
 *         totalProjects:
 *           type: number
 *           description: Total number of projects in the system
 *           example: 150
 *         totalUsers:
 *           type: number
 *           description: Total number of registered users
 *           example: 1250
 *         pendingProjects:
 *           type: number
 *           description: Number of projects pending approval or deployment
 *           example: 25
 *         totalFunding:
 *           type: number
 *           description: Total amount of funding raised across all projects
 *           example: 500000.50
 *         recentProjects:
 *           type: array
 *           description: List of recently created projects
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Project name
 *                 example: "Decentralized Social Network"
 *               status:
 *                 type: string
 *                 description: Current project status
 *                 example: "FUNDING"
 *               creatorName:
 *                 type: string
 *                 description: Full name of the project creator
 *                 example: "John Doe"
 *               creatorAvatar:
 *                 type: string
 *                 description: URL to creator's avatar image
 *                 example: "https://example.com/avatar.jpg"
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Project creation timestamp
 *                 example: "2024-01-15T10:30:00Z"
 *         recentUsers:
 *           type: array
 *           description: List of recently registered users
 *           items:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 description: URL to user's avatar image
 *                 example: "https://example.com/user-avatar.jpg"
 *               name:
 *                 type: string
 *                 description: Full name of the user
 *                 example: "Jane Smith"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "jane.smith@example.com"
 *               role:
 *                 type: string
 *                 description: User's primary role in the system
 *                 enum: [CREATOR, BACKER, MODERATOR, ADMIN]
 *                 example: "CREATOR"
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: User registration timestamp
 *                 example: "2024-01-14T15:45:00Z"
 *         fundingOverview:
 *           type: object
 *           description: Funding statistics and chart data
 *           properties:
 *             chartData:
 *               type: array
 *               description: Data points for funding visualization charts
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Category or status name for the data point
 *                     example: "Status: FUNDING"
 *                   value:
 *                     type: number
 *                     description: Funding amount for this category
 *                     example: 125000.75
 *
 *     UserStatistics:
 *       type: object
 *       properties:
 *         usersByRole:
 *           type: array
 *           description: User count breakdown by role
 *           items:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 description: User role
 *                 example: "CREATOR"
 *               count:
 *                 type: number
 *                 description: Number of users with this role
 *                 example: 45
 *         registrationTrends:
 *           type: array
 *           description: Daily user registration trends for the last 30 days
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Date in YYYY-MM-DD format
 *                 example: "2024-01-15"
 *               count:
 *                 type: number
 *                 description: Number of users registered on this date
 *                 example: 12
 *
 *     ProjectStatistics:
 *       type: object
 *       properties:
 *         projectsByStatus:
 *           type: array
 *           description: Project statistics grouped by status
 *           items:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 description: Project status
 *                 example: "FUNDING"
 *               count:
 *                 type: number
 *                 description: Number of projects with this status
 *                 example: 35
 *               totalFunding:
 *                 type: number
 *                 description: Total funding raised by projects in this status
 *                 example: 250000.00
 *               avgFunding:
 *                 type: number
 *                 description: Average funding per project in this status
 *                 example: 7142.86
 *         creationTrends:
 *           type: array
 *           description: Daily project creation trends for the last 30 days
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Date in YYYY-MM-DD format
 *                 example: "2024-01-15"
 *               count:
 *                 type: number
 *                 description: Number of projects created on this date
 *                 example: 3
 *               totalFunding:
 *                 type: number
 *                 description: Total funding goal of projects created on this date
 *                 example: 75000.00
 *         topProjects:
 *           type: array
 *           description: Top 10 projects by funding raised
 *           items:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Project title
 *                 example: "Revolutionary DeFi Platform"
 *               funding:
 *                 type: object
 *                 properties:
 *                   raised:
 *                     type: number
 *                     description: Amount raised
 *                     example: 150000.00
 *                   goal:
 *                     type: number
 *                     description: Funding goal
 *                     example: 200000.00
 *               status:
 *                 type: string
 *                 description: Project status
 *                 example: "FUNDING"
 *               owner:
 *                 type: object
 *                 description: Project owner information
 *
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indicates if the request was successful
 *           example: true
 *         data:
 *           type: object
 *           description: Response data (varies by endpoint)
 *         message:
 *           type: string
 *           description: Error message (only present when success is false)
 *           example: "Failed to fetch dashboard overview"
 *         error:
 *           type: string
 *           description: Detailed error information (only present when success is false)
 *           example: "Database connection failed"
 */

/**
 * @swagger
 * /api/admin/dashboard/overview:
 *   get:
 *     summary: Get comprehensive admin dashboard overview
 *     description: Retrieves comprehensive statistics and recent activity summaries for projects and users. This endpoint provides all the key metrics needed for the administrative dashboard.
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DashboardOverview'
 *             examples:
 *               success:
 *                 summary: Successful response
 *                 value:
 *                   success: true
 *                   data:
 *                     totalProjects: 150
 *                     totalUsers: 1250
 *                     pendingProjects: 25
 *                     totalFunding: 500000.50
 *                     recentProjects:
 *                       - name: "Decentralized Social Network"
 *                         status: "FUNDING"
 *                         creatorName: "John Doe"
 *                         creatorAvatar: "https://example.com/avatar.jpg"
 *                         timestamp: "2024-01-15T10:30:00Z"
 *                     recentUsers:
 *                       - avatar: "https://example.com/user-avatar.jpg"
 *                         name: "Jane Smith"
 *                         email: "jane.smith@example.com"
 *                         role: "CREATOR"
 *                         timestamp: "2024-01-14T15:45:00Z"
 *                     fundingOverview:
 *                       chartData:
 *                         - name: "Status: FUNDING"
 *                           value: 125000.75
 *                         - name: "Category: DeFi"
 *                           value: 200000.00
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: "Not authorized, token failed"
 *       403:
 *         description: Forbidden - User does not have admin privileges
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: "Not authorized as an admin"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: false
 *               message: "Failed to fetch dashboard overview"
 *               error: "Database connection failed"
 */
router.get("/dashboard/overview", protect, admin, getDashboardOverview);

/**
 * @swagger
 * /api/admin/dashboard/users:
 *   get:
 *     summary: Get detailed user statistics
 *     description: Retrieves detailed user statistics including role distribution and registration trends for the admin dashboard.
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserStatistics'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have admin privileges
 *       500:
 *         description: Internal server error
 */
router.get("/dashboard/users", protect, admin, getUserStatistics);

/**
 * @swagger
 * /api/admin/dashboard/projects:
 *   get:
 *     summary: Get detailed project statistics
 *     description: Retrieves detailed project statistics including status distribution, creation trends, and top performing projects for the admin dashboard.
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Project statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ProjectStatistics'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have admin privileges
 *       500:
 *         description: Internal server error
 */
router.get("/dashboard/projects", protect, admin, getProjectStatistics);

export default router;
