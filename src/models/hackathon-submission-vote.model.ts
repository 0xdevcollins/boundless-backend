import mongoose, { Schema, Document, Types } from "mongoose";

export interface IHackathonSubmissionVote extends Document {
  submissionId: Types.ObjectId; // Reference to participant submission
  userId: Types.ObjectId;
  value: number; // 1 for upvote, -1 for downvote
  createdAt: Date;
  updatedAt: Date;
}

const HackathonSubmissionVoteSchema = new Schema<IHackathonSubmissionVote>(
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
    value: {
      type: Number,
      enum: [1, -1],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to ensure one vote per user per submission
HackathonSubmissionVoteSchema.index(
  { userId: 1, submissionId: 1 },
  { unique: true },
);
HackathonSubmissionVoteSchema.index({ submissionId: 1, value: 1 });

export default mongoose.model<IHackathonSubmissionVote>(
  "HackathonSubmissionVote",
  HackathonSubmissionVoteSchema,
);
