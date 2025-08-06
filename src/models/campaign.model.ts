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
  documents?: {
    whitepaper?: string;
    pitchDeck?: string;
  };
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  // Trustless Work integration fields
  trustlessCampaignId?: string;
  currency?: string;
  stakeholders?: {
    marker: string;
    approver: string;
    releaser: string;
    resolver: string;
    receiver: string;
    platformAddress?: string;
  };
  trustlessWorkStatus?: "pending" | "deployed" | "funded" | "failed";
  escrowAddress?: string;
  escrowType?: "single" | "multi";
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
  documents: {
    whitepaper: { type: String },
    pitchDeck: { type: String },
  },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvedAt: { type: Date },
  // Trustless Work integration fields
  trustlessCampaignId: { type: String },
  currency: { type: String, default: "USDC" },
  stakeholders: {
    marker: { type: String },
    approver: { type: String },
    releaser: { type: String },
    resolver: { type: String },
    receiver: { type: String },
    platformAddress: { type: String },
  },
  trustlessWorkStatus: {
    type: String,
    enum: ["pending", "deployed", "funded", "failed"],
    default: "pending",
  },
  escrowAddress: { type: String },
  escrowType: {
    type: String,
    enum: ["single", "multi"],
    default: "multi",
  },
});

export default mongoose.model<ICampaign>("Campaign", CampaignSchema);
