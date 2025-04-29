import type { Request, Response } from "express";
import contractService from "../services/contract.service";
import Contract from "../models/contract.model";
import Milestone from "../models/milestone.model";
import { Types } from "mongoose";

/**
 * @desc    Deploy a new project contract
 * @route   POST /api/blockchain/projects/deploy
 * @access  Private
 */
export const deployProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, fundingGoal, milestones } = req.body;

    if (!projectId || !fundingGoal || !milestones || !Array.isArray(milestones)) {
      res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
      return;
    }

    const result = await contractService.deployProject({
      projectId,
      fundingGoal,
      milestones,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Contract deployment error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
};

/**
 * @desc    Fund a project
 * @route   POST /api/blockchain/projects/:projectId/fund
 * @access  Private
 */
export const fundProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, walletAddress, transactionHash } = req.body;
    const { projectId } = req.params;

    if (!amount || !walletAddress || !transactionHash) {
      res.status(400).json({
        success: false,
        message: "Missing required fields",
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
  } catch (error) {
    console.error("Project funding error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
};

/**
 * @desc    Release milestone funds
 * @route   POST /api/blockchain/projects/:projectId/milestones/:milestoneId/release
 * @access  Private
 */
export const releaseMilestone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, transactionHash } = req.body;
    const { projectId, milestoneId } = req.params;

    if (!amount || !transactionHash) {
      res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
      return;
    }

    const result = await contractService.releaseMilestone({
      projectId,
      milestoneId,
      amount,
      transactionHash,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Milestone release error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
};

/**
 * @desc    Get contract state for a project
 * @route   GET /api/blockchain/projects/:projectId/state
 * @access  Public
 */
export const getContractState = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    const state = await contractService.getContractState(projectId);

    res.status(200).json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error("Get contract state error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
};

/**
 * @desc    Get milestone status
 * @route   GET /api/blockchain/projects/:projectId/milestones/:milestoneId
 * @access  Public
 */
export const getMilestoneStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { milestoneId } = req.params;

    const status = await contractService.getMilestoneStatus(milestoneId);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Get milestone status error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
};

/**
 * @desc    Verify a transaction
 * @route   GET /api/blockchain/transactions/:transactionHash
 * @access  Public
 */
export const verifyTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionHash } = req.params;

    const status = await contractService.verifyTransaction(transactionHash);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Transaction verification error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
};

/**
 * @desc    Get transaction history for a project
 * @route   GET /api/blockchain/projects/:projectId/transactions
 * @access  Public
 */
export const getTransactionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    const transactions = await contractService.getTransactionHistory(projectId);

    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
}; 