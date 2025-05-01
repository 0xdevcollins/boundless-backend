import mongoose, { Schema, type Document } from "mongoose";

export enum TransactionType {
  DEPLOYMENT = "DEPLOYMENT",
  FUNDING = "FUNDING",
  MILESTONE_RELEASE = "MILESTONE_RELEASE",
  REFUND = "REFUND",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  fromAddress: string;
  toAddress: string;
  transactionHash: string;
  status: TransactionStatus;
  timestamp: Date;
  confirmedAt?: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    amount: { type: Number, required: true },
    fromAddress: { type: String, required: true },
    toAddress: { type: String, required: true },
    transactionHash: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
    timestamp: { type: Date, required: true },
    confirmedAt: { type: Date },
  },
  { timestamps: true },
);

// Indexes for faster queries
TransactionSchema.index({ projectId: 1 });
TransactionSchema.index({ transactionHash: 1 }, { unique: true });
TransactionSchema.index({ status: 1 });

export default mongoose.model<ITransaction>("Transaction", TransactionSchema);
