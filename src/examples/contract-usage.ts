/**
 * Example usage of the Soroban Contract Service
 *
 * This file demonstrates how to use the contract service for:
 * - Creating unsigned transactions
 * - Merging multiple transactions
 * - Simulating transactions
 * - Submitting signed transactions
 */

import { Networks, Keypair } from "@stellar/stellar-sdk";
import { contractService } from "../services/contract.service";
import { TransactionUtils } from "../utils/transaction.utils";
import {
  UnsignedTransaction,
  MergedTransaction,
  ContractMethodConfig,
} from "../types/contract";

// Example configuration
const EXAMPLE_CONFIG = {
  sourceAccount: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", // Replace with real account
  contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHXCN3A3A", // Replace with real contract ID
  network: Networks.TESTNET,
};

/**
 * Example 1: Create a single unsigned transaction
 */
export async function createSingleTransaction() {
  try {
    console.log("=== Creating Single Transaction ===");

    const unsignedTransaction = contractService.createUnsignedTransaction(
      EXAMPLE_CONFIG.sourceAccount,
      EXAMPLE_CONFIG.contractId,
      "initialize", // Contract method
      ["param1", "param2"], // Parameters
      EXAMPLE_CONFIG.network,
      "100", // Fee
      "Initialization transaction", // Memo
    );

    console.log("Unsigned Transaction Created:", {
      contractId: unsignedTransaction.contractId,
      operation: unsignedTransaction.operation,
      parameters: unsignedTransaction.parameters,
      metadata: unsignedTransaction.metadata,
    });

    // Serialize for frontend
    const serialized =
      contractService.serializeTransaction(unsignedTransaction);
    console.log("Serialized Transaction:", serialized);

    return unsignedTransaction;
  } catch (error) {
    console.error("Error creating single transaction:", error);
    throw error;
  }
}

/**
 * Example 2: Create multiple unsigned transactions
 */
export async function createMultipleTransactions() {
  try {
    console.log("=== Creating Multiple Transactions ===");

    const operations: ContractMethodConfig[] = [
      {
        method: "fund",
        parameters: ["1000000"], // Amount
        contractId: EXAMPLE_CONFIG.contractId,
        description: "Fund the project",
        requiresAuth: true,
        estimatedFee: "100",
      },
      {
        method: "create_milestone",
        parameters: ["Milestone 1", "First milestone description"],
        contractId: EXAMPLE_CONFIG.contractId,
        description: "Create first milestone",
        requiresAuth: true,
        estimatedFee: "100",
      },
      {
        method: "vote",
        parameters: ["milestone_1", true], // Vote for milestone
        contractId: EXAMPLE_CONFIG.contractId,
        description: "Vote on milestone",
        requiresAuth: true,
        estimatedFee: "100",
      },
    ];

    const unsignedTransactions = contractService.createMultipleTransactions(
      EXAMPLE_CONFIG.sourceAccount,
      operations,
      EXAMPLE_CONFIG.network,
      "100",
    );

    console.log(
      `Created ${unsignedTransactions.length} transactions:`,
      unsignedTransactions.map((tx) => ({
        contractId: tx.contractId,
        operation: tx.operation,
        parameters: tx.parameters,
      })),
    );

    return unsignedTransactions;
  } catch (error) {
    console.error("Error creating multiple transactions:", error);
    throw error;
  }
}

/**
 * Example 3: Merge multiple transactions into one
 */
export async function mergeTransactions() {
  try {
    console.log("=== Merging Transactions ===");

    // First create multiple transactions
    const transactions = await createMultipleTransactions();

    // Merge them into a single transaction
    const mergedTransaction = contractService.mergeTransactions(
      transactions,
      "sequential", // or 'parallel'
    );

    console.log("Merged Transaction:", {
      operations: mergedTransaction.operations,
      metadata: mergedTransaction.metadata,
    });

    // Serialize for frontend
    const serialized = contractService.serializeTransaction(mergedTransaction);
    console.log("Serialized Merged Transaction:", serialized);

    return mergedTransaction;
  } catch (error) {
    console.error("Error merging transactions:", error);
    throw error;
  }
}

/**
 * Example 4: Simulate a transaction
 */
export async function simulateTransaction() {
  try {
    console.log("=== Simulating Transaction ===");

    // Create a transaction to simulate
    const transaction = await createSingleTransaction();

    // Simulate the transaction
    const simulation = await contractService.simulateTransaction(
      transaction,
      EXAMPLE_CONFIG.network,
    );

    console.log("Simulation Result:", {
      success: simulation.success,
      result: simulation.result,
      error: simulation.error,
      cost: simulation.cost,
      events: simulation.events,
    });

    return simulation;
  } catch (error) {
    console.error("Error simulating transaction:", error);
    throw error;
  }
}

/**
 * Example 5: Submit a signed transaction
 */
