import mongoose, { Schema, Document } from "mongoose";

export enum ActivityType {
  // Authentication
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",

  // Project Related
  PROJECT_CREATED = "PROJECT_CREATED",
  PROJECT_UPDATED = "PROJECT_UPDATED",
  PROJECT_FUNDED = "PROJECT_FUNDED",
  PROJECT_VOTED = "PROJECT_VOTED",

  // Funding Related
  CONTRIBUTION_MADE = "CONTRIBUTION_MADE",
  REFUND_RECEIVED = "REFUND_RECEIVED",

  // Profile Related
  PROFILE_UPDATED = "PROFILE_UPDATED",
  AVATAR_CHANGED = "AVATAR_CHANGED",

  // Team Related
  TEAM_JOINED = "TEAM_JOINED",
  TEAM_LEFT = "TEAM_LEFT",

  // Milestone Related
  MILESTONE_CREATED = "MILESTONE_CREATED",
  MILESTONE_COMPLETED = "MILESTONE_COMPLETED",
  MILESTONE_FUNDS_RELEASED = "MILESTONE_FUNDS_RELEASED",
}

export interface IActivity extends Document {
  _id: mongoose.Types.ObjectId;
  userId: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  type: ActivityType;
  details: {
    projectId?: mongoose.Types.ObjectId;
    amount?: number;
    transactionHash?: string;
    milestoneId?: mongoose.Types.ObjectId;
    [key: string]: any;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    userId: {
      type: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    type: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
    },
    details: {
      projectId: { type: Schema.Types.ObjectId, ref: "Project" },
      amount: { type: Number },
      transactionHash: { type: String },
      milestoneId: { type: Schema.Types.ObjectId },
    },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

// Indexes for faster queries
ActivitySchema.index({ "userId.type": 1 });
ActivitySchema.index({ type: 1 });
ActivitySchema.index({ createdAt: -1 });

export default mongoose.model<IActivity>("Activity", ActivitySchema);
