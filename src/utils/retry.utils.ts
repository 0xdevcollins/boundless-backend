/**
 * Retry utility for handling transient MongoDB transaction errors
 */

interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

export async function retryTransaction<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 100,
    maxDelay = 1000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if this is a transient transaction error
      const isTransientError =
        error instanceof Error &&
        (error.message.includes("TransientTransactionError") ||
          error.message.includes("WriteConflict") ||
          error.message.includes("catalog changes") ||
          (error as any).code === 112);

      if (!isTransientError || attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay,
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
