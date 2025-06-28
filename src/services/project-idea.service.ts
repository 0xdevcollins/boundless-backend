import Project, {
  IProject,
  ProjectStatus,
  type ProjectType,
} from "../models/project.model";
import Crowdfund, { CrowdfundStatus } from "../models/crowdfund.model";
import mongoose from "mongoose";

export interface ProjectIdeaStats {
  totalIdeas: number;
  ideasByStatus: Array<{
    status: ProjectStatus;
    count: number;
  }>;
  ideasByType: Array<{
    type: ProjectType;
    count: number;
  }>;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  recentActivity: Array<{
    projectId: string;
    title: string;
    status: ProjectStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export interface CrowdfundStats {
  totalCrowdfunds: number;
  crowdfundsByStatus: Array<{
    status: CrowdfundStatus;
    count: number;
  }>;
  averageThresholdVotes: number;
  totalVotesCast: number;
  expiredVotingDeadlines: number;
}

export class ProjectIdeaService {
  /**
   * Get comprehensive statistics for project ideas
   */
  static async getProjectIdeaStats(): Promise<ProjectIdeaStats> {
    try {
      const [
        totalIdeas,
        ideasByStatus,
        ideasByType,
        topCategories,
        recentActivity,
      ] = await Promise.all([
        Project.countDocuments(),
        Project.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              status: "$_id",
              count: 1,
              _id: 0,
            },
          },
        ]),
        Project.aggregate([
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              type: "$_id",
              count: 1,
              _id: 0,
            },
          },
        ]),
        Project.aggregate([
          {
            $match: {
              category: { $exists: true, $nin: [null, ""] },
            },
          },
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              category: "$_id",
              count: 1,
              _id: 0,
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 10,
          },
        ]),
        Project.find()
          .sort({ updatedAt: -1 })
          .limit(10)
          .select("_id title status createdAt updatedAt")
          .lean(),
      ]);

      return {
        totalIdeas,
        ideasByStatus,
        ideasByType,
        topCategories,
        recentActivity: recentActivity.map((project) => ({
          projectId: project._id.toString(),
          title: project.title,
          status: project.status,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        })),
      };
    } catch (error) {
      console.error("Error getting project idea stats:", error);
      throw error;
    }
  }

  /**
   * Get comprehensive statistics for crowdfunds
   */
  static async getCrowdfundStats(): Promise<CrowdfundStats> {
    try {
      const [
        totalCrowdfunds,
        crowdfundsByStatus,
        averageThresholdVotes,
        totalVotesCast,
        expiredVotingDeadlines,
      ] = await Promise.all([
        Crowdfund.countDocuments(),
        Crowdfund.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              status: "$_id",
              count: 1,
              _id: 0,
            },
          },
        ]),
        Crowdfund.aggregate([
          {
            $group: {
              _id: null,
              average: { $avg: "$thresholdVotes" },
            },
          },
        ]).then((result) => result[0]?.average || 0),
        Crowdfund.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: "$totalVotes" },
            },
          },
        ]).then((result) => result[0]?.total || 0),
        Crowdfund.countDocuments({
          voteDeadline: { $lt: new Date() },
          status: {
            $in: [CrowdfundStatus.PENDING, CrowdfundStatus.UNDER_REVIEW],
          },
        }),
      ]);

      return {
        totalCrowdfunds,
        crowdfundsByStatus,
        averageThresholdVotes: Math.round(averageThresholdVotes),
        totalVotesCast,
        expiredVotingDeadlines,
      };
    } catch (error) {
      console.error("Error getting crowdfund stats:", error);
      throw error;
    }
  }

  /**
   * Update project status (admin function)
   */
  static async updateProjectStatus(
    projectId: string,
    newStatus: ProjectStatus,
    rejectedReason?: string,
  ): Promise<IProject> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const project = await Project.findById(projectId).session(session);
      if (!project) {
        throw new Error("Project not found");
      }

      // Update project status
      project.status = newStatus;
      await project.save({ session });

      // Update associated crowdfund if exists
      const crowdfund = await Crowdfund.findOne({ projectId }).session(session);
      if (crowdfund) {
        switch (newStatus) {
          case ProjectStatus.REVIEWING:
            crowdfund.status = CrowdfundStatus.UNDER_REVIEW;
            break;
          case ProjectStatus.VALIDATED:
            crowdfund.status = CrowdfundStatus.VALIDATED;
            crowdfund.validatedAt = new Date();
            break;
          case ProjectStatus.REJECTED:
            crowdfund.status = CrowdfundStatus.REJECTED;
            if (rejectedReason) {
              crowdfund.rejectedReason = rejectedReason;
            }
            break;
        }
        await crowdfund.save({ session });
      }

      await session.commitTransaction();
      return project;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get projects that need review (admin function)
   */
  static async getProjectsForReview(
    page = 1,
    limit = 10,
  ): Promise<{
    projects: IProject[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
    try {
      const skip = (page - 1) * limit;

      const [projects, totalCount] = await Promise.all([
        Project.find({
          status: { $in: [ProjectStatus.IDEA, ProjectStatus.REVIEWING] },
        })
          .populate(
            "owner.type",
            "profile.firstName profile.lastName profile.username",
          )
          .sort({ createdAt: 1 }) // Oldest first for review queue
          .skip(skip)
          .limit(limit)
          .lean(),
        Project.countDocuments({
          status: { $in: [ProjectStatus.IDEA, ProjectStatus.REVIEWING] },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        projects,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      console.error("Error getting projects for review:", error);
      throw error;
    }
  }

  /**
   * Check and update expired voting deadlines
   */
  static async processExpiredVotingDeadlines(): Promise<number> {
    try {
      const expiredCrowdfunds = await Crowdfund.find({
        voteDeadline: { $lt: new Date() },
        status: CrowdfundStatus.PENDING,
      });

      let processedCount = 0;

      for (const crowdfund of expiredCrowdfunds) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Check if threshold was met
          if (crowdfund.totalVotes >= crowdfund.thresholdVotes) {
            // Move to under review
            crowdfund.status = CrowdfundStatus.UNDER_REVIEW;
            await crowdfund.save({ session });

            await Project.findByIdAndUpdate(
              crowdfund.projectId,
              { status: ProjectStatus.REVIEWING },
              { session },
            );
          } else {
            // Reject due to insufficient votes
            crowdfund.status = CrowdfundStatus.REJECTED;
            crowdfund.rejectedReason =
              "Insufficient votes received before deadline";
            await crowdfund.save({ session });

            await Project.findByIdAndUpdate(
              crowdfund.projectId,
              { status: ProjectStatus.REJECTED },
              { session },
            );
          }

          await session.commitTransaction();
          processedCount++;
        } catch (error) {
          await session.abortTransaction();
          console.error(
            `Error processing expired crowdfund ${crowdfund._id}:`,
            error,
          );
        } finally {
          session.endSession();
        }
      }

      return processedCount;
    } catch (error) {
      console.error("Error processing expired voting deadlines:", error);
      throw error;
    }
  }

  /**
   * Get trending project ideas based on recent votes
   */
  static async getTrendingProjects(limit = 10): Promise<IProject[]> {
    try {
      // Get projects with recent vote activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const trendingProjects = await Project.find({
        status: { $in: [ProjectStatus.IDEA, ProjectStatus.REVIEWING] },
        updatedAt: { $gte: sevenDaysAgo },
      })
        .populate(
          "owner.type",
          "profile.firstName profile.lastName profile.username profile.avatar",
        )
        .select(
          "title summary type category status votes owner createdAt updatedAt",
        )
        .sort({ votes: -1, updatedAt: -1 })
        .limit(limit)
        .lean();

      return trendingProjects;
    } catch (error) {
      console.error("Error getting trending projects:", error);
      throw error;
    }
  }

  /**
   * Search project ideas with advanced filtering
   */
  static async searchProjects(
    searchQuery: string,
    filters: {
      type?: ProjectType;
      status?: ProjectStatus[];
      category?: string;
      minVotes?: number;
      maxVotes?: number;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
    page = 1,
    limit = 10,
  ): Promise<{
    projects: IProject[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
    searchMeta: {
      query: string;
      resultsFound: number;
      searchTime: number;
    };
  }> {
    const startTime = Date.now();

    try {
      const searchFilter: any = {};

      // Text search
      if (searchQuery.trim()) {
        searchFilter.$or = [
          { title: { $regex: searchQuery, $options: "i" } },
          { summary: { $regex: searchQuery, $options: "i" } },
          { description: { $regex: searchQuery, $options: "i" } },
          { category: { $regex: searchQuery, $options: "i" } },
        ];
      }

      // Apply filters
      if (filters.type) {
        searchFilter.type = filters.type;
      }

      if (filters.status && filters.status.length > 0) {
        searchFilter.status = { $in: filters.status };
      }

      if (filters.category) {
        searchFilter.category = { $regex: filters.category, $options: "i" };
      }

      if (filters.minVotes !== undefined || filters.maxVotes !== undefined) {
        searchFilter.votes = {};
        if (filters.minVotes !== undefined) {
          searchFilter.votes.$gte = filters.minVotes;
        }
        if (filters.maxVotes !== undefined) {
          searchFilter.votes.$lte = filters.maxVotes;
        }
      }

      if (filters.dateFrom || filters.dateTo) {
        searchFilter.createdAt = {};
        if (filters.dateFrom) {
          searchFilter.createdAt.$gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          searchFilter.createdAt.$lte = filters.dateTo;
        }
      }

      const skip = (page - 1) * limit;

      const [projects, totalCount] = await Promise.all([
        Project.find(searchFilter)
          .populate(
            "owner.type",
            "profile.firstName profile.lastName profile.username profile.avatar",
          )
          .select(
            "title summary type category status votes owner createdAt updatedAt",
          )
          .sort({ votes: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Project.countDocuments(searchFilter),
      ]);

      const totalPages = Math.ceil(totalCount / limit);
      const searchTime = Date.now() - startTime;

      return {
        projects,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit,
        },
        searchMeta: {
          query: searchQuery,
          resultsFound: totalCount,
          searchTime,
        },
      };
    } catch (error) {
      console.error("Error searching projects:", error);
      throw error;
    }
  }
}

export default ProjectIdeaService;
