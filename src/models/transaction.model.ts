import mongoose, { Document, Schema } from "mongoose";

export enum TransactionStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

export enum TransactionType {
  DEPLOYMENT = "DEPLOYMENT",
  FUNDING = "FUNDING",
  MILESTONE_RELEASE = "MILESTONE_RELEASE",
  REFUND = "REFUND",
}

export interface ITransaction extends Document {
  projectId: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  fromAddress: string;
  toAddress: string;
  transactionHash: string;
  status: TransactionStatus;
  timestamp: Date;
  confirmedAt?: Date;
  metadata?: Record<string, any>;
}

const transactionSchema = new Schema<ITransaction>(
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
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    fromAddress: {
      type: String,
      required: true,
    },
    toAddress: {
      type: String,
      required: true,
    },
    transactionHash: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
transactionSchema.index({ projectId: 1, timestamp: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });

const TransactionModel = mongoose.model<ITransaction>(
  "Transaction",
  transactionSchema,
);

export default TransactionModel;
