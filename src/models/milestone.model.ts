import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMilestone extends Document {
  campaignId: Types.ObjectId;
  title: string;
  description: string;
  index: number;
  proofUrl?: string;
  status:
    | "pending"
    | "submitted"
    | "in-progress"
    | "pending-review"
    | "approved"
    | "rejected"
    | "revision-requested"
    | "completed";
  payoutPercentage: number;
  released: boolean;
  releasedAt?: Date;
  adminNote?: string;
}

const MilestoneSchema = new Schema<IMilestone>({
  campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  index: { type: Number, required: true },
  proofUrl: { type: String },
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
  payoutPercentage: { type: Number, required: true, default: 0 },
  released: { type: Boolean, default: false },
  releasedAt: { type: Date },
  adminNote: { type: String },
});

export default mongoose.model<IMilestone>("Milestone", MilestoneSchema);
