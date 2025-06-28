import mongoose, { Schema, Document } from "mongoose";

export enum NotificationType {
  // Project Status
  PROJECT_CREATED = "PROJECT_CREATED",
  PROJECT_UPDATED = "PROJECT_UPDATED",
  PROJECT_VERIFIED = "PROJECT_VERIFIED",
  PROJECT_REJECTED = "PROJECT_REJECTED",
  PROJECT_FUNDED = "PROJECT_FUNDED",
  PROJECT_COMPLETED = "PROJECT_COMPLETED",
  PROJECT_CANCELLED = "PROJECT_CANCELLED",

  // Funding Status
  FUNDING_RECEIVED = "FUNDING_RECEIVED",
  FUNDING_GOAL_MET = "FUNDING_GOAL_MET",
  FUNDING_FAILED = "FUNDING_FAILED",
  REFUND_PROCESSED = "REFUND_PROCESSED",
  FUNDING_DEADLINE_APPROACHING = "FUNDING_DEADLINE_APPROACHING",

  // Voting Status
  VOTING_STARTED = "VOTING_STARTED",
  VOTING_ENDED = "VOTING_ENDED",
  VOTE_RECEIVED = "VOTE_RECEIVED",
  VOTING_THRESHOLD_MET = "VOTING_THRESHOLD_MET",

  // Milestone Status
  MILESTONE_CREATED = "MILESTONE_CREATED",
  MILESTONE_UPDATED = "MILESTONE_UPDATED",
  MILESTONE_COMPLETED = "MILESTONE_COMPLETED",
  MILESTONE_DEADLINE_APPROACHING = "MILESTONE_DEADLINE_APPROACHING",
  MILESTONE_FUNDS_RELEASED = "MILESTONE_FUNDS_RELEASED",

  // Interaction Notifications
  COMMENT_RECEIVED = "COMMENT_RECEIVED",
  COMMENT_REPLY = "COMMENT_REPLY",
  COMMENT_MENTION = "COMMENT_MENTION",
  REACTION_RECEIVED = "REACTION_RECEIVED",

  // Account Notifications
  ACCOUNT_VERIFIED = "ACCOUNT_VERIFIED",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  EMAIL_CHANGED = "EMAIL_CHANGED",
  SECURITY_ALERT = "SECURITY_ALERT",
}

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  type: NotificationType;
  title: string;
  message: string;
  data: {
    projectId?: mongoose.Types.ObjectId;
    commentId?: mongoose.Types.ObjectId;
    milestoneId?: mongoose.Types.ObjectId;
    amount?: number;
    transactionHash?: string;
  };
  read: boolean;
  readAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: {
      projectId: { type: Schema.Types.ObjectId, ref: "Project" },
      commentId: { type: Schema.Types.ObjectId, ref: "Comment" },
      milestoneId: { type: Schema.Types.ObjectId },
      amount: { type: Number },
      transactionHash: { type: String },
    },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
  },
  { timestamps: true },
);

// Indexes for faster queries
NotificationSchema.index({ "userId.type": 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ read: 1 });
NotificationSchema.index({ createdAt: -1 });

export default (mongoose.models
  .Notification as mongoose.Model<INotification>) ||
  mongoose.model<INotification>("Notification", NotificationSchema);
