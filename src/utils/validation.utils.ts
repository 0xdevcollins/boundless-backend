import { Types } from "mongoose";

/**
 * Validate if a string is a valid MongoDB ObjectId
 */
export const validateObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

/**
 * Validate if an array of strings are all valid MongoDB ObjectIds
 */
export const validateObjectIds = (ids: string[]): boolean => {
  return ids.every((id) => Types.ObjectId.isValid(id));
};

/**
 * Convert string to ObjectId if valid, otherwise return null
 */
export const toObjectId = (id: string): Types.ObjectId | null => {
  return validateObjectId(id) ? new Types.ObjectId(id) : null;
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate URL format
 */
export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate date is in the future
 */
export const validateFutureDate = (date: Date | string): boolean => {
  const targetDate = new Date(date);
  return targetDate > new Date();
};

/**
 * Validate positive number
 */
export const validatePositiveNumber = (value: number): boolean => {
  return typeof value === "number" && value > 0 && Number.isFinite(value);
};

/**
 * Validate non-negative number
 */
export const validateNonNegativeNumber = (value: number): boolean => {
  return typeof value === "number" && value >= 0 && Number.isFinite(value);
};

/**
 * Sanitize string input
 */
export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, "");
};

/**
 * Validate string length
 */
export const validateStringLength = (
  input: string,
  minLength = 0,
  maxLength: number = Number.POSITIVE_INFINITY,
): boolean => {
  return input.length >= minLength && input.length <= maxLength;
};
