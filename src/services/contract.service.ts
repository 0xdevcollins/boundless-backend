import {
  Keypair,
  TransactionBuilder,
  Operation,
  xdr,
  nativeToScVal,
  TimeoutInfinite,
} from "@stellar/stellar-sdk";
import Server from "@stellar/stellar-sdk";

import {
  sorobanConfig,
  ADMIN_SECRET_KEY,
  DEFAULT_FEE,
  DEFAULT_GAS_BUDGET,
  PROJECT_FUNDING_CONTRACT_WASM_HASH,
  TX_TIMEOUT_SECONDS,
  MAX_TX_RETRIES,
} from "../config/soroban";

import ContractModel from "../models/contract.model";
import TransactionModel, { TransactionStatus as DbTransactionStatus, TransactionType } from "../models/transaction.model";
import MilestoneModel, { MilestoneStatus as DbMilestoneStatus } from "../models/milestone.model";
import { Types } from "mongoose";

// Interface definitions
export interface DeployParams {
  projectId: string;
  fundingGoal: number;
  milestones: Array<{
    title: string;
    amount: number;
    dueDate: string;
  }>;
}

export interface DeployResult {
  contractId: string;
  transactionHash: string;
  status: string;
}

export interface FundParams {
  projectId: string;
  amount: number;
  walletAddress: string;
  transactionHash: string;
}

export interface FundResult {
  transactionHash: string;
  status: string;
  amount: number;
}

export interface MilestoneParams {
  projectId: string;
  milestoneId: string;
  amount: number;
  transactionHash: string;
}

export interface MilestoneResult {
  transactionHash: string;
  status: string;
  milestoneId: string;
}

export interface ContractState {
  address: string;
  fundingGoal: number;
  raised: number;
  milestones: Array<{
    id: string;
    amount: number;
    released: boolean;
    releaseDate?: string;
  }>;
  status: string;
  lastUpdated: string;
}

export interface MilestoneInfo {
  id: string;
  released: boolean;
  amount: number;
  dueDate: string;
}

export interface TxStatus {
  hash: string;
  status: string;
  blockHeight?: number;
  timestamp?: string;
}

export interface TxInfo {
  hash: string;
  type: string;
  amount: number;
  timestamp: string;
  status: string;
}

class ContractService {
  private server: typeof Server;
  private adminKeypair: Keypair;

  constructor() {
    // Initialize Soroban server connection
    this.server = new Server(sorobanConfig.networkUrl);
    
    // Initialize admin keypair from secret key
    if (!ADMIN_SECRET_KEY) {
      throw new Error("Admin secret key is not configured");
    }
    this.adminKeypair = Keypair.fromSecret(ADMIN_SECRET_KEY);
  }

