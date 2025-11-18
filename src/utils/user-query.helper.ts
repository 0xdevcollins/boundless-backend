import mongoose from "mongoose";
import User from "../models/user.model.js";

/**
 * Helper to add deleted user exclusion to queries
 */
export const excludeDeletedUsers = {
  deleted: { $ne: true },
};

/**
 * Find user by ID excluding deleted users
 */
export const findActiveUserById = async (
  userId: mongoose.Types.ObjectId | string,
) => {
  return User.findOne({
    _id: userId,
    ...excludeDeletedUsers,
  });
};

/**
 * Find user by email excluding deleted users
 */
export const findActiveUserByEmail = async (email: string) => {
  return User.findOne({
    email,
    ...excludeDeletedUsers,
  });
};
