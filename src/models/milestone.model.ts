import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMilestone extends Document {
  campaignId: Types.ObjectId;
  title: string;
  description: string;
  index: number;
  proofUrl?: string;
  proofDescription?: string;
  proofLinks?: string[];
  submittedAt?: Date;
  status:
    | "pending"
    | "submitted"
    | "in-progress"
    | "pending-review"
    | "approved"
    | "rejected"
    | "revision-requested"
    | "completed";
  payoutPercent: number;
  releaseTxHash?: string;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    index: { type: Number, required: true },
    proofUrl: { type: String },
    proofDescription: { type: String },
    proofLinks: [{ type: String }],
    submittedAt: { type: Date },
    status: {
      type: String,
      enum: [
        "pending",
        "submitted",
        "in-progress",
        "pending-review",
        "approved",
        "rejected",
        "revision-requested",
        "completed",
      ],
      default: "pending",
    },
    payoutPercent: {
      type: Number,
      required: [true, "Payout percentage is required"],
      min: [0, "Payout percent cannot be less than 0"],
      max: [100, "Payout percent cannot exceed 100"],
      default: 0,
    },
    releaseTxHash: { type: String, default: null },
    adminNote: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model<IMilestone>("Milestone", MilestoneSchema);
