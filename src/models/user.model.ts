import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name?: string;
  email?: string;
  emailVerified?: Date;
  image?: string;
  password?: string;
  role: Role;
  username?: string;
  bio?: string;
  bannerImage?: string;
  twitter?: string;
  linkedin?: string;
  totalContributions: number;
  language?: string;
  notificationsEnabled?: boolean;
  comparePassword(enteredPassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String },
    email: { type: String, unique: true, sparse: true },
    emailVerified: { type: Date },
    image: { type: String },
    password: { type: String },
    role: { type: String, enum: Object.values(Role), default: Role.USER },
    username: { type: String, unique: true, sparse: true },
    bio: { type: String },
    bannerImage: { type: String },
    twitter: { type: String },
    linkedin: { type: String },
    totalContributions: { type: Number, default: 0 },
    language: { type: String, default: "en" },
    notificationsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Index for faster queries
userSchema.index({ username: 1 });

// Password comparison method
userSchema.methods.comparePassword = async function (
  enteredPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password || "");
};

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model<IUser>("User", userSchema);
export default User;
