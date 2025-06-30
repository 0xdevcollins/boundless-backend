import { Request, Response } from "express";
import Campaign, { CampaignStatus } from "../models/campaign.model";
import Milestone, { MilestoneStatus } from "../models/milestone.model";
import Project, { ProjectStatus } from "../models/project.model";
import { Types } from "mongoose";
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
  sendValidationError,
  asyncHandler,
} from "../utils/apiResponse";
import { validateObjectId } from "../utils/validation.utils";
import notificationService from "../services/notification.service";

interface CreateCampaignRequest extends Request {
  body: {
    projectId: string;
    goalAmount: number;
    deadline: string;
    currency?: string;
    minimumContribution?: number;
    maximumContribution?: number;
    refundPolicy?: string;
    milestones: Array<{
      title: string;
      description: string;
      targetAmount: number;
      dueDate: string;
      deliverables: string[];
      acceptanceCriteria: string[];
      estimatedHours?: number;
      priority?: "low" | "medium" | "high";
    }>;
  };
}

interface UpdateCampaignRequest extends Request {
  body: {
    goalAmount?: number;
    deadline?: string;
    currency?: string;
    minimumContribution?: number;
    maximumContribution?: number;
    refundPolicy?: string;
  };
}

/**
 * @desc    Create a new campaign with milestones
 * @route   POST /api/campaigns
 * @access  Private (Project Creator)
 */
export const createCampaign = asyncHandler(
  async (req: CreateCampaignRequest, res: Response) => {
    const {
      projectId,
      goalAmount,
      deadline,
      currency,
      minimumContribution,
      maximumContribution,
      refundPolicy,
      milestones,
    } = req.body;
    const creatorId = req.user?._id;

    // Validate required fields
    if (
      !projectId ||
      !goalAmount ||
      !deadline ||
      !milestones ||
      milestones.length === 0
    ) {
      sendBadRequest(
        res,
        "Project ID, goal amount, deadline, and at least one milestone are required",
      );
      return;
    }

    // Validate ObjectIds
    if (!validateObjectId(projectId)) {
      sendBadRequest(res, "Invalid project ID format");
      return;
    }

    // Check if project exists and user is the owner
    const project = await Project.findById(projectId).populate("owner.type");
    if (!project) {
      sendNotFound(res, "Project not found");
      return;
    }

    if (project.owner.toString() !== creatorId?.toString()) {
      sendForbidden(res, "You can only create campaigns for your own projects");
      return;
    }

    // Check if project is validated
    if (project.status !== ProjectStatus.VALIDATED) {
      sendBadRequest(
        res,
        "Project must be validated before creating a campaign",
      );
      return;
    }

    // Check if campaign already exists for this project
    const existingCampaign = await Campaign.findOne({ projectId });
    if (existingCampaign) {
      sendBadRequest(res, "A campaign already exists for this project");
      return;
    }

    // Validate deadline
    const campaignDeadline = new Date(deadline);
    if (campaignDeadline <= new Date(Date.now() + 24 * 60 * 60 * 1000)) {
      sendBadRequest(
        res,
        "Campaign deadline must be at least 24 hours in the future",
      );
      return;
    }

    // Validate goal amount
    if (goalAmount <= 0 || !Number.isFinite(goalAmount)) {
      sendBadRequest(res, "Goal amount must be a positive number");
      return;
    }

    // Validate milestones
    const totalMilestoneAmount = milestones.reduce(
      (sum, milestone) => sum + milestone.targetAmount,
      0,
    );
    if (Math.abs(totalMilestoneAmount - goalAmount) > 0.01) {
      sendBadRequest(
        res,
        "Sum of milestone target amounts must equal the campaign goal amount",
      );
      return;
    }

    // Validate milestone due dates
    for (const milestone of milestones) {
      const milestoneDueDate = new Date(milestone.dueDate);
      if (milestoneDueDate >= campaignDeadline) {
        sendBadRequest(
          res,
          "All milestone due dates must be before the campaign deadline",
        );
        return;
      }
    }

    try {
      // Create campaign
      const campaign = new Campaign({
        projectId: new Types.ObjectId(projectId),
        creatorId: new Types.ObjectId(creatorId),
        goalAmount,
        deadline: campaignDeadline,
        status: CampaignStatus.DRAFT,
        metadata: {
          currency: currency || "USD",
          minimumContribution: minimumContribution || 1,
          maximumContribution,
          refundPolicy: refundPolicy || "all_or_nothing",
        },
      });

      await campaign.save();

      // Create milestones
      const milestonePromises = milestones.map(async (milestoneData, index) => {
        const milestone = new Milestone({
          campaignId: campaign._id,
          title: milestoneData.title,
          description: milestoneData.description,
          index,
          targetAmount: milestoneData.targetAmount,
          dueDate: new Date(milestoneData.dueDate),
          status: MilestoneStatus.PENDING,
          metadata: {
            deliverables: milestoneData.deliverables || [],
            acceptanceCriteria: milestoneData.acceptanceCriteria || [],
            estimatedHours: milestoneData.estimatedHours,
            priority: milestoneData.priority || "medium",
          },
        });

        return milestone.save();
      });

      const createdMilestones = await Promise.all(milestonePromises);

      // Populate campaign with related data
      const populatedCampaign = await Campaign.findById(campaign._id)
        .populate("projectId", "title description category")
        .populate("creatorId", "profile.firstName profile.lastName email");

      // Send notification to admins about new campaign pending approval
      await notificationService.notifyAdminsNewCampaign(
        campaign._id.toString(),
      );

      // Log campaign creation activity
      console.log(
        `Campaign created: ${campaign._id} for project: ${projectId} by user: ${creatorId}`,
      );

      sendCreated(
        res,
        {
          campaign: populatedCampaign,
          milestones: createdMilestones,
        },
        "Campaign created successfully. It will be reviewed by admins before going live.",
      );
    } catch (error) {
      console.error("Campaign creation error:", error);
      if (error instanceof Error) {
        if (error.message.includes("validation")) {
          sendValidationError(res, "Campaign validation failed", error.message);
        } else {
          sendError(res, "Failed to create campaign", 500, error.message);
        }
      } else {
        sendError(res, "Failed to create campaign", 500);
      }
    }
  },
);