export async function submitSignedTransaction() {
  try {
    console.log("=== Submitting Signed Transaction ===");

    // Create an unsigned transaction
    const unsignedTransaction = await createSingleTransaction();

    // In a real scenario, this would be signed by the frontend
    // For this example, we'll create a dummy keypair
    const keypair = Keypair.random();

    // Sign the transaction
    const signedTransaction = TransactionUtils.signTransaction(
      unsignedTransaction,
      keypair,
    );

    console.log("Signed Transaction:", {
      signatures: signedTransaction.signatures,
      signedAt: signedTransaction.metadata?.signedAt,
    });

    // Submit to network
    const result = await contractService.submitTransaction(
      signedTransaction,
      EXAMPLE_CONFIG.network,
    );

    console.log("Submission Result:", {
      success: result.success,
      result: result.result,
      error: result.error,
      transactionHash: result.transactionHash,
      cost: result.cost,
    });

    return result;
  } catch (error) {
    console.error("Error submitting signed transaction:", error);
    throw error;
  }
}

/**
 * Example 6: Call a contract method (read-only)
 */
export async function callContractMethod() {
  try {
    console.log("=== Calling Contract Method (Read-only) ===");

    const result = await contractService.callContractMethod(
      EXAMPLE_CONFIG.contractId,
      "get_balance", // Read-only method
      [EXAMPLE_CONFIG.sourceAccount], // Parameters
      EXAMPLE_CONFIG.network,
    );

    console.log("Contract Method Call Result:", {
      success: result.success,
      result: result.result,
      error: result.error,
      cost: result.cost,
    });

    return result;
  } catch (error) {
    console.error("Error calling contract method:", error);
    throw error;
  }
}

/**
 * Example 7: Get account and network information
 */
export async function getAccountAndNetworkInfo() {
  try {
    console.log("=== Getting Account and Network Info ===");

    // Get network information
    const networkInfo = contractService.getNetworkInfo(EXAMPLE_CONFIG.network);
    console.log("Network Info:", networkInfo);

    // Get account information
    const accountInfo = await contractService.getAccountInfo(
      EXAMPLE_CONFIG.sourceAccount,
      EXAMPLE_CONFIG.network,
    );
    console.log("Account Info:", accountInfo);

    // Get network status
    const networkStatus = await contractService.getNetworkStatus(
      EXAMPLE_CONFIG.network,
    );
    console.log("Network Status:", networkStatus);

    return { networkInfo, accountInfo, networkStatus };
  } catch (error) {
    console.error("Error getting account and network info:", error);
    throw error;
  }
}

/**
 * Example 8: Complete workflow - Create, merge, simulate, and prepare for signing
 */
export async function completeWorkflow() {
  try {
    console.log("=== Complete Workflow Example ===");

    // Step 1: Create multiple transactions
    const transactions = await createMultipleTransactions();

    // Step 2: Merge transactions
    const mergedTransaction = contractService.mergeTransactions(transactions);

    // Step 3: Simulate the merged transaction
    const simulation = await contractService.simulateTransaction(
      mergedTransaction,
      EXAMPLE_CONFIG.network,
    );

    if (!simulation.success) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    // Step 4: Serialize for frontend signing
    const serializedForFrontend =
      contractService.serializeTransaction(mergedTransaction);

    console.log("Workflow Complete:", {
      originalTransactionCount: transactions.length,
      mergedOperations: mergedTransaction.operations.length,
      simulationSuccess: simulation.success,
      estimatedCost: simulation.cost,
      serializedForFrontend: serializedForFrontend,
    });

    return {
      transactions,
      mergedTransaction,
      simulation,
      serializedForFrontend,
    };
  } catch (error) {
    console.error("Error in complete workflow:", error);
    throw error;
  }
}

/**
 * Example 9: Frontend integration example
 */
export function frontendIntegrationExample() {
  console.log("=== Frontend Integration Example ===");

  // This is how the frontend would handle the transaction
  const frontendWorkflow = {
    // 1. Backend creates and sends unsigned transaction
    receiveUnsignedTransaction: (serializedTransaction: string) => {
      console.log(
        "Frontend received serialized transaction:",
        serializedTransaction,
      );

      // 2. Frontend deserializes the transaction
      const transaction = TransactionUtils.deserializeTransaction(
        serializedTransaction,
      );
      console.log("Frontend deserialized transaction:", transaction);

      // 3. Frontend signs the transaction (this would be done with user's wallet)
      // const signedTransaction = signTransactionWithWallet(transaction, userWallet);

      // 4. Frontend sends signed transaction back to backend
      // return sendSignedTransactionToBackend(signedTransaction);
    },

    // Example of how to handle multiple transactions
    receiveMultipleTransactions: (serializedTransactions: string[]) => {
      console.log(
        "Frontend received multiple transactions:",
        serializedTransactions.length,
      );

      // Deserialize all transactions
      const transactions = serializedTransactions.map((serialized) =>
        TransactionUtils.deserializeTransaction(serialized),
      );

      // User can choose to sign individually or merge and sign once
      console.log("User can sign individually or merge and sign once");
    },
  };

  return frontendWorkflow;
}

// Export all examples for easy testing
export const examples = {
  createSingleTransaction,
  createMultipleTransactions,
  mergeTransactions,
  simulateTransaction,
  submitSignedTransaction,
  callContractMethod,
  getAccountAndNetworkInfo,
  completeWorkflow,
  frontendIntegrationExample,
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log("Running Contract Service Examples...\n");

  // Run a simple example
  createSingleTransaction()
    .then(() => console.log("\nExample completed successfully!"))
    .catch((error) => console.error("\nExample failed:", error));
}
