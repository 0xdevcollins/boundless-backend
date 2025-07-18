import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMilestone extends Document {
  campaignId: Types.ObjectId;
  title: string;
  description: string;
  index: number;
  proofUrl?: string;
  status: "pending" | "submitted" | "approved" | "rejected";
}

const MilestoneSchema = new Schema<IMilestone>({
  campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  index: { type: Number, required: true },
  proofUrl: { type: String },
  status: {
    type: String,
    enum: ["pending", "submitted", "approved", "rejected"],
    default: "pending",
  },
});

export default mongoose.model<IMilestone>("Milestone", MilestoneSchema);
