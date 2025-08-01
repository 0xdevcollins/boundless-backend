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
    | "completed"
    | "released"
    | "disputed";
  adminNote?: string;
  markerId?: Types.ObjectId;
  markedAt?: Date;
  releasedAt?: Date;
  releaseTxHash?: string;
  disputedAt?: Date;
  disputeReason?: string;
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
      "released",
      "disputed",
    ],
    default: "pending",
  },
  adminNote: { type: String },
  markerId: { type: Schema.Types.ObjectId, ref: "User" },
  markedAt: { type: Date },
  releasedAt: { type: Date },
  releaseTxHash: { type: String },
  disputedAt: { type: Date },
  disputeReason: { type: String },
});

export default mongoose.model<IMilestone>("Milestone", MilestoneSchema);
