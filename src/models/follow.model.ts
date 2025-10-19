import mongoose, { Schema, Document } from "mongoose";

export interface IFollow extends Document {
  _id: mongoose.Types.ObjectId;
  follower: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  following: {
    type: mongoose.Types.ObjectId;
    ref: "User";
  };
  followedAt: Date;
  status: "ACTIVE" | "BLOCKED";
}

const FollowSchema = new Schema<IFollow>(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    followedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "BLOCKED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

// Indexes for better query performance
FollowSchema.index({ follower: 1 });
FollowSchema.index({ following: 1 });
FollowSchema.index({ follower: 1, following: 1 }, { unique: true });

export default mongoose.model<IFollow>("Follow", FollowSchema);
