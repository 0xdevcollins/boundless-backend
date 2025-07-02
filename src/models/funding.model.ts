import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFunding extends Document {
  userId: Types.ObjectId;
  campaignId: Types.ObjectId;
  amount: number;
  txHash: string;
  createdAt: Date;
}

const FundingSchema = new Schema<IFunding>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
  amount: { type: Number, required: true },
  txHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IFunding>("Funding", FundingSchema);
