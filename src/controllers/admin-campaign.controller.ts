import { Request, Response } from "express";
import Campaign, { CampaignStatus } from "../models/campaign.model";
import Milestone from "../models/milestone.model";
import { Types } from "mongoose";
import {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
  asyncHandler,
} from "../utils/apiResponse";
import contractService from "../services/contract.service";
import notificationService from "../services/notification.service";
import { validateObjectId } from "../utils/validation.utils";

interface ApproveCampaignRequest extends Request {
  body: {
    approved: boolean;
    rejectionReason?: string;
    deployToContract?: boolean;
  };
}

/**
 * @desc    Get all campaigns pending approval
 * @route   GET /api/admin/campaigns/pending
 * @access  Private (Admin only)
 */
export const getPendingCampaigns = asyncHandler(
  async (req: Request, res: Response) => {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    try {
      const campaigns = await Campaign.find({
        status: CampaignStatus.PENDING_APPROVAL,
      })
        .populate("projectId", "title description category media")
        .populate(
          "creatorId",
          "profile.firstName profile.lastName email profile.avatar",
        )
        .sort({ createdAt: 1 }) // Oldest first for FIFO processing
        .skip(skip)
        .limit(limit);

      const total = await Campaign.countDocuments({
        status: CampaignStatus.PENDING_APPROVAL,
      });

      // Get milestones for each campaign
      const campaignsWithMilestones = await Promise.all(
        campaigns.map(async (campaign) => {
          const milestones = await Milestone.find({
            campaignId: campaign._id,
          }).sort({ index: 1 });
          return {
            ...campaign.toObject(),
            milestones,
            milestonesCount: milestones.length,
          };
        }),
      );

      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      };

      sendSuccess(res, {
        campaigns: campaignsWithMilestones,
        pagination,
      });
    } catch (error) {
      console.error("Get pending campaigns error:", error);
      sendError(res, "Failed to fetch pending campaigns", 500);
    }
  },
);

/**
 * @desc    Approve or reject a campaign
 * @route   POST /api/admin/campaigns/:id/review
 * @access  Private (Admin only)
 */
export const reviewCampaign = asyncHandler(
  async (req: ApproveCampaignRequest, res: Response) => {
    const { id } = req.params;
    const { approved, rejectionReason, deployToContract = true } = req.body;
    const adminId = req.user?._id;

    if (!validateObjectId(id)) {
      sendBadRequest(res, "Invalid campaign ID format");
      return;
    }

    if (approved === undefined) {
      sendBadRequest(res, "Approval decision is required");
      return;
    }

    if (!approved && !rejectionReason) {
      sendBadRequest(
        res,
        "Rejection reason is required when rejecting a campaign",
      );
      return;
    }

    try {
      const campaign = await Campaign.findById(id)
        .populate("projectId", "title description")
        .populate("creatorId", "profile.firstName profile.lastName email");

      if (!campaign) {
        sendNotFound(res, "Campaign not found");
        return;
      }

      if (campaign.status !== CampaignStatus.PENDING_APPROVAL) {
        sendBadRequest(res, "Campaign is not pending approval");
        return;
      }

      if (approved) {
        // Approve campaign
        campaign.status = CampaignStatus.LIVE;
        campaign.approvedBy = new Types.ObjectId(adminId);
        campaign.approvedAt = new Date();

        await campaign.save();

        // Deploy to smart contract if requested
        if (deployToContract) {
          try {
            const milestones = await Milestone.find({ campaignId: id }).sort({
              index: 1,
            });

            const deployResult = await contractService.deployProject({
              projectId: campaign.projectId.toString(),
              fundingGoal: campaign.goalAmount,
              milestones: milestones.map((m) => ({
                title: m.title,
                amount: m.targetAmount,
                dueDate: m.dueDate.toISOString(),
              })),
            });

            // Update campaign with contract address
            campaign.smartContractAddress = deployResult.contractId;
            campaign.deployedAt = new Date();
            await campaign.save();

            console.log(
              `Campaign ${id} deployed to contract: ${deployResult.contractId}`,
            );
          } catch (deployError) {
            console.error("Contract deployment error:", deployError);
            // Don't fail the approval, just log the error
            // The contract can be deployed later manually
          }
        }

        // Notify campaign creator
        await notificationService.notifyCampaignApproved(
          campaign.creatorId.toString(),
          campaign._id.toString(),
        );

        sendSuccess(res, campaign, "Campaign approved successfully");
      } else {
        // Reject campaign
        campaign.status = CampaignStatus.CANCELLED;
        campaign.approvedBy = new Types.ObjectId(adminId);
        campaign.approvedAt = new Date();
        campaign.rejectedReason = rejectionReason;

        await campaign.save();

        // Notify campaign creator
        await notificationService.notifyCampaignRejected(
          campaign.creatorId.toString(),
          campaign._id.toString(),
          rejectionReason as string,
        );

        sendSuccess(res, campaign, "Campaign rejected");
      }
    } catch (error) {
      console.error("Review campaign error:", error);
      sendError(res, "Failed to review campaign", 500);
    }
  },
);