/**
 * @desc    Get all campaigns with filtering and pagination
 * @route   GET /api/campaigns
 * @access  Public
 */
export const getCampaigns = asyncHandler(
  async (req: Request, res: Response) => {
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const status = req.query.status as CampaignStatus;
    const creatorId = req.query.creatorId as string;
    const category = req.query.category as string;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) || "desc";

    // Build filter object
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (creatorId && validateObjectId(creatorId)) {
      filter.creatorId = new Types.ObjectId(creatorId);
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    try {
      // Build aggregation pipeline
      const pipeline: any[] = [
        { $match: filter },
        {
          $lookup: {
            from: "projects",
            localField: "projectId",
            foreignField: "_id",
            as: "project",
          },
        },
        { $unwind: "$project" },
        {
          $lookup: {
            from: "users",
            localField: "creatorId",
            foreignField: "_id",
            as: "creator",
          },
        },
        { $unwind: "$creator" },
      ];

      // Add category filter if specified
      if (category) {
        pipeline.push({
          $match: { "project.category": category },
        });
      }

      // Add sorting and pagination
      pipeline.push({ $sort: sort }, { $skip: skip }, { $limit: limit });

      // Project only necessary fields
      pipeline.push({
        $project: {
          _id: 1,
          goalAmount: 1,
          deadline: 1,
          fundsRaised: 1,
          status: 1,
          metadata: 1,
          analytics: 1,
          createdAt: 1,
          updatedAt: 1,
          fundingProgress: {
            $multiply: [{ $divide: ["$fundsRaised", "$goalAmount"] }, 100],
          },
          daysRemaining: {
            $ceil: {
              $divide: [
                { $subtract: ["$deadline", new Date()] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
          "project.title": 1,
          "project.description": 1,
          "project.category": 1,
          "project.media": 1,
          "creator.profile.firstName": 1,
          "creator.profile.lastName": 1,
          "creator.profile.avatar": 1,
        },
      });

      const campaigns = await Campaign.aggregate(pipeline);

      // Get total count for pagination
      const totalCountPipeline: any[] = [
        { $match: filter },
        {
          $lookup: {
            from: "projects",
            localField: "projectId",
            foreignField: "_id",
            as: "project",
          },
        },
        { $unwind: "$project" },
      ];

      if (category) {
        totalCountPipeline.push({
          $match: { "project.category": category },
        });
      }

      totalCountPipeline.push({ $count: "total" });

      const totalResult = await Campaign.aggregate(totalCountPipeline);
      const total = totalResult[0]?.total || 0;

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
      console.error("Get campaigns error:", error);
      sendError(res, "Failed to fetch campaigns", 500);
    }
  },
);

/**
 * @desc    Get campaign by ID with milestones
 * @route   GET /api/campaigns/:id
 * @access  Public
 */
export const getCampaignById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      sendBadRequest(res, "Invalid campaign ID format");
      return;
    }

    try {
      const campaign = await Campaign.findById(id)
        .populate("projectId", "title description category media documents")
        .populate(
          "creatorId",
          "profile.firstName profile.lastName profile.avatar email",
        )
        .populate("approvedBy", "profile.firstName profile.lastName");

      if (!campaign) {
        sendNotFound(res, "Campaign not found");
        return;
      }

      // Get milestones for this campaign
      const milestones = await Milestone.find({ campaignId: id })
        .sort({ index: 1 })
        .populate("reviewedBy", "profile.firstName profile.lastName");

      // Calculate additional metrics
      const totalMilestones = milestones.length;
      const completedMilestones = milestones.filter(
        (m) => m.status === MilestoneStatus.COMPLETED,
      ).length;
      const milestoneProgress =
        totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

      sendSuccess(res, {
        campaign,
        milestones,
        metrics: {
          totalMilestones,
          completedMilestones,
          milestoneProgress,
          fundingProgress:
            campaign.goalAmount > 0
              ? (campaign.fundsRaised / campaign.goalAmount) * 100
              : 0,
          daysRemaining: Math.ceil(
            (campaign.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        },
      });
    } catch (error) {
      console.error("Get campaign by ID error:", error);
      sendError(res, "Failed to fetch campaign", 500);
    }
  },
);

/**
 * @desc    Update campaign (only in draft status)
 * @route   PUT /api/campaigns/:id
 * @access  Private (Campaign Creator)
 */
export const updateCampaign = asyncHandler(
  async (req: UpdateCampaignRequest, res: Response) => {
    const { id } = req.params;
    const {
      goalAmount,
      deadline,
      currency,
      minimumContribution,
      maximumContribution,
      refundPolicy,
    } = req.body;
    const userId = req.user?._id;

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

      // Check ownership
      if (campaign.creatorId.toString() !== userId?.toString()) {
        sendForbidden(res, "You can only update your own campaigns");
        return;
      }

      // Only allow updates for draft campaigns
      if (campaign.status !== CampaignStatus.DRAFT) {
        sendBadRequest(res, "Only draft campaigns can be updated");
        return;
      }

      // Validate updates
      const updates: any = {};

      if (goalAmount !== undefined) {
        if (goalAmount <= 0 || !Number.isFinite(goalAmount)) {
          sendBadRequest(res, "Goal amount must be a positive number");
          return;
        }
        updates.goalAmount = goalAmount;
      }

      if (deadline !== undefined) {
        const newDeadline = new Date(deadline);
        if (newDeadline <= new Date(Date.now() + 24 * 60 * 60 * 1000)) {
          sendBadRequest(
            res,
            "Campaign deadline must be at least 24 hours in the future",
          );
          return;
        }
        updates.deadline = newDeadline;
      }

      if (currency !== undefined) {
        updates["metadata.currency"] = currency;
      }

      if (minimumContribution !== undefined) {
        if (minimumContribution < 0.01) {
          sendBadRequest(res, "Minimum contribution must be at least 0.01");
          return;
        }
        updates["metadata.minimumContribution"] = minimumContribution;
      }

      if (maximumContribution !== undefined) {
        const minContrib =
          minimumContribution || campaign.metadata.minimumContribution;
        if (maximumContribution < minContrib) {
          sendBadRequest(
            res,
            "Maximum contribution must be greater than minimum contribution",
          );
          return;
        }
        updates["metadata.maximumContribution"] = maximumContribution;
      }

      if (refundPolicy !== undefined) {
        updates["metadata.refundPolicy"] = refundPolicy;
      }

      const updatedCampaign = await Campaign.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true },
      )
        .populate("projectId", "title description category")
        .populate("creatorId", "profile.firstName profile.lastName email");

      sendSuccess(res, updatedCampaign, "Campaign updated successfully");
    } catch (error) {
      console.error("Update campaign error:", error);
      if (error instanceof Error && error.message.includes("validation")) {
        sendValidationError(res, "Campaign validation failed", error.message);
      } else {
        sendError(res, "Failed to update campaign", 500);
      }
    }
  },
);