  /**
   * Deploy a new project funding contract to the Soroban network
   */
  async deployProject(params: DeployParams): Promise<DeployResult> {
    try {
      if (!PROJECT_FUNDING_CONTRACT_WASM_HASH) {
        throw new Error("Contract WASM hash is not configured");
      }

      // Convert milestone data to Soroban-compatible format
      const milestonesXdr = params.milestones.map(m => {
        return xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: nativeToScVal("title"),
            val: nativeToScVal(m.title),
          }),
          new xdr.ScMapEntry({
            key: nativeToScVal("amount"),
            val: nativeToScVal(m.amount),
          }),
          new xdr.ScMapEntry({
            key: nativeToScVal("due_date"),
            val: nativeToScVal(new Date(m.dueDate).getTime() / 1000), // Convert to UNIX timestamp
          }),
          new xdr.ScMapEntry({
            key: nativeToScVal("released"),
            val: nativeToScVal(false),
          }),
        ]);
      });

      // Get the admin account
      const account = await this.server.getAccount(this.adminKeypair.publicKey());

      // Create a contract deployment transaction
      const transaction = new TransactionBuilder(account, {
        fee: DEFAULT_FEE.toString(),
        networkPassphrase: sorobanConfig.networkPassphrase,
      })
        .addOperation(
          Operation.createStellarAssetContract({
            asset: PROJECT_FUNDING_CONTRACT_WASM_HASH,
            source: this.adminKeypair.publicKey(),
          })
        )
        .setTimeout(TimeoutInfinite)
        .build();

      // Sign the transaction
      transaction.sign(this.adminKeypair);
      
      // Submit the transaction
      const response = await this.server.sendTransaction(transaction);
      
      // Wait for confirmation
      const result = await this.waitForTransaction(response.hash);
      
      if (result.status !== "SUCCESS") {
        throw new Error(`Transaction failed: ${result.status}`);
      }

      // Extract contract ID from transaction result
      const contractId = this.extractContractIdFromResult(result);
      
      // Create a new contract record in the database
      const contractRecord = new ContractModel({
        projectId: new Types.ObjectId(params.projectId),
        address: contractId,
        network: process.env.STELLAR_NETWORK || "testnet",
        fundingGoal: params.fundingGoal,
        raised: 0,
        status: "DEPLOYED",
        deployedAt: new Date(),
        lastUpdated: new Date(),
      });
      await contractRecord.save();
      
      // Create milestone records
      const milestonePromises = params.milestones.map(async (m) => {
        return new MilestoneModel({
          projectId: new Types.ObjectId(params.projectId),
          contractId: contractRecord._id,
          title: m.title,
          amount: m.amount,
          dueDate: new Date(m.dueDate),
          status: DbMilestoneStatus.PENDING,
        }).save();
      });
      await Promise.all(milestonePromises);
      
      // Create a transaction record
      const txRecord = new TransactionModel({
        projectId: new Types.ObjectId(params.projectId),
        type: TransactionType.DEPLOYMENT,
        amount: 0, // Deployment doesn't transfer funds
        fromAddress: this.adminKeypair.publicKey(),
        toAddress: contractId,
        transactionHash: response.hash,
        status: DbTransactionStatus.CONFIRMED,
        timestamp: new Date(),
        confirmedAt: new Date(),
      });
      await txRecord.save();
      
      return {
        contractId,
        transactionHash: response.hash,
        status: "SUCCESS",
      };
    } catch (error) {
      console.error("Contract deployment failed:", error);
      throw error;
    }
  }

  /**
   * Fund a project by sending XLM to the contract
   */
  async fundProject(params: FundParams): Promise<FundResult> {
    try {
      // First, verify the transaction exists on the Stellar network
      const txVerification = await this.verifyTransaction(params.transactionHash);
      
      if (txVerification.status !== "SUCCESS") {
        throw new Error(`Transaction verification failed: ${txVerification.status}`);
      }
      
      // Find the contract for this project
      const contract = await ContractModel.findOne({ projectId: new Types.ObjectId(params.projectId) });
      
      if (!contract) {
        throw new Error(`No contract found for project ${params.projectId}`);
      }
      
      // Update the contract's raised amount
      contract.raised += params.amount;
      contract.lastUpdated = new Date();
      await contract.save();
      
      // Record the funding transaction
      const txRecord = new TransactionModel({
        projectId: new Types.ObjectId(params.projectId),
        type: TransactionType.FUNDING,
        amount: params.amount,
        fromAddress: params.walletAddress,
        toAddress: contract.address,
        transactionHash: params.transactionHash,
        status: DbTransactionStatus.CONFIRMED,
        timestamp: new Date(),
        confirmedAt: new Date(),
      });
      await txRecord.save();
      
      return {
        transactionHash: params.transactionHash,
        status: "SUCCESS",
        amount: params.amount,
      };
    } catch (error) {
      console.error("Project funding failed:", error);
      throw error;
    }
  }

  /**
   * Release funds for a completed milestone
   */
  async releaseMilestone(params: MilestoneParams): Promise<MilestoneResult> {
    try {
      // Verify the transaction
      const txVerification = await this.verifyTransaction(params.transactionHash);
      
      if (txVerification.status !== "SUCCESS") {
        throw new Error(`Transaction verification failed: ${txVerification.status}`);
      }
      
      // Find the milestone
      const milestone = await MilestoneModel.findOne({
        _id: new Types.ObjectId(params.milestoneId),
        projectId: new Types.ObjectId(params.projectId),
      });
      
      if (!milestone) {
        throw new Error(`Milestone ${params.milestoneId} not found for project ${params.projectId}`);
      }
      
      // Find the contract
      const contract = await ContractModel.findById(milestone.contractId);
      
      if (!contract) {
        throw new Error(`Contract not found for milestone ${params.milestoneId}`);
      }
      
      // Get the admin account
      const account = await this.server.getAccount(this.adminKeypair.publicKey());
      
      // Build transaction to release milestone
      // This is simplified for demo purposes
      const transaction = new TransactionBuilder(account, {
        fee: DEFAULT_FEE.toString(),
        networkPassphrase: sorobanConfig.networkPassphrase,
      })
        .setTimeout(TX_TIMEOUT_SECONDS)
        .build();
      
      // Sign the transaction
      transaction.sign(this.adminKeypair);
      
      // Submit transaction
      const response = await this.server.sendTransaction(transaction);
      
      // Wait for confirmation
      const result = await this.waitForTransaction(response.hash);
      
      if (result.status !== "SUCCESS") {
        throw new Error(`Milestone release transaction failed: ${result.status}`);
      }
      
      // Update milestone status
      milestone.status = DbMilestoneStatus.RELEASED;
      milestone.releasedAt = new Date();
      await milestone.save();
      
      // Record the transaction
      const txRecord = new TransactionModel({
        projectId: new Types.ObjectId(params.projectId),
        type: TransactionType.MILESTONE_RELEASE,
        amount: params.amount,
        fromAddress: contract.address,
        toAddress: this.adminKeypair.publicKey(), // This would typically be the project owner's address
        transactionHash: params.transactionHash,
        status: DbTransactionStatus.CONFIRMED,
        timestamp: new Date(),
        confirmedAt: new Date(),
      });
      await txRecord.save();
      
      // Update milestone with transaction reference
      milestone.releaseTransaction = txRecord._id;
      await milestone.save();
      
      return {
        transactionHash: response.hash,
        status: "SUCCESS",
        milestoneId: params.milestoneId,
      };
    } catch (error) {
      console.error("Milestone release failed:", error);
      throw error;
    }
  }

  /**
   * Get the current state of a contract
   */
  async getContractState(projectId: string): Promise<ContractState> {
    try {
      // Find the contract for this project
      const contract = await ContractModel.findOne({ projectId: new Types.ObjectId(projectId) });
      
      if (!contract) {
        throw new Error(`No contract found for project ${projectId}`);
      }
      
      // Get milestones associated with this contract
      const milestones = await MilestoneModel.find({ contractId: contract._id });
      
      return {
        address: contract.address,
        fundingGoal: contract.fundingGoal,
        raised: contract.raised,
        milestones: milestones.map(m => ({
          id: m._id.toString(),
          amount: m.amount,
          released: m.status === DbMilestoneStatus.RELEASED,
          releaseDate: m.releasedAt ? m.releasedAt.toISOString() : undefined,
        })),
        status: contract.status,
        lastUpdated: contract.lastUpdated.toISOString(),
      };
    } catch (error) {
      console.error("Failed to get contract state:", error);
      throw error;
    }
  }

  /**
   * Get the status of a specific milestone
   */
  async getMilestoneStatus(milestoneId: string): Promise<MilestoneInfo> {
    try {
      const milestone = await MilestoneModel.findById(new Types.ObjectId(milestoneId));
      
      if (!milestone) {
        throw new Error(`Milestone ${milestoneId} not found`);
      }
      
      return {
        id: milestone._id.toString(),
        released: milestone.status === DbMilestoneStatus.RELEASED,
        amount: milestone.amount,
        dueDate: milestone.dueDate.toISOString(),
      };
    } catch (error) {
      console.error("Failed to get milestone status:", error);
      throw error;
    }
  }

  /**
   * Verify a transaction on the Stellar network
   */
  async verifyTransaction(txHash: string): Promise<TxStatus> {
    try {
      const tx = await this.server.getTransaction(txHash);
      
      return {
        hash: txHash,
        status: "SUCCESS", // Simplified for demo
        blockHeight: 0, // Would come from tx result
        timestamp: new Date().toISOString(), // Would come from tx result
      };
    } catch (error) {
      console.error("Transaction verification failed:", error);
      return {
        hash: txHash,
        status: "FAILED",
      };
    }
  }

  /**
   * Get transaction history for a project
   */
  async getTransactionHistory(projectId: string): Promise<TxInfo[]> {
    try {
      const transactions = await TransactionModel.find({ 
        projectId: new Types.ObjectId(projectId) 
      }).sort({ timestamp: -1 });
      
      return transactions.map(tx => ({
        hash: tx.transactionHash,
        type: tx.type,
        amount: tx.amount,
        timestamp: tx.timestamp.toISOString(),
        status: tx.status,
      }));
    } catch (error) {
      console.error("Failed to get transaction history:", error);
      throw error;
    }
  }

  /**
   * Wait for a transaction to be confirmed
   */
  private async waitForTransaction(txHash: string): Promise<{ status: string; hash: string }> {
    let retries = 0;
    
    while (retries < MAX_TX_RETRIES) {
      try {
        const response = await this.server.getTransaction(txHash);
        
        if (response.status !== "NOT_FOUND") {
          return response;
        }
      } catch (error) {
        console.warn(`Waiting for transaction ${txHash}, retry ${retries + 1}/${MAX_TX_RETRIES}`);
      }
      
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
    }
    
    throw new Error(`Transaction ${txHash} not confirmed after ${MAX_TX_RETRIES} retries`);
  }

  /**
   * Extract contract ID from transaction result
   */
  private extractContractIdFromResult(result: { status: string }): string {
    try {
      // This is a simplified implementation
      // In a real implementation, you'd parse the transaction result to extract the contract ID
      
      // Placeholder for demonstration
      return "CONTRACT_ID_EXTRACTED_FROM_RESULT";
    } catch (error) {
      console.error("Failed to extract contract ID from result:", error);
      throw new Error("Failed to extract contract ID from transaction result");
    }
  }
}

export default new ContractService(); 