/**
 * @desc    Get campaign analytics for admin dashboard
 * @route   GET /api/admin/campaigns/analytics
 * @access  Private (Admin only)
 */
export const getCampaignAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      // Get campaign statistics by status
      const statusStats = await Campaign.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalGoalAmount: { $sum: "$goalAmount" },
            totalFundsRaised: { $sum: "$fundsRaised" },
          },
        },
        {
          $project: {
            status: "$_id",
            count: 1,
            totalGoalAmount: 1,
            totalFundsRaised: 1,
            averageGoalAmount: { $divide: ["$totalGoalAmount", "$count"] },
            fundingRate: {
              $cond: {
                if: { $gt: ["$totalGoalAmount", 0] },
                then: {
                  $multiply: [
                    { $divide: ["$totalFundsRaised", "$totalGoalAmount"] },
                    100,
                  ],
                },
                else: 0,
              },
            },
            _id: 0,
          },
        },
      ]);

      // Get campaign creation trends (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const creationTrends = await Campaign.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            count: { $sum: 1 },
            totalGoalAmount: { $sum: "$goalAmount" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      // Get top performing campaigns
      const topCampaigns = await Campaign.find({ status: CampaignStatus.LIVE })
        .sort({ fundsRaised: -1 })
        .limit(10)
        .populate("projectId", "title category")
        .populate("creatorId", "profile.firstName profile.lastName")
        .select("goalAmount fundsRaised analytics createdAt");

      // Get milestone completion statistics
      const milestoneStats = await Milestone.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      // Calculate overall metrics
      const totalCampaigns = await Campaign.countDocuments();
      const activeCampaigns = await Campaign.countDocuments({
        status: CampaignStatus.LIVE,
      });
      const pendingApproval = await Campaign.countDocuments({
        status: CampaignStatus.PENDING_APPROVAL,
      });

      const fundingStats = await Campaign.aggregate([
        {
          $group: {
            _id: null,
            totalGoalAmount: { $sum: "$goalAmount" },
            totalFundsRaised: { $sum: "$fundsRaised" },
          },
        },
      ]);

      const overallFundingRate = fundingStats[0]
        ? (fundingStats[0].totalFundsRaised / fundingStats[0].totalGoalAmount) *
          100
        : 0;

      sendSuccess(res, {
        overview: {
          totalCampaigns,
          activeCampaigns,
          pendingApproval,
          overallFundingRate: Math.round(overallFundingRate * 100) / 100,
        },
        statusStats,
        creationTrends,
        topCampaigns,
        milestoneStats,
      });
    } catch (error) {
      console.error("Get campaign analytics error:", error);
      sendError(res, "Failed to fetch campaign analytics", 500);
    }
  },
);

/**
 * @desc    Deploy campaign to smart contract manually
 * @route   POST /api/admin/campaigns/:id/deploy
 * @access  Private (Admin only)
 */
export const deployCampaignToContract = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      sendBadRequest(res, "Invalid campaign ID format");
      return;
    }

    try {
      const campaign = await Campaign.findById(id);
      if (!campaign) {
        sendNotFound(res, "Campaign not found");
        return;
      }

      if (campaign.status !== CampaignStatus.LIVE) {
        sendBadRequest(
          res,
          "Only live campaigns can be deployed to smart contracts",
        );
        return;
      }

      if (campaign.smartContractAddress) {
        sendBadRequest(res, "Campaign is already deployed to a smart contract");
        return;
      }

      // Get milestones for deployment
      const milestones = await Milestone.find({ campaignId: id }).sort({
        index: 1,
      });

      const deployResult = await contractService.deployProject({
        projectId: campaign.projectId.toString(),
        fundingGoal: campaign.goalAmount,
        milestones: milestones.map((m) => ({
          title: m.title,
          amount: m.targetAmount,
          dueDate: m.dueDate.toISOString(),
        })),
      });

      // Update campaign with contract address
      campaign.smartContractAddress = deployResult.contractId;
      campaign.deployedAt = new Date();
      await campaign.save();

      sendSuccess(
        res,
        {
          campaign,
          deployResult,
        },
        "Campaign deployed to smart contract successfully",
      );
    } catch (error) {
      console.error("Deploy campaign to contract error:", error);
      sendError(
        res,
        "Failed to deploy campaign to smart contract",
        500,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
);

/**
 * @desc    Get all campaigns for admin management
 * @route   GET /api/admin/campaigns
 * @access  Private (Admin only)
 */
export const getAllCampaignsForAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as CampaignStatus;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) || "desc";

    try {
      // Build filter
      const filter: any = {};
      if (status) {
        filter.status = status;
      }

      // Build sort
      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const campaigns = await Campaign.find(filter)
        .populate("projectId", "title description category")
        .populate("creatorId", "profile.firstName profile.lastName email")
        .populate("approvedBy", "profile.firstName profile.lastName")
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await Campaign.countDocuments(filter);

      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      };

      sendSuccess(res, {
        campaigns,
        pagination,
      });
    } catch (error) {
      console.error("Get all campaigns for admin error:", error);
      sendError(res, "Failed to fetch campaigns", 500);
    }
  },
);
