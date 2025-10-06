/**
 * Boundless Contract Service Usage Examples
 *
 * This file demonstrates how to use the Boundless contract service for:
 * - Campaign Management
 * - Grant Management
 * - Hackathon Management
 * - Milestone Management
 * - Escrow Management
 * - Transaction Merging and Signing
 */

import { Networks } from "@stellar/stellar-sdk";
import { createBoundlessContractService } from "../services/boundless-contract.service";
import { contractService } from "../services/contract.service";
import { TransactionUtils } from "../utils/transaction.utils";
import {
  EntityType,
  Status,
  MilestoneStatus,
  CreateCampaignParams,
  FundCampaignParams,
  CreateGrantParams,
  CreateHackathonParams,
  CreateMilestoneParams,
  ReleaseMilestoneParams,
  UpdateMilestoneParams,
  ApproveMilestoneParams,
  RejectMilestoneParams,
  RaiseDisputeParams,
  Milestone,
} from "../types/contract";

// Example configuration
const EXAMPLE_CONFIG = {
  sourceAccount: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", // Replace with real account
  contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHXCN3A3A", // Replace with real contract ID
  adminAccount: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", // Replace with real admin
  network: Networks.TESTNET,
};

// Initialize the Boundless contract service
const boundlessService = createBoundlessContractService(
  EXAMPLE_CONFIG.contractId,
  EXAMPLE_CONFIG.network,
);

/**
 * Example 1: Campaign Management Workflow
 */
