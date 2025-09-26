/**
 * Database utility functions for handling operations with retry logic and timeout management
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  timeout: 10000, // 10 seconds
};

/**
 * Executes a database operation with retry logic and timeout
 * @param operation - The database operation to execute
 * @param options - Retry configuration options
 * @returns Promise with the operation result
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Add timeout to the operation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Operation timeout")),
          config.timeout,
        );
      });

      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain types of errors
      if (isNonRetryableError(error)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === config.maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        config.maxDelay,
      );

      console.warn(
        `Database operation attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Determines if an error should not be retried
 * @param error - The error to check
 * @returns true if the error should not be retried
 */
function isNonRetryableError(error: any): boolean {
  // Don't retry validation errors, authentication errors, etc.
  const nonRetryableErrors = [
    "ValidationError",
    "CastError",
    "JsonWebTokenError",
    "TokenExpiredError",
    "UnauthorizedError",
    "ForbiddenError",
    "NotFoundError",
  ];

  return nonRetryableErrors.includes(error.name) || error.code === 11000; // Duplicate key error
}

/**
 * Wrapper for Mongoose operations with retry logic
 * @param operation - The Mongoose operation
 * @param options - Retry configuration options
 * @returns Promise with the operation result
 */
export async function mongooseWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  return executeWithRetry(operation, options);
}

/**
 * Health check function to verify database connectivity
 * @returns Promise<boolean> indicating if the database is healthy
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const mongoose = await import("mongoose");

    if (mongoose.default.connection.readyState !== 1) {
      return false;
    }

    // Try a simple ping operation
    await mongoose.default.connection.db.admin().ping();
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

/**
 * Get database connection status information
 * @returns Object with connection status details
 */
export function getDatabaseStatus() {
  const mongoose = require("mongoose");

  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    readyState: mongoose.connection.readyState,
    status: states[mongoose.connection.readyState as keyof typeof states],
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
  };
}
