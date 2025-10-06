import {
  TransactionBuilder,
  Operation,
  Keypair,
  Networks,
  BASE_FEE,
  TimeoutInfinite,
  Memo,
} from "@stellar/stellar-sdk";
import {
  UnsignedTransaction,
  SignedTransaction,
  MergedTransaction,
  TransactionMergeRequest,
  ContractOperation,
} from "../types/contract";

/**
 * Transaction utilities for Soroban smart contract interactions
 */

export class TransactionUtils {
  /**
   * Create an unsigned transaction for contract interaction
   */
  static createUnsignedTransaction(
    sourceAccount: string,
    contractId: string,
    operation: string,
    parameters: any[] = [],
    networkPassphrase: string = Networks.TESTNET,
    fee: string = BASE_FEE,
    memo?: string,
  ): UnsignedTransaction {
    try {
      const transaction = new TransactionBuilder(
        { publicKey: sourceAccount, sequence: "0" } as any,
        {
          fee,
          networkPassphrase,
        },
      )
        .addOperation(
          Operation.invokeContractFunction({
            contract: contractId,
            function: operation,
            args: parameters,
          }),
        )
        .setTimeout(TimeoutInfinite);

      if (memo) {
        transaction.addMemo(Memo.text(memo));
      }

      const builtTransaction = transaction.build();

      return {
        transaction: builtTransaction as any,
        networkPassphrase,
        contractId,
        operation,
        parameters,
        metadata: {
          description: `Contract call: ${operation}`,
          estimatedFee: fee,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to create unsigned transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Merge multiple unsigned transactions into a single transaction
   */
  static mergeTransactions(
    mergeRequest: TransactionMergeRequest,
  ): MergedTransaction {
    try {
      const { transactions, mergeStrategy = "sequential" } = mergeRequest;

      if (transactions.length === 0) {
        throw new Error("No transactions to merge");
      }

      if (transactions.length === 1) {
        const tx = transactions[0];
        return {
          transaction: tx.transaction,
          networkPassphrase: tx.networkPassphrase,
          operations: [
            {
              contractId: tx.contractId,
              operation: tx.operation,
              parameters: tx.parameters,
            },
          ],
          metadata: {
            description: "Single transaction (no merge needed)",
            estimatedTotalFee: tx.metadata?.estimatedFee,
            mergedAt: new Date().toISOString(),
            originalTransactionCount: 1,
          },
        };
      }

      // Validate all transactions are on the same network
      const networkPassphrase = transactions[0].networkPassphrase;
      const sourceAccount = transactions[0].transaction.source;

      for (const tx of transactions) {
        if (tx.networkPassphrase !== networkPassphrase) {
          throw new Error("All transactions must be on the same network");
        }
        if (tx.transaction.source !== sourceAccount) {
          throw new Error("All transactions must have the same source account");
        }
      }

      // Calculate total fee
      const totalFee = transactions.reduce((sum, tx) => {
        const fee = parseInt(tx.metadata?.estimatedFee || BASE_FEE);
        return sum + fee;
      }, 0);

      // Create merged transaction
      const transactionBuilder = new TransactionBuilder(
        { publicKey: sourceAccount, sequence: "0" } as any,
        {
          fee: totalFee.toString(),
          networkPassphrase,
        },
      );

      const operations: Array<{
        contractId: string;
        operation: string;
        parameters?: any[];
      }> = [];

      // Add operations based on merge strategy
      for (const tx of transactions) {
        const operation = Operation.invokeContractFunction({
          contract: tx.contractId,
          function: tx.operation,
          args: tx.parameters || [],
        });

        transactionBuilder.addOperation(operation);

        operations.push({
          contractId: tx.contractId,
          operation: tx.operation,
          parameters: tx.parameters,
        });
      }

      const mergedTransaction = transactionBuilder
        .setTimeout(TimeoutInfinite)
        .build();

      return {
        transaction: mergedTransaction as any,
        networkPassphrase,
        operations,
        metadata: {
          description: `Merged ${transactions.length} transactions using ${mergeStrategy} strategy`,
          estimatedTotalFee: totalFee.toString(),
          mergedAt: new Date().toISOString(),
          originalTransactionCount: transactions.length,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to merge transactions: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Sign a transaction with a keypair
   */
  static signTransaction(
    unsignedTransaction: UnsignedTransaction,
    keypair: Keypair,
  ): SignedTransaction {
    try {
      const {
        transaction,
        networkPassphrase,
        contractId,
        operation,
        parameters,
        metadata,
      } = unsignedTransaction;

      // Create a copy of the transaction to sign
      const transactionToSign = TransactionBuilder.fromXDR(
        transaction.toXDR(),
        networkPassphrase,
      );

      // Sign the transaction
      transactionToSign.sign(keypair);

      return {
        transaction: transactionToSign as any,
        signatures: transactionToSign.signatures.map((sig) =>
          sig.signature().toString("base64"),
        ),
        networkPassphrase,
        contractId,
        operation,
        parameters,
        metadata: {
          ...metadata,
          signedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to sign transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Sign a merged transaction with a keypair
   */
  static signMergedTransaction(
    mergedTransaction: MergedTransaction,
    keypair: Keypair,
  ): SignedTransaction {
    try {
      const { transaction, networkPassphrase, operations, metadata } =
        mergedTransaction;

      // Create a copy of the transaction to sign
      const transactionToSign = TransactionBuilder.fromXDR(
        transaction.toXDR(),
        networkPassphrase,
      );

      // Sign the transaction
      transactionToSign.sign(keypair);

      return {
        transaction: transactionToSign as any,
        signatures: transactionToSign.signatures.map((sig) =>
          sig.signature().toString("base64"),
        ),
        networkPassphrase,
        contractId: operations[0]?.contractId || "",
        operation: "merged_operations",
        parameters: operations,
        metadata: {
          ...metadata,
          signedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to sign merged transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Validate transaction before signing
   */
  static validateTransaction(transaction: UnsignedTransaction): boolean {
    try {
      // Check if transaction is valid
      if (!transaction.transaction) {
        throw new Error("Transaction is missing");
      }

      // Check network passphrase
      if (!transaction.networkPassphrase) {
        throw new Error("Network passphrase is missing");
      }

      // Check contract ID
      if (!transaction.contractId) {
        throw new Error("Contract ID is missing");
      }

      // Check operation
      if (!transaction.operation) {
        throw new Error("Operation is missing");
      }

      // Validate transaction structure
      transaction.transaction.toXDR();

      return true;
    } catch (error) {
      console.error("Transaction validation failed:", error);
      return false;
    }
  }

  /**
   * Serialize transaction to JSON for frontend
   */
  static serializeTransaction(
    transaction: UnsignedTransaction | MergedTransaction,
  ): string {
    try {
      const serialized = {
        transactionXDR: transaction.transaction.toXDR(),
        networkPassphrase: transaction.networkPassphrase,
        ...("contractId" in transaction
          ? { contractId: transaction.contractId }
          : {}),
        ...("operation" in transaction
          ? { operation: transaction.operation }
          : {}),
        ...("parameters" in transaction
          ? { parameters: transaction.parameters }
          : {}),
        ...("operations" in transaction
          ? { operations: transaction.operations }
          : {}),
        metadata: transaction.metadata,
      };

      return JSON.stringify(serialized, null, 2);
    } catch (error) {
      throw new Error(
        `Failed to serialize transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Deserialize transaction from JSON from frontend
   */
  static deserializeTransaction(
    serializedData: string,
  ): UnsignedTransaction | MergedTransaction {
    try {
      const data = JSON.parse(serializedData);

      const transaction = TransactionBuilder.fromXDR(
        data.transactionXDR,
        data.networkPassphrase,
      );

      if (data.operations) {
        // This is a merged transaction
        return {
          transaction,
          networkPassphrase: data.networkPassphrase,
          operations: data.operations,
          metadata: data.metadata,
        } as MergedTransaction;
      } else {
        // This is a single transaction
        return {
          transaction,
          networkPassphrase: data.networkPassphrase,
          contractId: data.contractId,
          operation: data.operation,
          parameters: data.parameters,
          metadata: data.metadata,
        } as UnsignedTransaction;
      }
    } catch (error) {
      throw new Error(
        `Failed to deserialize transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Create a batch of contract operations
   */
  static createBatchOperations(
    sourceAccount: string,
    operations: ContractOperation[],
    networkPassphrase: string = Networks.TESTNET,
    fee: string = BASE_FEE,
  ): UnsignedTransaction {
    try {
      if (operations.length === 0) {
        throw new Error("No operations provided");
      }

      const totalFee = (parseInt(fee) * operations.length).toString();

      const transactionBuilder = new TransactionBuilder(
        { publicKey: sourceAccount, sequence: "0" } as any,
        {
          fee: totalFee,
          networkPassphrase,
        },
      );

      for (const op of operations) {
        const operation = Operation.invokeContractFunction({
          contract: op.contractId,
          function: op.method,
          args: op.parameters,
        });

        transactionBuilder.addOperation(operation);
      }

      const transaction = transactionBuilder
        .setTimeout(TimeoutInfinite)
        .build();

      return {
        transaction,
        networkPassphrase,
        contractId: operations[0].contractId,
        operation: "batch_operations",
        parameters: operations,
        metadata: {
          description: `Batch of ${operations.length} contract operations`,
          estimatedFee: totalFee,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to create batch operations: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
