import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
});

// Index
NotificationSchema.index({ userId: 1 });

export default mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);
