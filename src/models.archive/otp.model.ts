import mongoose, { Schema, Document } from "mongoose";

export interface IOTP extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expires: Date;
  createdAt: Date;
}

const OTPSchema: Schema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, unique: true, required: true },
  expires: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IOTP>("OTP", OTPSchema);
