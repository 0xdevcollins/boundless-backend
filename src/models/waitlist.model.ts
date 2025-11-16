import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export enum WaitlistStatus {
  ACTIVE = "ACTIVE",
  UNSUBSCRIBED = "UNSUBSCRIBED",
  BOUNCED = "BOUNCED",
  SPAM = "SPAM",
}

export interface IWaitlist extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  firstName?: string;
  lastName?: string;
  status: WaitlistStatus;
  source?: string; // e.g., "landing_page", "social_media", "referral"
  referrer?: string; // tracking where they came from
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    [key: string]: any;
  };
  subscribedAt: Date;
  unsubscribedAt?: Date;
  lastEmailSentAt?: Date;
  emailCount: number;
  unsubscribeToken: string;
  isActive: boolean;
  tags?: string[]; // for segmentation
  notes?: string; // admin notes

  // Instance methods
  generateUnsubscribeToken(): string;
  unsubscribe(): void;
  markAsBounced(): void;
  markAsSpam(): void;
  incrementEmailCount(): void;
}

const waitlistSchema = new Schema<IWaitlist>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    status: {
      type: String,
      enum: Object.values(WaitlistStatus),
      default: WaitlistStatus.ACTIVE,
    },
    source: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    referrer: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      location: String,
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },

    unsubscribedAt: Date,
    lastEmailSentAt: Date,
    emailCount: {
      type: Number,
      default: 0,
    },
    unsubscribeToken: {
      type: String,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    notes: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for performance
waitlistSchema.index({ email: 1 });
waitlistSchema.index({ status: 1 });
waitlistSchema.index({ subscribedAt: -1 });
waitlistSchema.index({ unsubscribeToken: 1 });
waitlistSchema.index({ tags: 1 });
waitlistSchema.index({ source: 1 });

// Virtual for full name
waitlistSchema.virtual("fullName").get(function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || "";
});

// Method to generate unsubscribe token
waitlistSchema.methods.generateUnsubscribeToken = function (): string {
  return crypto.randomBytes(32).toString("hex");
};

// Pre-save middleware to generate unsubscribe token if not exists
waitlistSchema.pre("save", function (next) {
  if (!this.unsubscribeToken) {
    this.unsubscribeToken = this.generateUnsubscribeToken();
  }
  next();
});

// Method to unsubscribe
waitlistSchema.methods.unsubscribe = function (): void {
  this.status = WaitlistStatus.UNSUBSCRIBED;
  this.unsubscribedAt = new Date();
  this.isActive = false;
};

// Method to mark as bounced
waitlistSchema.methods.markAsBounced = function (): void {
  this.status = WaitlistStatus.BOUNCED;
  this.isActive = false;
};

// Method to mark as spam
waitlistSchema.methods.markAsSpam = function (): void {
  this.status = WaitlistStatus.SPAM;
  this.isActive = false;
};

// Method to increment email count
waitlistSchema.methods.incrementEmailCount = function (): void {
  this.emailCount += 1;
  this.lastEmailSentAt = new Date();
};

// Static method to get active subscribers count
waitlistSchema.statics.getActiveCount = function (): Promise<number> {
  return this.countDocuments({
    status: WaitlistStatus.ACTIVE,
    isActive: true,
  });
};

// Static method to get subscribers by status
waitlistSchema.statics.getByStatus = function (status: WaitlistStatus) {
  return this.find({ status, isActive: true }).sort({ subscribedAt: -1 });
};

// Static method to get subscribers by tag
waitlistSchema.statics.getByTag = function (tag: string) {
  return this.find({
    tags: tag,
    isActive: true,
    status: WaitlistStatus.ACTIVE,
  }).sort({ subscribedAt: -1 });
};

export default mongoose.model<IWaitlist>("Waitlist", waitlistSchema);
