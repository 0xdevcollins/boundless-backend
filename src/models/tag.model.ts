import mongoose, { Document, Schema } from "mongoose";

export interface ITag extends Document {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  postCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    color: {
      type: String,
      trim: true,
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    postCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
TagSchema.index({ isActive: 1 });
TagSchema.index({ postCount: -1 });

TagSchema.pre("save", function (next) {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  next();
});

export default mongoose.model<ITag>("Tag", TagSchema);
