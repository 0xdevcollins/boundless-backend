import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICampaign extends Document {
  projectId: Types.ObjectId;
  creatorId: Types.ObjectId;
  goalAmount: number;
  deadline: Date;
  fundsRaised: number;
  smartContractAddress?: string;
  status:
    | "draft"
    | "pending_approval"
    | "live"
    | "funded"
    | "failed"
    | "cancelled";
  createdAt: Date;
}

const CampaignSchema = new Schema<ICampaign>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  creatorId: { type: Schema.Types.ObjectId, required: true },
  goalAmount: { type: Number, required: true },
  deadline: { type: Date, required: true },
  fundsRaised: { type: Number, default: 0 },
  smartContractAddress: { type: String },
  status: {
    type: String,
    enum: [
      "draft",
      "pending_approval",
      "live",
      "funded",
      "failed",
      "cancelled",
    ],
    default: "draft",
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ICampaign>("Campaign", CampaignSchema);
