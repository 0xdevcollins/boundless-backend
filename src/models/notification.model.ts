import mongoose, { Schema, Document } from "mongoose";

export enum NotificationType {
  // Project Status
  PROJECT_CREATED = "PROJECT_CREATED",
  PROJECT_UPDATED = "PROJECT_UPDATED",
  PROJECT_VERIFIED = "PROJECT_VERIFIED",
  PROJECT_APPROVED = "PROJECT_APPROVED",
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

  // Organization Notifications
  ORGANIZATION_CREATED = "ORGANIZATION_CREATED",
  ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED",
  ORGANIZATION_DELETED = "ORGANIZATION_DELETED",
  ORGANIZATION_INVITE_SENT = "ORGANIZATION_INVITE_SENT",
  ORGANIZATION_INVITE_ACCEPTED = "ORGANIZATION_INVITE_ACCEPTED",
  ORGANIZATION_MEMBER_ADDED = "ORGANIZATION_MEMBER_ADDED",
  ORGANIZATION_MEMBER_REMOVED = "ORGANIZATION_MEMBER_REMOVED",
  ORGANIZATION_ROLE_CHANGED = "ORGANIZATION_ROLE_CHANGED",

  // Hackathon Notifications
  HACKATHON_CREATED = "HACKATHON_CREATED",
  HACKATHON_UPDATED = "HACKATHON_UPDATED",
  HACKATHON_STATUS_CHANGED = "HACKATHON_STATUS_CHANGED",
  HACKATHON_PUBLISHED = "HACKATHON_PUBLISHED",
  HACKATHON_ACTIVE = "HACKATHON_ACTIVE",
  HACKATHON_COMPLETED = "HACKATHON_COMPLETED",
  HACKATHON_CANCELLED = "HACKATHON_CANCELLED",
  HACKATHON_REGISTERED = "HACKATHON_REGISTERED",
  HACKATHON_SUBMISSION_SUBMITTED = "HACKATHON_SUBMISSION_SUBMITTED",
  HACKATHON_SUBMISSION_SHORTLISTED = "HACKATHON_SUBMISSION_SHORTLISTED",
  HACKATHON_SUBMISSION_DISQUALIFIED = "HACKATHON_SUBMISSION_DISQUALIFIED",
  HACKATHON_WINNERS_ANNOUNCED = "HACKATHON_WINNERS_ANNOUNCED",
  HACKATHON_DEADLINE_APPROACHING = "HACKATHON_DEADLINE_APPROACHING",

  // Team Invitation Notifications
  TEAM_INVITATION_SENT = "TEAM_INVITATION_SENT",
  TEAM_INVITATION_ACCEPTED = "TEAM_INVITATION_ACCEPTED",
  TEAM_INVITATION_DECLINED = "TEAM_INVITATION_DECLINED",
  TEAM_INVITATION_EXPIRED = "TEAM_INVITATION_EXPIRED",
  TEAM_INVITATION_CANCELLED = "TEAM_INVITATION_CANCELLED",
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
    organizationId?: mongoose.Types.ObjectId;
    hackathonId?: mongoose.Types.ObjectId;
    teamInvitationId?: mongoose.Types.ObjectId;
    amount?: number;
    transactionHash?: string;
    organizationName?: string;
    hackathonName?: string;
    projectName?: string;
    memberEmail?: string;
    role?: string;
    submissionStatus?: string;
    deadlineType?: string;
    oldStatus?: string;
    newStatus?: string;
    [key: string]: any;
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
      organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
      hackathonId: { type: Schema.Types.ObjectId, ref: "Hackathon" },
      teamInvitationId: { type: Schema.Types.ObjectId, ref: "TeamInvitation" },
      amount: { type: Number },
      transactionHash: { type: String },
      organizationName: { type: String },
      hackathonName: { type: String },
      projectName: { type: String },
      memberEmail: { type: String },
      role: { type: String },
      submissionStatus: { type: String },
      deadlineType: { type: String },
      oldStatus: { type: String },
      newStatus: { type: String },
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
