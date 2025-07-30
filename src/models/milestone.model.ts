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
});

export default mongoose.model<IMilestone>("Milestone", MilestoneSchema);
