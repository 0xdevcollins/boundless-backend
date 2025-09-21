import { Schema, model, Document } from "mongoose";

export interface INewsletterSubscriber extends Document {
  email: string;
  name?: string;
  source?: string;
  subscribedAt: Date;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
}

const newsletterSchema = new Schema<INewsletterSubscriber>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    source: {
      type: String,
      maxlength: 100,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      ipAddress: { type: String },
      userAgent: { type: String },
    },
  },
  { timestamps: true },
);

const NewsletterSubscriber = model<INewsletterSubscriber>(
  "NewsletterSubscriber",
  newsletterSchema,
);

export default NewsletterSubscriber;
