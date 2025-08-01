/**
 * UserRole type for role-based authorization
 */
export interface UserRole {
  role: string;
}

/**
 * MilestoneUpdate type for updating milestone fields
 */
export interface MilestoneUpdate {
  status?: string;
  markedAt?: Date;
  markerId?: import("mongoose").Types.ObjectId | string;
  releasedAt?: Date;
  releaseTxHash?: string;
  disputedAt?: Date;
  disputeReason?: string;
}