/**
 * @desc    Submit campaign for admin approval
 * @route   POST /api/campaigns/:id/submit
 * @access  Private (Campaign Creator)
 */
export const submitCampaignForApproval = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?._id;

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

      // Check ownership
      if (campaign.creatorId.toString() !== userId?.toString()) {
        sendForbidden(res, "You can only submit your own campaigns");
        return;
      }

      // Only allow submission for draft campaigns
      if (campaign.status !== CampaignStatus.DRAFT) {
        sendBadRequest(
          res,
          "Only draft campaigns can be submitted for approval",
        );
        return;
      }

      // Validate campaign has milestones
      const milestoneCount = await Milestone.countDocuments({ campaignId: id });
      if (milestoneCount === 0) {
        sendBadRequest(
          res,
          "Campaign must have at least one milestone before submission",
        );
        return;
      }

      // Update campaign status
      campaign.status = CampaignStatus.PENDING_APPROVAL;
      await campaign.save();

      // Notify admins
      await notificationService.notifyAdminsCampaignSubmitted(id);

      sendSuccess(
        res,
        campaign,
        "Campaign submitted for admin approval successfully",
      );
    } catch (error) {
      console.error("Submit campaign error:", error);
      sendError(res, "Failed to submit campaign for approval", 500);
    }
  },
);

