import mongoose, { Schema, Document, Types } from "mongoose";

export interface IHackathonSubmissionComment extends Document {
  submissionId: Types.ObjectId; // Reference to participant submission
  userId: Types.ObjectId;
  content: string;
  parentCommentId?: Types.ObjectId;
  status: "active" | "deleted" | "flagged" | "hidden";
  reactionCounts: {
    LIKE: number;
    DISLIKE: number;
    HELPFUL: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const HackathonSubmissionCommentSchema =
  new Schema<IHackathonSubmissionComment>(
    {
      submissionId: {
        type: Schema.Types.ObjectId,
        ref: "HackathonParticipant",
        required: true,
        index: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
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
        ref: "HackathonSubmissionComment",
        default: null,
        index: true,
      },
      status: {
        type: String,
        enum: ["active", "deleted", "flagged", "hidden"],
        default: "active",
        index: true,
      },
      reactionCounts: {
        LIKE: { type: Number, default: 0, min: 0 },
        DISLIKE: { type: Number, default: 0, min: 0 },
        HELPFUL: { type: Number, default: 0, min: 0 },
      },
    },
    {
      timestamps: true,
    },
  );

// Indexes for better query performance
HackathonSubmissionCommentSchema.index({ submissionId: 1, createdAt: -1 });
HackathonSubmissionCommentSchema.index({ parentCommentId: 1 });
HackathonSubmissionCommentSchema.index({ userId: 1 });

export default mongoose.model<IHackathonSubmissionComment>(
  "HackathonSubmissionComment",
  HackathonSubmissionCommentSchema,
);
