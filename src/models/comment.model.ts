import mongoose, { Schema, Document } from "mongoose";

export enum CommentStatus {
  ACTIVE = "ACTIVE",
  HIDDEN = "HIDDEN",
  DELETED = "DELETED",
}

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  content: string;
  author: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  project: {
    type: mongoose.Types.ObjectId;
    ref: "Project";
  };
  parentComment?: {
    type: mongoose.Types.ObjectId;
    ref: "Comment";
  };
  replies: Array<{
    type: mongoose.Types.ObjectId;
    ref: "Comment";
  }>;
  mentions: Array<{
    type: mongoose.Types.ObjectId;
    ref: "User";
  }>;
  reactions: Array<{
    type: string;
    count: number;
  }>;
  status: CommentStatus;
  reports: Array<{
    userId: {
      type: mongoose.Types.ObjectId;
      ref: "User";
    };
    reason: string;
    description?: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    content: { type: String, required: true },
    author: {
      type: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    project: {
      type: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    },
    parentComment: {
      type: { type: Schema.Types.ObjectId, ref: "Comment" },
    },
    replies: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reactions: [
      {
        type: { type: String, required: true },
        count: { type: Number, default: 0 },
      },
    ],
    status: {
      type: String,
      enum: Object.values(CommentStatus),
      default: CommentStatus.ACTIVE,
    },
    reports: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        reason: { type: String, required: true },
        description: { type: String },
        timestamp: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true },
);

// Indexes for faster queries
CommentSchema.index({ "author.type": 1 });
CommentSchema.index({ "project.type": 1 });
CommentSchema.index({ "parentComment.type": 1 });
CommentSchema.index({ status: 1 });

export default mongoose.model<IComment>("Comment", CommentSchema);
