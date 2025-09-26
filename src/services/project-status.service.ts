import Project, { ProjectStatus, ProjectType } from "../models/project.model";
import Crowdfund, { CrowdfundStatus } from "../models/crowdfund.model";
import Vote from "../models/vote.model";
import User from "../models/user.model";
import mongoose from "mongoose";
import nodemailer from "nodemailer";

export interface StatusTransitionConfig {
  voteThreshold: number;
  positiveVoteRatio: number;
  negativeVoteRatio: number;
  timeThreshold?: number;
}

export interface StatusTransitionResult {
  projectId: string;
  oldStatus: ProjectStatus;
  newStatus: ProjectStatus;
  reason: string;
  timestamp: Date;
  voteData?: {
    totalVotes: number;
    upvotes: number;
    downvotes: number;
    positiveRatio: number;
  };
}

export class ProjectStatusService {
  private static readonly DEFAULT_CONFIG: StatusTransitionConfig = {
    voteThreshold: 100,
    positiveVoteRatio: 0.6,
    negativeVoteRatio: 0.4,
    timeThreshold: 168,
  };

  static async processStatusTransitions(
    config: Partial<StatusTransitionConfig> = {},
  ): Promise<StatusTransitionResult[]> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const results: StatusTransitionResult[] = [];

    const session = await mongoose.startSession();

