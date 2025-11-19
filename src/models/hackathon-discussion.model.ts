import mongoose, { Schema, Document, Types } from "mongoose";

export interface IHackathonDiscussion extends Document {
  hackathonId: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  parentCommentId?: Types.ObjectId;
  status: "active" | "deleted" | "flagged" | "hidden";
  editHistory: Array<{
    content: string;
    editedAt: Date;
  }>;
  reactionCounts: {
    LIKE: number;
    DISLIKE: number;
    HELPFUL: number;
  };
  replyCount: number;
  isSpam: boolean;
  reports: Array<{
    userId: Types.ObjectId;
    reason: string;
    description?: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const HackathonDiscussionSchema = new Schema<IHackathonDiscussion>(
  {
    hackathonId: {
      type: Schema.Types.ObjectId,
      ref: "Hackathon",
      required: [true, "Hackathon ID is required"],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      minlength: [1, "Content must not be empty"],
      maxlength: [2000, "Content must not exceed 2000 characters"],
      trim: true,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: "HackathonDiscussion",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["active", "deleted", "flagged", "hidden"],
        message: "Invalid discussion status",
      },
      default: "active",
      index: true,
    },
    editHistory: [
      {
        content: {
          type: String,
          required: true,
        },
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reactionCounts: {
      LIKE: { type: Number, default: 0, min: 0 },
      DISLIKE: { type: Number, default: 0, min: 0 },
      HELPFUL: { type: Number, default: 0, min: 0 },
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isSpam: {
      type: Boolean,
      default: false,
      index: true,
    },
    reports: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reason: {
          type: String,
          required: true,
          enum: [
            "spam",
            "inappropriate",
            "harassment",
            "misinformation",
            "other",
          ],
        },
        description: {
          type: String,
          maxlength: 500,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
HackathonDiscussionSchema.index({ hackathonId: 1, createdAt: -1 });
HackathonDiscussionSchema.index({ parentCommentId: 1, createdAt: 1 });
HackathonDiscussionSchema.index({ userId: 1, createdAt: -1 });
HackathonDiscussionSchema.index({ status: 1, createdAt: -1 });

// Virtual for total reactions
HackathonDiscussionSchema.virtual("totalReactions").get(function () {
  return (
    this.reactionCounts.LIKE +
    this.reactionCounts.DISLIKE +
    this.reactionCounts.HELPFUL
  );
});

export default mongoose.model<IHackathonDiscussion>(
  "HackathonDiscussion",
  HackathonDiscussionSchema,
);
