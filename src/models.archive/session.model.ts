import mongoose, { Schema, type Document } from "mongoose";

export interface ISession extends Document {
  sessionToken: string;
  userId: mongoose.Types.ObjectId;
  expires: Date;
}

const SessionSchema: Schema = new Schema({
  sessionToken: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expires: { type: Date, required: true },
});

export default mongoose.model<ISession>("Session", SessionSchema);
