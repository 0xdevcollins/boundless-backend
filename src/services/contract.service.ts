import {
  Keypair,
  TransactionBuilder,
  Operation,
  xdr,
  nativeToScVal,
  TimeoutInfinite,
  Horizon,
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

import TransactionModel, {
  TransactionStatus as DbTransactionStatus,
  TransactionType,
} from "../models/transaction.model";
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
    this.server = new Horizon.Server(sorobanConfig.networkUrl);

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
      const milestonesXdr = params.milestones.map((m) => {
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
      const account = await this.server.getAccount(
        this.adminKeypair.publicKey(),
      );

      // Create a contract deployment transaction
      const transaction = new TransactionBuilder(account, {
        fee: DEFAULT_FEE.toString(),
        networkPassphrase: sorobanConfig.networkPassphrase,
      })
        .addOperation(
          Operation.createStellarAssetContract({
            asset: PROJECT_FUNDING_CONTRACT_WASM_HASH,
            source: this.adminKeypair.publicKey(),
          }),
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

      // TODO: Create contract and milestone records when models are available
      console.log("Contract deployed with ID:", contractId);

      return {
        contractId,
        transactionHash: response.hash,
        status: "SUCCESS",
      };
    } catch (error) {
      console.error("Contract deployment error:", error);
      throw error;
    }
  }

  /**
   * Fund a project through the smart contract
   */
  async fundProject(params: FundParams): Promise<FundResult> {
    try {
      // Create transaction record
      const transactionRecord = new TransactionModel({
        projectId: new Types.ObjectId(params.projectId),
        type: TransactionType.FUNDING,
        amount: params.amount,
        fromAddress: params.walletAddress,
        toAddress: "", // Will be set from contract
        transactionHash: params.transactionHash,
        status: DbTransactionStatus.PENDING,
        timestamp: new Date(),
      });

      await transactionRecord.save();

      // Verify transaction on blockchain
      const txStatus = await this.verifyTransaction(params.transactionHash);

      if (txStatus.status === "SUCCESS") {
        transactionRecord.status = DbTransactionStatus.CONFIRMED;
        transactionRecord.confirmedAt = new Date();
        await transactionRecord.save();

        // Update contract state
        await this.updateContractFunding(params.projectId, params.amount);
      } else {
        transactionRecord.status = DbTransactionStatus.FAILED;
        await transactionRecord.save();
        throw new Error("Transaction verification failed");
      }

      return {
        transactionHash: params.transactionHash,
        status: "SUCCESS",
        amount: params.amount,
      };
    } catch (error) {
      console.error("Project funding error:", error);
      throw error;
    }
  }

  /**
   * Release funds for a completed milestone
   */
  async releaseMilestone(params: MilestoneParams): Promise<MilestoneResult> {
    try {
      // Create transaction record
      const transactionRecord = new TransactionModel({
        projectId: new Types.ObjectId(params.projectId),
        type: TransactionType.MILESTONE_RELEASE,
        amount: params.amount,
        fromAddress: "", // Contract address
        toAddress: "", // Project owner address
        transactionHash: params.transactionHash,
        status: DbTransactionStatus.PENDING,
        timestamp: new Date(),
      });

      await transactionRecord.save();

      // Verify transaction on blockchain
      const txStatus = await this.verifyTransaction(params.transactionHash);

      if (txStatus.status === "SUCCESS") {
        transactionRecord.status = DbTransactionStatus.CONFIRMED;
        transactionRecord.confirmedAt = new Date();
        await transactionRecord.save();

        // TODO: Update milestone status when model is available
        console.log("Milestone released:", params.milestoneId);
      } else {
        transactionRecord.status = DbTransactionStatus.FAILED;
        await transactionRecord.save();
        throw new Error("Transaction verification failed");
      }

      return {
        transactionHash: params.transactionHash,
        status: "SUCCESS",
        milestoneId: params.milestoneId,
      };
    } catch (error) {
      console.error("Milestone release error:", error);
      throw error;
    }
  }

  /**
   * Get the current state of a project's contract
   */
  async getContractState(projectId: string): Promise<ContractState | null> {
    // TODO: Implement when contract and milestone models are available
    return null;
  }

  /**
   * Get milestone status
   */
  async getMilestoneStatus(milestoneId: string): Promise<MilestoneInfo | null> {
    // TODO: Implement when milestone model is available
    return null;
  }

  /**
   * Verify a transaction on the blockchain
   */
  async verifyTransaction(transactionHash: string): Promise<TxStatus> {
    try {
      const response = await this.server.getTransaction(transactionHash);

      return {
        hash: transactionHash,
        status: response.successful ? "SUCCESS" : "FAILED",
        blockHeight: response.ledger_attr,
        timestamp: response.created_at,
      };
    } catch (error) {
      console.error("Transaction verification error:", error);
      return {
        hash: transactionHash,
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
        projectId: new Types.ObjectId(projectId),
      }).sort({ timestamp: -1 });

      return transactions.map((tx) => ({
        hash: tx.transactionHash,
        type: tx.type,
        amount: tx.amount,
        timestamp: tx.timestamp.toISOString(),
        status: tx.status,
      }));
    } catch (error) {
      console.error("Get transaction history error:", error);
      throw error;
    }
  }

  /**
   * Wait for a transaction to be confirmed
   */
  private async waitForTransaction(hash: string): Promise<any> {
    const maxRetries = parseInt(MAX_TX_RETRIES.toString());
    const timeoutSeconds = parseInt(TX_TIMEOUT_SECONDS.toString());

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await this.server.getTransaction(hash);
        if (response.successful !== undefined) {
          return response;
        }
      } catch (error) {
        // Transaction not found yet, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(
      `Transaction ${hash} not confirmed within ${timeoutSeconds} seconds`,
    );
  }

  /**
   * Extract contract ID from transaction result
   */
  private extractContractIdFromResult(result: any): string {
    // This is a placeholder implementation
    // In a real implementation, you would extract the contract ID from the transaction result
    return `contract_${Date.now()}`;
  }

  /**
   * Update contract funding amount
   */
  private async updateContractFunding(
    projectId: string,
    amount: number,
  ): Promise<void> {
    // TODO: Implement when contract model is available
    console.log(
      "Updating contract funding for project:",
      projectId,
      "amount:",
      amount,
    );
  }
}

const contractService = new ContractService();
export default contractService;