/**
 * @desc    Delete campaign (only in draft status)
 * @route   DELETE /api/campaigns/:id
 * @access  Private (Campaign Creator)
 */
export const deleteCampaign = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?._id;

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

      // Check ownership
      if (campaign.creatorId.toString() !== userId?.toString()) {
        sendForbidden(res, "You can only delete your own campaigns");
        return;
      }

      // Only allow deletion for draft campaigns
      if (campaign.status !== CampaignStatus.DRAFT) {
        sendBadRequest(res, "Only draft campaigns can be deleted");
        return;
      }

      // Delete associated milestones
      await Milestone.deleteMany({ campaignId: id });

      // Delete campaign
      await Campaign.findByIdAndDelete(id);

      sendSuccess(res, null, "Campaign deleted successfully");
    } catch (error) {
      console.error("Delete campaign error:", error);
      sendError(res, "Failed to delete campaign", 500);
    }
  },
);

/**
 * @desc    Get campaigns by creator
 * @route   GET /api/campaigns/creator/:creatorId
 * @access  Public
 */
export const getCampaignsByCreator = asyncHandler(
  async (req: Request, res: Response) => {
    const { creatorId } = req.params;
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (!validateObjectId(creatorId)) {
      sendBadRequest(res, "Invalid creator ID format");
      return;
    }

    try {
      const campaigns = await Campaign.find({ creatorId })
        .populate("projectId", "title description category media")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Campaign.countDocuments({ creatorId });

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
      console.error("Get campaigns by creator error:", error);
      sendError(res, "Failed to fetch campaigns", 500);
    }
  },
);
