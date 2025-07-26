import mongoose, { Schema, type Document } from "mongoose";

export enum MilestoneStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  PENDING_REVIEW = "PENDING_REVIEW",
  COMPLETED = "COMPLETED",
  RELEASED = "RELEASED",
  OVERDUE = "OVERDUE",
  CANCELLED = "CANCELLED",
}

// Define reviewable states
export const REVIEWABLE_STATES: MilestoneStatus[] = [
  MilestoneStatus.SUBMITTED,
  MilestoneStatus.IN_PROGRESS,
  MilestoneStatus.PENDING_REVIEW,
];

// Define non-reviewable states
export const NON_REVIEWABLE_STATES: MilestoneStatus[] = [
  MilestoneStatus.COMPLETED,
  MilestoneStatus.RELEASED,
  MilestoneStatus.CANCELLED,
  MilestoneStatus.OVERDUE,
];

export interface IMilestone extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  contractId: mongoose.Types.ObjectId;
  title: string;
  amount: number;
  dueDate: Date;
  status: MilestoneStatus;
  releaseTransaction?: mongoose.Types.ObjectId;
  releasedAt?: Date;
  submittedAt?: Date;
  reviewStartedAt?: Date;
  
  // Instance methods
  isReviewable(): boolean;
  canTransitionTo(newStatus: MilestoneStatus): boolean;
  markAsSubmitted(): void;
  markAsInProgress(): void;
  markAsPendingReview(): void;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
    },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(MilestoneStatus),
      default: MilestoneStatus.PENDING,
    },
    releaseTransaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
    },
    releasedAt: { type: Date },
    submittedAt: { type: Date },
    reviewStartedAt: { type: Date },
  },
  { timestamps: true },
);

// Instance method to check if milestone is in a reviewable state
MilestoneSchema.methods.isReviewable = function(): boolean {
  return REVIEWABLE_STATES.includes(this.status);
};

// Instance method to validate status transitions
MilestoneSchema.methods.canTransitionTo = function(newStatus: MilestoneStatus): boolean {
  const currentStatus = this.status as MilestoneStatus;
  
  // Define valid transitions
  const validTransitions: Record<MilestoneStatus, MilestoneStatus[]> = {
    [MilestoneStatus.PENDING]: [
      MilestoneStatus.IN_PROGRESS,
      MilestoneStatus.CANCELLED,
      MilestoneStatus.OVERDUE,
    ],
    [MilestoneStatus.IN_PROGRESS]: [
      MilestoneStatus.SUBMITTED,
      MilestoneStatus.PENDING_REVIEW,
      MilestoneStatus.CANCELLED,
      MilestoneStatus.OVERDUE,
    ],
    [MilestoneStatus.SUBMITTED]: [
      MilestoneStatus.PENDING_REVIEW,
      MilestoneStatus.IN_PROGRESS, // Allow going back to in-progress if needed
      MilestoneStatus.COMPLETED,
      MilestoneStatus.CANCELLED,
    ],
    [MilestoneStatus.PENDING_REVIEW]: [
      MilestoneStatus.COMPLETED,
      MilestoneStatus.IN_PROGRESS, // Allow sending back for revisions
      MilestoneStatus.CANCELLED,
    ],
    [MilestoneStatus.COMPLETED]: [
      MilestoneStatus.RELEASED,
    ],
    [MilestoneStatus.RELEASED]: [], // Terminal state
    [MilestoneStatus.OVERDUE]: [
      MilestoneStatus.IN_PROGRESS,
      MilestoneStatus.CANCELLED,
    ],
    [MilestoneStatus.CANCELLED]: [], // Terminal state
  };
  
  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

// Convenience methods for status transitions
MilestoneSchema.methods.markAsSubmitted = function(): void {
  if (this.canTransitionTo(MilestoneStatus.SUBMITTED)) {
    this.status = MilestoneStatus.SUBMITTED;
    this.submittedAt = new Date();
  } else {
    throw new Error(`Cannot transition from ${this.status} to SUBMITTED`);
  }
};

MilestoneSchema.methods.markAsInProgress = function(): void {
  if (this.canTransitionTo(MilestoneStatus.IN_PROGRESS)) {
    this.status = MilestoneStatus.IN_PROGRESS;
  } else {
    throw new Error(`Cannot transition from ${this.status} to IN_PROGRESS`);
  }
};

MilestoneSchema.methods.markAsPendingReview = function(): void {
  if (this.canTransitionTo(MilestoneStatus.PENDING_REVIEW)) {
    this.status = MilestoneStatus.PENDING_REVIEW;
    this.reviewStartedAt = new Date();
  } else {
    throw new Error(`Cannot transition from ${this.status} to PENDING_REVIEW`);
  }
};

// Pre-save middleware to validate status transitions
MilestoneSchema.pre('save', async function(next) {
  if (this.isModified('status')) {
    // Skip validation for new documents
    if (this.isNew) {
      return next();
    }
    
    try {
      // Get the original document from the database
      const Model = this.constructor as mongoose.Model<IMilestone>;
      const original: IMilestone | null = await Model.findById(this._id);
      
      if (original && !this.canTransitionTo(this.status)) {
        return next(new Error(
          `Invalid status transition from ${original.status} to ${this.status}`
        ));
      }
      next();
    } catch (error) {
      next(error as Error);
    }
  } else {
    next();
  }
});

// Static method to find reviewable milestones
MilestoneSchema.statics.findReviewable = function() {
  return this.find({ status: { $in: REVIEWABLE_STATES } });
};

// Static method to find non-reviewable milestones
MilestoneSchema.statics.findNonReviewable = function() {
  return this.find({ status: { $in: NON_REVIEWABLE_STATES } });
};

// Indexes for faster queries
MilestoneSchema.index({ projectId: 1 });
MilestoneSchema.index({ contractId: 1 });
MilestoneSchema.index({ status: 1 });
MilestoneSchema.index({ status: 1, dueDate: 1 }); // Compound index for status and due date queries
MilestoneSchema.index({ submittedAt: 1 });

// Validation helper function that can be used in your controllers
export function validateMilestoneForReview(milestone: IMilestone): { isValid: boolean; error?: string } {
  if (!milestone.isReviewable()) {
    return {
      isValid: false,
      error: `Milestone with status '${milestone.status}' cannot be reviewed. Only milestones with status '${REVIEWABLE_STATES.join("', '")}' can be reviewed.`
    };
  }
  
  return { isValid: true };
}

// Usage example in controller (commented out)
/*
export async function reviewMilestone(milestoneId: string, reviewData: any) {
  try {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new Error('Milestone not found');
    }
    
    const validation = validateMilestoneForReview(milestone);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    
    // Proceed with review logic
    // ...
    
  } catch (error) {
    console.error('Error reviewing milestone:', error);
    throw error;
  }
}
*/

export default mongoose.model<IMilestone>("Milestone", MilestoneSchema);