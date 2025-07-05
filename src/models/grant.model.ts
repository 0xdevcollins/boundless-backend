import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGrant extends Document {
  creatorId: Types.ObjectId;
  title: string;
  description: string;
  totalBudget: number;
  rules: string;
  milestones: Array<{
    title: string;
    description: string;
    expectedPayout: number;
  }>;
  status: "draft" | "published" | "closed" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const GrantSchema = new Schema<IGrant>(
  {
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    totalBudget: {
      type: Number,
      required: [true, "Total budget is required"],
      min: [1, "Total budget must be at least 1"],
    },
    rules: {
      type: String,
      required: [true, "Rules are required"],
      trim: true,
      maxlength: [2000, "Rules cannot exceed 2000 characters"],
    },
    milestones: [
      {
        title: {
          type: String,
          required: [true, "Milestone title is required"],
          trim: true,
          maxlength: [100, "Milestone title cannot exceed 100 characters"],
        },
        description: {
          type: String,
          required: [true, "Milestone description is required"],
          trim: true,
          maxlength: [
            500,
            "Milestone description cannot exceed 500 characters",
          ],
        },
        expectedPayout: {
          type: Number,
          required: [true, "Expected payout is required"],
          min: [0, "Expected payout cannot be negative"],
        },
      },
    ],
    status: {
      type: String,
      enum: {
        values: ["draft", "published", "closed", "archived"],
        message: "Status must be one of: draft, published, closed, archived",
      },
      default: "draft",
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
GrantSchema.index({ creatorId: 1, status: 1 });
GrantSchema.index({ status: 1, createdAt: -1 });

// Validate that total budget equals sum of milestone payouts
GrantSchema.pre("save", function (next) {
  if (this.milestones && this.milestones.length > 0) {
    const totalMilestonePayouts = this.milestones.reduce(
      (sum, milestone) => sum + milestone.expectedPayout,
      0,
    );

    if (totalMilestonePayouts > this.totalBudget) {
      return next(
        new Error("Total milestone payouts cannot exceed total budget"),
      );
    }
  }
  next();
});

export default mongoose.model<IGrant>("Grant", GrantSchema);
