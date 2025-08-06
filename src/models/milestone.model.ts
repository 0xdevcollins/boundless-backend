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
  adminNote?: string;
  // Trustless Work integration fields
  payoutPercentage?: number;
  amount?: number;
  trustlessMilestoneIndex?: number;
}

const MilestoneSchema = new Schema<IMilestone>({
  campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
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
  adminNote: { type: String },
  // Trustless Work integration fields
  payoutPercentage: { type: Number, min: 0, max: 100 },
  amount: { type: Number, min: 0 },
  trustlessMilestoneIndex: { type: Number },
});

export default mongoose.model<IMilestone>("Milestone", MilestoneSchema);
