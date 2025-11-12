import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICriterionScore {
  criterionTitle: string;
  score: number; // 0-100
}

export interface IHackathonJudgingScore extends Document {
  submissionId: Types.ObjectId; // Reference to HackathonParticipant
  judgeId: Types.ObjectId; // Reference to User (judge)
  organizationId: Types.ObjectId;
  hackathonId: Types.ObjectId;
  scores: ICriterionScore[];
  weightedScore: number; // Calculated: Σ(score × weight) / 100
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CriterionScoreSchema = new Schema<ICriterionScore>(
  {
    criterionTitle: {
      type: String,
      required: true,
      trim: true,
    },
    score: {
      type: Number,
      required: true,
      min: [0, "Score must be between 0 and 100"],
      max: [100, "Score must be between 0 and 100"],
    },
  },
  { _id: false },
);

const HackathonJudgingScoreSchema = new Schema<IHackathonJudgingScore>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: "HackathonParticipant",
      required: true,
      index: true,
    },
    judgeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    hackathonId: {
      type: Schema.Types.ObjectId,
      ref: "Hackathon",
      required: true,
      index: true,
    },
    scores: {
      type: [CriterionScoreSchema],
      required: true,
      validate: {
        validator: function (scores: ICriterionScore[]) {
          return scores.length > 0;
        },
        message: "At least one criterion score is required",
      },
    },
    weightedScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes must not exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index: one judge can only have one score per submission
HackathonJudgingScoreSchema.index(
  { submissionId: 1, judgeId: 1 },
  { unique: true },
);

// Indexes for better query performance
HackathonJudgingScoreSchema.index({ hackathonId: 1, createdAt: -1 });
HackathonJudgingScoreSchema.index({ submissionId: 1, createdAt: -1 });

export default mongoose.model<IHackathonJudgingScore>(
  "HackathonJudgingScore",
  HackathonJudgingScoreSchema,
);