export async function campaignManagementExample() {
  try {
    console.log("=== Campaign Management Example ===");

    // 1. Create campaign milestones
    const milestones: Milestone[] = [
      {
        id: 1,
        description: "Project Planning and Design",
        amount: "1000000", // 1,000,000 stroops
        status: MilestoneStatus.PENDING,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 2,
        description: "MVP Development",
        amount: "2000000", // 2,000,000 stroops
        status: MilestoneStatus.PENDING,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 3,
        description: "Final Release",
        amount: "3000000", // 3,000,000 stroops
        status: MilestoneStatus.PENDING,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ];

    // 2. Create campaign parameters
    const campaignParams: CreateCampaignParams = {
      owner: EXAMPLE_CONFIG.sourceAccount,
      title: "DeFi Lending Protocol",
      description: "A decentralized lending protocol for the Stellar network",
      goal: "6000000", // 6,000,000 stroops total
      escrow_contract_id:
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // Trustless Work escrow
      milestones: milestones,
    };

    // 3. Create campaign transaction
    const createCampaignTx = await boundlessService.createCampaign(
      EXAMPLE_CONFIG.sourceAccount,
      campaignParams,
      EXAMPLE_CONFIG.network,
    );

    console.log("Campaign Creation Transaction:", {
      contractId: createCampaignTx.contractId,
      operation: createCampaignTx.operation,
      parameters: createCampaignTx.parameters,
    });

    // 4. Create funding transaction
    const fundParams: FundCampaignParams = {
      campaign_id: 1, // This would be the actual campaign ID
      backer: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      amount: "1000000", // 1,000,000 stroops
    };

    const fundCampaignTx = await boundlessService.fundCampaign(
      EXAMPLE_CONFIG.sourceAccount,
      fundParams,
      EXAMPLE_CONFIG.network,
    );

    console.log("Campaign Funding Transaction:", {
      contractId: fundCampaignTx.contractId,
      operation: fundCampaignTx.operation,
      parameters: fundCampaignTx.parameters,
    });

    // 5. Merge transactions for single signature
    const mergedTransaction = contractService.mergeTransactions([
      createCampaignTx,
      fundCampaignTx,
    ]);

    console.log("Merged Campaign Transactions:", {
      operations: mergedTransaction.operations,
      metadata: mergedTransaction.metadata,
    });

    // 6. Serialize for frontend
    const serialized = contractService.serializeTransaction(mergedTransaction);
    console.log("Serialized for Frontend:", serialized);

    return {
      createCampaignTx,
      fundCampaignTx,
      mergedTransaction,
      serialized,
    };
  } catch (error) {
    console.error("Error in campaign management example:", error);
    throw error;
  }
}

/**
 * Example 2: Grant Management Workflow
 */
export async function grantManagementExample() {
  try {
    console.log("=== Grant Management Example ===");

    // 1. Create grant parameters
    const grantParams: CreateGrantParams = {
      sponsor: EXAMPLE_CONFIG.sourceAccount,
      title: "Stellar Ecosystem Development Grant",
      description: "Supporting innovative projects on the Stellar network",
      pool: "10000000", // 10,000,000 stroops
      winners: 5, // 5 winners
    };

    // 2. Create grant transaction
    const createGrantTx = await boundlessService.createGrant(
      EXAMPLE_CONFIG.sourceAccount,
      grantParams,
      EXAMPLE_CONFIG.network,
    );

    console.log("Grant Creation Transaction:", {
      contractId: createGrantTx.contractId,
      operation: createGrantTx.operation,
      parameters: createGrantTx.parameters,
    });

    // 3. Apply to grant transaction
    const applyToGrantTx = await boundlessService.applyToGrant(
      EXAMPLE_CONFIG.sourceAccount,
      1, // grant_id
      "DeFi Protocol Project",
      EXAMPLE_CONFIG.network,
    );

    console.log("Grant Application Transaction:", {
      contractId: applyToGrantTx.contractId,
      operation: applyToGrantTx.operation,
      parameters: applyToGrantTx.parameters,
    });

    // 4. Select winners transaction (admin only)
    const winners = [
      "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
      "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      "GFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    ];

    const selectWinnersTx = await boundlessService.selectGrantWinners(
      EXAMPLE_CONFIG.adminAccount,
      1, // grant_id
      winners,
      EXAMPLE_CONFIG.adminAccount,
      EXAMPLE_CONFIG.network,
    );

    console.log("Select Winners Transaction:", {
      contractId: selectWinnersTx.contractId,
      operation: selectWinnersTx.operation,
      parameters: selectWinnersTx.parameters,
    });

    // 5. Merge all grant transactions
    const mergedTransaction = contractService.mergeTransactions([
      createGrantTx,
      applyToGrantTx,
      selectWinnersTx,
    ]);

    console.log("Merged Grant Transactions:", {
      operations: mergedTransaction.operations,
      metadata: mergedTransaction.metadata,
    });

    return {
      createGrantTx,
      applyToGrantTx,
      selectWinnersTx,
      mergedTransaction,
    };
  } catch (error) {
    console.error("Error in grant management example:", error);
    throw error;
  }
}

/**
 * Example 3: Hackathon Management Workflow
 */
export async function hackathonManagementExample() {
  try {
    console.log("=== Hackathon Management Example ===");

    // 1. Create hackathon parameters
    const hackathonParams: CreateHackathonParams = {
      organizer: EXAMPLE_CONFIG.sourceAccount,
      title: "Stellar DeFi Hackathon 2024",
      description: "Build the future of DeFi on Stellar",
      theme: "Decentralized Finance",
      prize_pool: "50000000", // 50,000,000 stroops
    };

    // 2. Create hackathon transaction
    const createHackathonTx = await boundlessService.createHackathon(
      EXAMPLE_CONFIG.sourceAccount,
      hackathonParams,
      EXAMPLE_CONFIG.network,
    );

    console.log("Hackathon Creation Transaction:", {
      contractId: createHackathonTx.contractId,
      operation: createHackathonTx.operation,
      parameters: createHackathonTx.parameters,
    });

    // 3. Add judges
    const judges = [
      {
        address: "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
        name: "Alice",
      },
      {
        address: "GHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
        name: "Bob",
      },
      {
        address: "GIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
        name: "Charlie",
      },
    ];

    const addJudgeTxs = await Promise.all(
      judges.map((judge) =>
        boundlessService.addHackathonJudge(
          EXAMPLE_CONFIG.adminAccount,
          1, // hackathon_id
          judge.address,
          judge.name,
          EXAMPLE_CONFIG.adminAccount,
          EXAMPLE_CONFIG.network,
        ),
      ),
    );

    console.log("Add Judges Transactions:", addJudgeTxs.length);

    // 4. Submit hackathon entry
    const submitEntryTx = await boundlessService.submitHackathonEntry(
      EXAMPLE_CONFIG.sourceAccount,
      1, // hackathon_id
      "DeFi Lending Protocol",
      EXAMPLE_CONFIG.network,
    );

    console.log("Submit Entry Transaction:", {
      contractId: submitEntryTx.contractId,
      operation: submitEntryTx.operation,
      parameters: submitEntryTx.parameters,
    });

    // 5. Judge entry
    const judgeEntryTx = await boundlessService.judgeHackathonEntry(
      judges[0].address,
      1, // hackathon_id
      "DeFi Lending Protocol",
      85, // score
      judges[0].address,
      EXAMPLE_CONFIG.network,
    );

    console.log("Judge Entry Transaction:", {
      contractId: judgeEntryTx.contractId,
      operation: judgeEntryTx.operation,
      parameters: judgeEntryTx.parameters,
    });

    // 6. Merge hackathon transactions
    const allHackathonTxs = [
      createHackathonTx,
      ...addJudgeTxs,
      submitEntryTx,
      judgeEntryTx,
    ];
    const mergedTransaction =
      contractService.mergeTransactions(allHackathonTxs);

    console.log("Merged Hackathon Transactions:", {
      operations: mergedTransaction.operations,
      metadata: mergedTransaction.metadata,
    });

    return {
      createHackathonTx,
      addJudgeTxs,
      submitEntryTx,
      judgeEntryTx,
      mergedTransaction,
    };
  } catch (error) {
    console.error("Error in hackathon management example:", error);
    throw error;
  }
}

/**
 * Example 4: Milestone Management Workflow
 */
export async function milestoneManagementExample() {
  try {
    console.log("=== Milestone Management Example ===");

    // 1. Create milestone for campaign
    const createMilestoneParams: CreateMilestoneParams = {
      entity_id: 1, // campaign_id
      entity_type: EntityType.CAMPAIGN,
      description: "Complete MVP Development",
      amount: "2000000", // 2,000,000 stroops
    };

    const createMilestoneTx = await boundlessService.createMilestone(
      EXAMPLE_CONFIG.sourceAccount,
      createMilestoneParams,
      EXAMPLE_CONFIG.network,
    );

    console.log("Create Milestone Transaction:", {
      contractId: createMilestoneTx.contractId,
      operation: createMilestoneTx.operation,
      parameters: createMilestoneTx.parameters,
    });

    // 2. Approve milestone
    const approveMilestoneParams: ApproveMilestoneParams = {
      entity_id: 1, // campaign_id
      entity_type: EntityType.CAMPAIGN,
      milestone_id: 1,
      approver: EXAMPLE_CONFIG.adminAccount,
    };

    const approveMilestoneTx = await boundlessService.approveMilestone(
      EXAMPLE_CONFIG.adminAccount,
      approveMilestoneParams,
      EXAMPLE_CONFIG.network,
    );

    console.log("Approve Milestone Transaction:", {
      contractId: approveMilestoneTx.contractId,
      operation: approveMilestoneTx.operation,
      parameters: approveMilestoneTx.parameters,
    });

    // 3. Release milestone
    const releaseMilestoneParams: ReleaseMilestoneParams = {
      entity_id: 1, // campaign_id
      entity_type: EntityType.CAMPAIGN,
      milestone_id: 1,
    };

    const releaseMilestoneTx = await boundlessService.releaseMilestone(
      EXAMPLE_CONFIG.sourceAccount,
      releaseMilestoneParams,
      EXAMPLE_CONFIG.network,
    );

    console.log("Release Milestone Transaction:", {
      contractId: releaseMilestoneTx.contractId,
      operation: releaseMilestoneTx.operation,
      parameters: releaseMilestoneTx.parameters,
    });

    // 4. Merge milestone transactions
    const mergedTransaction = contractService.mergeTransactions([
      createMilestoneTx,
      approveMilestoneTx,
      releaseMilestoneTx,
    ]);

    console.log("Merged Milestone Transactions:", {
      operations: mergedTransaction.operations,
      metadata: mergedTransaction.metadata,
    });

    return {
      createMilestoneTx,
      approveMilestoneTx,
      releaseMilestoneTx,
      mergedTransaction,
    };
  } catch (error) {
    console.error("Error in milestone management example:", error);
    throw error;
  }
}

/**
 * Example 5: Complete Workflow - Campaign with Milestones
 */
export async function completeCampaignWorkflow() {
  try {
    console.log("=== Complete Campaign Workflow Example ===");

    // 1. Create campaign with milestones
    const campaignParams: CreateCampaignParams = {
      owner: EXAMPLE_CONFIG.sourceAccount,
      title: "NFT Marketplace",
      description: "A decentralized NFT marketplace on Stellar",
      goal: "10000000", // 10,000,000 stroops
      escrow_contract_id:
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      milestones: [
        {
          id: 1,
          description: "Smart Contract Development",
          amount: "3000000",
          status: MilestoneStatus.PENDING,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: 2,
          description: "Frontend Development",
          amount: "4000000",
          status: MilestoneStatus.PENDING,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: 3,
          description: "Testing and Deployment",
          amount: "3000000",
          status: MilestoneStatus.PENDING,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ],
    };

    // 2. Create campaign transaction
    const createCampaignTx = await boundlessService.createCampaign(
      EXAMPLE_CONFIG.sourceAccount,
      campaignParams,
      EXAMPLE_CONFIG.network,
    );

    // 3. Fund campaign
    const fundCampaignTx = await boundlessService.fundCampaign(
      EXAMPLE_CONFIG.sourceAccount,
      {
        campaign_id: 1,
        backer: "GJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ",
        amount: "5000000", // 5,000,000 stroops
      },
      EXAMPLE_CONFIG.network,
    );

    // 4. Create additional milestone
    const createMilestoneTx = await boundlessService.createMilestone(
      EXAMPLE_CONFIG.sourceAccount,
      {
        entity_id: 1,
        entity_type: EntityType.CAMPAIGN,
        description: "Marketing and Launch",
        amount: "2000000",
      },
      EXAMPLE_CONFIG.network,
    );

    // 5. Approve first milestone
    const approveMilestoneTx = await boundlessService.approveMilestone(
      EXAMPLE_CONFIG.adminAccount,
      {
        entity_id: 1,
        entity_type: EntityType.CAMPAIGN,
        milestone_id: 1,
        approver: EXAMPLE_CONFIG.adminAccount,
      },
      EXAMPLE_CONFIG.network,
    );

    // 6. Release first milestone
    const releaseMilestoneTx = await boundlessService.releaseMilestone(
      EXAMPLE_CONFIG.sourceAccount,
      {
        entity_id: 1,
        entity_type: EntityType.CAMPAIGN,
        milestone_id: 1,
      },
      EXAMPLE_CONFIG.network,
    );

    // 7. Merge all transactions
    const allTransactions = [
      createCampaignTx,
      fundCampaignTx,
      createMilestoneTx,
      approveMilestoneTx,
      releaseMilestoneTx,
    ];

    const mergedTransaction =
      contractService.mergeTransactions(allTransactions);

    console.log("Complete Campaign Workflow:", {
      totalTransactions: allTransactions.length,
      mergedOperations: mergedTransaction.operations.length,
      estimatedTotalFee: mergedTransaction.metadata?.estimatedTotalFee,
    });

    // 8. Simulate the merged transaction
    const simulation = await contractService.simulateTransaction(
      mergedTransaction,
      EXAMPLE_CONFIG.network,
    );

    console.log("Transaction Simulation:", {
      success: simulation.success,
      cost: simulation.cost,
      events: simulation.events?.length || 0,
    });

    // 9. Serialize for frontend
    const serializedForFrontend =
      contractService.serializeTransaction(mergedTransaction);

    return {
      allTransactions,
      mergedTransaction,
      simulation,
      serializedForFrontend,
    };
  } catch (error) {
    console.error("Error in complete campaign workflow:", error);
    throw error;
  }
}

/**
 * Example 6: Frontend Integration Workflow
 */
export function frontendIntegrationWorkflow() {
  console.log("=== Frontend Integration Workflow ===");

  const frontendWorkflow = {
    // 1. Backend creates campaign workflow
    createCampaignWorkflow: async () => {
      const workflow = await completeCampaignWorkflow();
      return workflow.serializedForFrontend;
    },

    // 2. Frontend receives and processes transaction
    processTransaction: (serializedTransaction: string) => {
      console.log("Frontend received transaction:", serializedTransaction);

      // Deserialize transaction
      const transaction = TransactionUtils.deserializeTransaction(
        serializedTransaction,
      );

      console.log("Frontend deserialized transaction:", {
        operations: transaction.operations,
        metadata: transaction.metadata,
      });

      // User signs transaction with wallet
      console.log("User signs transaction with wallet...");

      // Return signed transaction
      return {
        signed: true,
        transactionHash: "example_hash_123",
        operations: transaction.operations,
      };
    },

    // 3. Backend submits signed transaction
    submitSignedTransaction: async (signedTransaction: any) => {
      console.log("Backend submits signed transaction:", signedTransaction);

      // In real implementation, this would submit to the network
      return {
        success: true,
        transactionHash: signedTransaction.transactionHash,
        result: "Transaction submitted successfully",
      };
    },
  };

  return frontendWorkflow;
}

/**
 * Example 7: Error Handling and Validation
 */
export async function errorHandlingExample() {
  try {
    console.log("=== Error Handling Example ===");

    // 1. Try to create campaign with invalid parameters
    try {
      const invalidCampaignParams: CreateCampaignParams = {
        owner: "invalid_address", // Invalid address
        title: "Test Campaign",
        description: "Test Description",
        goal: "-1000", // Negative goal
        escrow_contract_id: "invalid_escrow",
        milestones: [],
      };

      await boundlessService.createCampaign(
        EXAMPLE_CONFIG.sourceAccount,
        invalidCampaignParams,
        EXAMPLE_CONFIG.network,
      );
    } catch (error) {
      console.log("Expected error for invalid parameters:", error);
    }

    // 2. Try to fund non-existent campaign
    try {
      await boundlessService.fundCampaign(
        EXAMPLE_CONFIG.sourceAccount,
        {
          campaign_id: 99999, // Non-existent campaign
          backer: EXAMPLE_CONFIG.sourceAccount,
          amount: "1000000",
        },
        EXAMPLE_CONFIG.network,
      );
    } catch (error) {
      console.log("Expected error for non-existent campaign:", error);
    }

    // 3. Try to approve milestone without admin privileges
    try {
      await boundlessService.approveMilestone(
        EXAMPLE_CONFIG.sourceAccount, // Not admin
        {
          entity_id: 1,
          entity_type: EntityType.CAMPAIGN,
          milestone_id: 1,
          approver: EXAMPLE_CONFIG.sourceAccount,
        },
        EXAMPLE_CONFIG.network,
      );
    } catch (error) {
      console.log("Expected error for non-admin approval:", error);
    }

    console.log("Error handling examples completed successfully");
  } catch (error) {
    console.error("Error in error handling example:", error);
    throw error;
  }
}

// Export all examples
export const boundlessExamples = {
  campaignManagementExample,
  grantManagementExample,
  hackathonManagementExample,
  milestoneManagementExample,
  completeCampaignWorkflow,
  frontendIntegrationWorkflow,
  errorHandlingExample,
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log("Running Boundless Contract Service Examples...\n");

  // Run a simple example
  campaignManagementExample()
    .then(() =>
      console.log("\nCampaign management example completed successfully!"),
    )
    .catch((error) =>
      console.error("\nCampaign management example failed:", error),
    );
}