    try {
      const projectsToCheck = await Project.find({
        status: ProjectStatus.IDEA,
        type: ProjectType.CROWDFUND,
      }).lean();

      for (const project of projectsToCheck) {
        session.startTransaction();

        try {
          const result = await this.checkAndUpdateSingleProject(
            project._id.toString(),
            finalConfig,
            session,
          );

          if (result) {
            results.push(result);
            await session.commitTransaction();
          } else {
            await session.abortTransaction();
          }
        } catch (error) {
          await session.abortTransaction();
          console.error(`Error processing project ${project._id}:`, error);
        }
      }

      const expiredResults =
        await this.processExpiredVotingDeadlines(finalConfig);
      results.push(...expiredResults);

      return results;
    } catch (error) {
      console.error("Error in processStatusTransitions:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  private static async checkAndUpdateSingleProject(
    projectId: string,
    config: StatusTransitionConfig,
    session: mongoose.ClientSession,
  ): Promise<StatusTransitionResult | null> {
    try {
      const voteCounts = await Vote.getVoteCounts(
        new mongoose.Types.ObjectId(projectId),
      );
      const voteData = voteCounts[0] || {
        upvotes: 0,
        downvotes: 0,
        totalVotes: 0,
        netVotes: 0,
      };

      if (voteData.totalVotes < config.voteThreshold) {
        return null;
      }

      const positiveRatio =
        voteData.totalVotes > 0 ? voteData.upvotes / voteData.totalVotes : 0;

      const project = await Project.findById(projectId).session(session);
      if (!project || project.status !== ProjectStatus.IDEA) {
        return null;
      }

      const crowdfund = await Crowdfund.findOne({ projectId }).session(session);
      if (!crowdfund) {
        return null;
      }

      let newStatus: ProjectStatus;
      let newCrowdfundStatus: CrowdfundStatus;
      let reason: string;

      if (positiveRatio >= config.positiveVoteRatio) {
        newStatus = ProjectStatus.REVIEWING;
        newCrowdfundStatus = CrowdfundStatus.UNDER_REVIEW;
        reason = `Reached vote threshold with ${(positiveRatio * 100).toFixed(1)}% positive votes`;
      } else if (positiveRatio <= config.negativeVoteRatio) {
        newStatus = ProjectStatus.REJECTED;
        newCrowdfundStatus = CrowdfundStatus.REJECTED;
        reason = `Rejected due to low positive vote ratio: ${(positiveRatio * 100).toFixed(1)}%`;
      } else {
        return null;
      }

      const oldStatus = project.status;
      project.status = newStatus;
      await project.save({ session });

      crowdfund.status = newCrowdfundStatus;
      if (newStatus === ProjectStatus.REJECTED) {
        crowdfund.rejectedReason = reason;
      } else if (newStatus === ProjectStatus.REVIEWING) {
      }
      await crowdfund.save({ session });

      await this.sendStatusChangeNotification(
        project,
        oldStatus,
        newStatus,
        reason,
      );

      return {
        projectId,
        oldStatus,
        newStatus,
        reason,
        timestamp: new Date(),
        voteData: {
          totalVotes: voteData.totalVotes,
          upvotes: voteData.upvotes,
          downvotes: voteData.downvotes,
          positiveRatio,
        },
      };
    } catch (error) {
      console.error(`Error checking project ${projectId}:`, error);
      throw error;
    }
  }

  private static async processExpiredVotingDeadlines(
    config: StatusTransitionConfig,
  ): Promise<StatusTransitionResult[]> {
    const results: StatusTransitionResult[] = [];

    try {
      const expiredCrowdfunds = await Crowdfund.find({
        voteDeadline: { $lt: new Date() },
        status: CrowdfundStatus.PENDING,
      }).populate("projectId");

      for (const crowdfund of expiredCrowdfunds) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          const project = crowdfund.projectId as any;
          if (!project || project.status !== ProjectStatus.IDEA) {
            await session.abortTransaction();
            continue;
          }

          const voteCounts = await Vote.getVoteCounts(crowdfund.projectId);
          const voteData = voteCounts[0] || {
            upvotes: 0,
            downvotes: 0,
            totalVotes: 0,
            netVotes: 0,
          };

          let newStatus: ProjectStatus;
          let newCrowdfundStatus: CrowdfundStatus;
          let reason: string;

          if (voteData.totalVotes >= config.voteThreshold) {
            const positiveRatio = voteData.upvotes / voteData.totalVotes;

            if (positiveRatio >= config.positiveVoteRatio) {
              newStatus = ProjectStatus.REVIEWING;
              newCrowdfundStatus = CrowdfundStatus.UNDER_REVIEW;
              reason = `Voting deadline expired with sufficient positive votes (${(positiveRatio * 100).toFixed(1)}%)`;
            } else {
              newStatus = ProjectStatus.REJECTED;
              newCrowdfundStatus = CrowdfundStatus.REJECTED;
              reason = `Voting deadline expired with insufficient positive votes (${(positiveRatio * 100).toFixed(1)}%)`;
            }
          } else {
            newStatus = ProjectStatus.REJECTED;
            newCrowdfundStatus = CrowdfundStatus.REJECTED;
            reason = `Voting deadline expired with insufficient total votes (${voteData.totalVotes}/${config.voteThreshold})`;
          }

          const oldStatus = project.status;
          await Project.findByIdAndUpdate(
            project._id,
            { status: newStatus },
            { session },
          );

          crowdfund.status = newCrowdfundStatus;
          if (newStatus === ProjectStatus.REJECTED) {
            crowdfund.rejectedReason = reason;
          }
          await crowdfund.save({ session });

          await session.commitTransaction();

          await this.sendStatusChangeNotification(
            project,
            oldStatus,
            newStatus,
            reason,
          );

          results.push({
            projectId: project._id.toString(),
            oldStatus,
            newStatus,
            reason,
            timestamp: new Date(),
            voteData: {
              totalVotes: voteData.totalVotes,
              upvotes: voteData.upvotes,
              downvotes: voteData.downvotes,
              positiveRatio:
                voteData.totalVotes > 0
                  ? voteData.upvotes / voteData.totalVotes
                  : 0,
            },
          });
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

      return results;
    } catch (error) {
      console.error("Error processing expired voting deadlines:", error);
      throw error;
    }
  }

  static async updateProjectStatus(
    projectId: string,
    newStatus: ProjectStatus,
    adminUserId: string,
    reason?: string,
  ): Promise<StatusTransitionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const project = await Project.findById(projectId).session(session);
      if (!project) {
        throw new Error("Project not found");
      }

      const crowdfund = await Crowdfund.findOne({ projectId }).session(session);

      const oldStatus = project.status;
      project.status = newStatus;
      await project.save({ session });

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
            if (reason) {
              crowdfund.rejectedReason = reason;
            }
            break;
        }
        await crowdfund.save({ session });
      }

      console.log(
        `Admin ${adminUserId} updated project ${projectId} status from ${oldStatus} to ${newStatus}`,
      );

      await session.commitTransaction();

      const finalReason = reason || `Status updated by administrator`;
      await this.sendStatusChangeNotification(
        project,
        oldStatus,
        newStatus,
        finalReason,
      );

      return {
        projectId,
        oldStatus,
        newStatus,
        reason: finalReason,
        timestamp: new Date(),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async getProjectsForReview(
    page = 1,
    limit = 10,
  ): Promise<{
    projects: any[];
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
          status: ProjectStatus.REVIEWING,
        })
          .populate(
            "owner.type",
            "profile.firstName profile.lastName profile.username profile.email",
          )
          .sort({ updatedAt: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Project.countDocuments({
          status: ProjectStatus.REVIEWING,
        }),
      ]);

      const projectsWithVotes = await Promise.all(
        projects.map(async (project) => {
          const voteCounts = await Vote.getVoteCounts(project._id);
          const voteData = voteCounts[0] || {
            upvotes: 0,
            downvotes: 0,
            totalVotes: 0,
            netVotes: 0,
          };

          const crowdfund = await Crowdfund.findOne({
            projectId: project._id,
          }).lean();

          return {
            ...project,
            voteData,
            crowdfund,
          };
        }),
      );

      const totalPages = Math.ceil(totalCount / limit);

      return {
        projects: projectsWithVotes,
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

  static async getStatusTransitionStats(days = 30): Promise<{
    totalTransitions: number;
    transitionsByStatus: Array<{
      fromStatus: ProjectStatus;
      toStatus: ProjectStatus;
      count: number;
    }>;
    averageVotesAtTransition: number;
    averageTimeToTransition: number;
  }> {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);

      return {
        totalTransitions: 0,
        transitionsByStatus: [],
        averageVotesAtTransition: 0,
        averageTimeToTransition: 0,
      };
    } catch (error) {
      console.error("Error getting status transition stats:", error);
      throw error;
    }
  }

  private static async sendStatusChangeNotification(
    project: any,
    oldStatus: ProjectStatus,
    newStatus: ProjectStatus,
    reason: string,
  ): Promise<void> {
    try {
      const owner = await User.findById(project.owner.type).select(
        "email profile.firstName profile.lastName",
      );
      if (!owner || !owner.email) {
        return;
      }

      const statusMessages: Record<
        ProjectStatus,
        { subject: string; message: string }
      > = {
        [ProjectStatus.IDEA]: {
          subject: "Project is in idea stage",
          message: "Your project is currently in the idea stage.",
        },
        [ProjectStatus.REVIEWING]: {
          subject: "🎉 Your project is now under review!",
          message:
            "Congratulations! Your project has received enough positive votes and is now being reviewed by our team.",
        },
        [ProjectStatus.VALIDATED]: {
          subject: "✅ Your project has been validated!",
          message:
            "Great news! Your project has been validated and can now proceed to the campaigning phase.",
        },
        [ProjectStatus.REJECTED]: {
          subject: "❌ Project status update",
          message: "Unfortunately, your project has been rejected.",
        },
        [ProjectStatus.CAMPAIGNING]: {
          subject: "Your project is now campaigning",
          message: "Your project is now in the campaigning phase.",
        },
        [ProjectStatus.LIVE]: {
          subject: "Your project is now live",
          message: "Your project is now live and open for participation.",
        },
        [ProjectStatus.COMPLETED]: {
          subject: "Your project has been completed",
          message: "Congratulations! Your project has been completed.",
        },
        [ProjectStatus.PAUSED]: {
          subject: "Your project has been paused",
          message: "Your project is currently paused.",
        },
        [ProjectStatus.CANCELLED]: {
          subject: "Your project has been cancelled",
          message: "Your project has been cancelled.",
        },
        [ProjectStatus.DRAFT]: {
          subject: "Your project is in draft",
          message: "Your project is currently in draft status.",
        },
        [ProjectStatus.AWAITING_BOUNDLESS_VERIFICATION]: {
          subject: "Awaiting Boundless Verification",
          message:
            "Your project is awaiting verification by the Boundless team.",
        },
        [ProjectStatus.PENDING_DEPLOYMENT]: {
          subject: "Pending Deployment",
          message: "Your project is pending deployment.",
        },
        [ProjectStatus.VOTING]: {
          subject: "Voting in Progress",
          message: "Your project is currently in the voting phase.",
        },
        [ProjectStatus.FUNDING]: {
          subject: "Funding in Progress",
          message: "Your project is currently in the funding phase.",
        },
        [ProjectStatus.FUNDED]: {
          subject: "Project Funded",
          message:
            "Congratulations! Your project has been successfully funded.",
        },
        [ProjectStatus.REFUND_PENDING]: {
          subject: "Refund Pending",
          message: "Your project is pending refunds to contributors.",
        },
      };

      const statusInfo = statusMessages[newStatus as ProjectStatus];
      if (!statusInfo) {
        return;
      }

      const emailContent = `
        <h2>${statusInfo.subject}</h2>
        <p>Hello ${owner.profile.firstName},</p>
        <p>${statusInfo.message}</p>
        <p><strong>Project:</strong> ${project.title}</p>
        <p><strong>Previous Status:</strong> ${oldStatus}</p>
        <p><strong>New Status:</strong> ${newStatus}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>You can view your project details in your dashboard.</p>
        <p>Best regards,<br>The Boundless Team</p>
      `;

      await sendEmail({
        to: owner.email,
        subject: statusInfo.subject,
        html: emailContent,
      });
    } catch (error) {
      console.error("Error sending status change notification:", error);
    }
  }

  static async forceCheckProject(
    projectId: string,
  ): Promise<StatusTransitionResult | null> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await this.checkAndUpdateSingleProject(
        projectId,
        this.DEFAULT_CONFIG,
        session,
      );

      if (result) {
        await session.commitTransaction();
      } else {
        await session.abortTransaction();
      }

      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export default ProjectStatusService;
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "user@example.com",
      pass: process.env.SMTP_PASS || "password",
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Boundless" <no-reply@boundlessfi.xyz>',
    to,
    subject,
    html,
  });
}
