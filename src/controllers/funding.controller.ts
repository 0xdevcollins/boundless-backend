import { Request, Response } from "express";
import ProjectModel, { ProjectStatus } from "../models/project.model";
import contractService from "../services/contract.service";
import TransactionModel from "../models/transaction.model";
import { isValidStellarAddress } from "../utils/wallet";
import { NotificationType } from "../models/notification.model";
import notificationModel from "../models/notification.model";

const MINIMUM_CONTRIBUTION_XLM = 1;
const MAXIMUM_CONTRIBUTION_XLM = 10000;

export const fundProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { amount, walletAddress, transactionHash } = req.body;
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!amount || !walletAddress || !transactionHash) {
      res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
      return;
    }

    // Validate wallet address
    if (!isValidStellarAddress(walletAddress)) {
      res.status(400).json({
        success: false,
        message: "This wallet address is not valid",
      });
      return;
    }

    // Minimum contribution check
    if (amount < MINIMUM_CONTRIBUTION_XLM) {
      res.status(400).json({
        success: false,
        message: "Amount is lower than the minimum requirement",
      });
      return;
    }

    // Maximum contribution check
    if (amount > MAXIMUM_CONTRIBUTION_XLM) {
      res.status(400).json({
        success: false,
        message: `Amount exceeds maximum allowed contribution of ${MAXIMUM_CONTRIBUTION_XLM} XLM`,
      });
      return;
    }

    // Check for duplicate transaction
    const existingTx = await TransactionModel.findOne({ transactionHash });
    if (existingTx) {
      res.status(400).json({
        success: false,
        message: "This transaction has already been processed",
      });
      return;
    }

    // Get project details from database
    const project = await ProjectModel.findById(projectId);
    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    // Check if funding period is still active
    if (project.funding?.endDate && new Date() > project.funding.endDate) {
      res.status(400).json({
        success: false,
        message: "The funding period has ended",
      });
      return;
    }

    // Check if user is project owner
    if (project.owner.type.toString() === req.user?.id) {
      res.status(400).json({
        success: false,
        message: "Project owners cannot fund their own projects",
      });
      return;
    }

    // Check if user is team member
    const isTeamMember = project.team.some(
      (member) => member.userId.toString() === req.user?.id,
    );
    if (isTeamMember) {
      res.status(400).json({
        success: false,
        message: "Team members cannot fund their own projects",
      });
      return;
    }

    const contractState = await contractService.getContractState(projectId);
    if (!contractState || contractState.status !== "FUNDING") {
      res.status(400).json({
        success: false,
        message: "Project is not in funding state",
      });
      return;
    }

    const result = await contractService.fundProject({
      projectId,
      amount,
      walletAddress,
      transactionHash,
    });

    res.status(200).json({
      success: true,
      data: result,
    });

    // Update project funding data
    project.funding.raised += amount;
    project.funding.contributors.push({
      user: req.user?.id,
      amount,
      date: new Date(),
      transactionHash,
    });

    let statusChanged = false;
    if (project.funding.raised >= project.funding.goal) {
      project.status = ProjectStatus.FUNDED;
      statusChanged = true;
    }
    await project.save();

    // Notification for successful funding
    await notificationModel.create([
      {
        userId,
        type: NotificationType.FUNDING_RECEIVED,
        title: "Funding Successful",
        message: `You successfully contributed ${amount} XLM to ${project.title}`,
        data: { projectId, amount, transactionHash },
        read: false,
        emailSent: false,
      },
      ...(project.status === "FUNDED"
        ? [
            {
              userId: project.owner.type,
              type: NotificationType.FUNDING_GOAL_MET,
              title: "Funding Goal Reached",
              message: `${project.title} has reached its funding goal!`,
              data: { projectId },
              read: false,
              emailSent: false,
            },
          ]
        : []),
    ]);

    res.status(200).json({
      success: true,
      data: {
        projectId,
        amount,
        transactionHash,
        newStatus: project.status,
      },
    });
  } catch (error) {
    console.error("Project funding error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
};
