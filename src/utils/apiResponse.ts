import { Response } from "express";

// Standard API Response Interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  path?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ErrorResponse extends ApiResponse {
  success: false;
  message: string;
  error?: string;
  statusCode: number;
}

// Success Response Helpers
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    path: res.req.originalUrl,
  };

  res.status(statusCode).json(response);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message?: string,
): void => {
  sendSuccess(res, data, message, 201);
};

export const sendNoContent = (res: Response): void => {
  res.status(204).send();
};

// Error Response Helpers
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  error?: string,
): void => {
  const response: ErrorResponse = {
    success: false,
    message,
    error,
    statusCode,
    timestamp: new Date().toISOString(),
    path: res.req.originalUrl,
  };

  res.status(statusCode).json(response);
};

export const sendBadRequest = (
  res: Response,
  message: string = "Bad Request",
  error?: string,
): void => {
  sendError(res, message, 400, error);
};

export const sendUnauthorized = (
  res: Response,
  message: string = "Unauthorized",
  error?: string,
): void => {
  sendError(res, message, 401, error);
};

export const sendForbidden = (
  res: Response,
  message: string = "Forbidden",
  error?: string,
): void => {
  sendError(res, message, 403, error);
};

export const sendNotFound = (
  res: Response,
  message: string = "Resource not found",
  error?: string,
): void => {
  sendError(res, message, 404, error);
};

export const sendConflict = (
  res: Response,
  message: string = "Conflict",
  error?: string,
): void => {
  sendError(res, message, 409, error);
};

export const sendValidationError = (
  res: Response,
  message: string = "Validation failed",
  errors?: any,
): void => {
  const response: ApiResponse = {
    success: false,
    message,
    error: "Validation Error",
    timestamp: new Date().toISOString(),
    path: res.req.originalUrl,
  };

  if (errors) {
    response.data = { errors };
  }

  res.status(400).json(response);
};

export const sendInternalServerError = (
  res: Response,
  message: string = "Internal Server Error",
  error?: string,
): void => {
  sendError(res, message, 500, error);
};

export const sendTooManyRequests = (
  res: Response,
  message: string = "Too Many Requests",
  error?: string,
): void => {
  sendError(res, message, 429, error);
};

// Pagination Response Helper
export const sendPaginatedResponse = <T>(
  res: Response,
  data: T[],
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  },
  message?: string,
): void => {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination,
    message,
    timestamp: new Date().toISOString(),
    path: res.req.originalUrl,
  };

  res.status(200).json(response);
};

// Resource Checker Helper (Enhanced version of your existing one)
export const checkResource = (
  res: Response,
  condition: boolean | undefined | null | {},
  message: string,
  statusCode: number = 404,
): boolean => {
  if (condition) {
    sendError(res, message, statusCode);
    return true; // Resource check failed
  }
  return false; // Resource check passed
};

// Async Handler Wrapper for consistent error handling
export const asyncHandler = (fn: Function) => {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error("API Error:", error);
      sendInternalServerError(
        res,
        "An unexpected error occurred",
        error instanceof Error ? error.message : "Unknown error",
      );
    });
  };
};
