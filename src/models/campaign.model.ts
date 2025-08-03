import mongoose, { Schema, Document, Types } from "mongoose";

export interface Stakeholder {
  wallet: string;
  role: string;
  name?: string;
}

export interface ICampaign extends Document {
  title: string;
  projectId: Types.ObjectId;
  creatorId: Types.ObjectId;
  goalAmount: number;
  deadline: Date;
  fundsRaised: number;
  fundingHistory?: Array<{
    userId: Types.ObjectId;
    amount: number;
    txHash: string;
    timestamp: Date;
  }>;
  smartContractAddress?: string;
  trustlessCampaignId?: string;
  currency?: string;
  stakeholders?: {
    creator?: Stakeholder;
    marker?: Stakeholder;
    releaser?: Stakeholder;
    resolver?: Stakeholder;
  };
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
}

const CampaignSchema = new Schema<ICampaign>({
  title: { type: String, required: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  creatorId: { type: Schema.Types.ObjectId, required: true },
  goalAmount: { type: Number, required: true },
  deadline: { type: Date, required: true },
  fundsRaised: { type: Number, default: 0 },
  fundingHistory: [
    {
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      amount: Number,
      txHash: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  smartContractAddress: { type: String },
  trustlessCampaignId: { type: String, index: true },
  currency: { type: String, default: "USDC" },
  stakeholders: {
    creator: { wallet: String, role: String, name: String },
    marker: { wallet: String, role: String, name: String },
    releaser: { wallet: String, role: String, name: String },
    resolver: { wallet: String, role: String, name: String },
  },
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
});

CampaignSchema.index({ trustlessCampaignId: 1 });
CampaignSchema.index({ "stakeholders.creator.wallet": 1 });

export default mongoose.model<ICampaign>("Campaign", CampaignSchema);
