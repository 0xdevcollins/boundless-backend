import mongoose, { Schema, Document } from "mongoose";

export interface IEdit {
  content: string;
  editedAt: Date;
  editedBy: mongoose.Types.ObjectId;
}

export interface IComment extends Document {
  content: string;
  projectId: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  parentCommentId?: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  status: "active" | "deleted" | "flagged" | "hidden";
  editHistory: IEdit[];
  reactionCounts: {
    LIKE: number;
    DISLIKE: number;
    HELPFUL: number;
    SPAM: number;
  };
  createdAt: Date;
  updatedAt: Date;
  isSpam: boolean;
  reports: {
    userId: mongoose.Types.ObjectId;
    reason: string;
    description?: string;
    createdAt: Date;
  }[];
}

const CommentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      required: [true, "Content is required"],
      minlength: [1, "Content must not be empty"],
      maxlength: [5000, "Content must not exceed 5000 characters"],
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["active", "deleted", "flagged", "hidden"],
      default: "active",
    },
    editHistory: [
      {
        content: String,
        editedAt: Date,
        editedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    reactionCounts: {
      LIKE: { type: Number, default: 0 },
      DISLIKE: { type: Number, default: 0 },
      HELPFUL: { type: Number, default: 0 },
      SPAM: { type: Number, default: 0 },
    },
    isSpam: {
      type: Boolean,
      default: false,
    },
    reports: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        reason: {
          type: String,
          required: true,
        },
        description: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
CommentSchema.index({ projectId: 1, createdAt: -1 });
CommentSchema.index({ parentCommentId: 1 });
CommentSchema.index({ mentions: 1 });
CommentSchema.index({ status: 1 });

export default mongoose.model<IComment>("Comment", CommentSchema);
