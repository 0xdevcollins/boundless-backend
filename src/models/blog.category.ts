import mongoose, { Document, Schema } from "mongoose";

export interface IBlogCategory extends Document {
  name: string;
  slug: string;
  description?: string;
  parent?: mongoose.Types.ObjectId;
  children: mongoose.Types.ObjectId[];
  postCount: number;
  featured: boolean;
  color?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlogCategorySchema = new Schema<IBlogCategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
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
      maxlength: 500,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "BlogCategory",
      default: null,
    },
    children: [
      {
        type: Schema.Types.ObjectId,
        ref: "BlogCategory",
      },
    ],
    postCount: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
BlogCategorySchema.index({ parent: 1 });
BlogCategorySchema.index({ featured: 1 });

BlogCategorySchema.pre("save", function (next) {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-");
  }
  next();
});

BlogCategorySchema.virtual("fullPath").get(function () {
  return this.name;
});

export default mongoose.model<IBlogCategory>(
  "BlogCategory",
  BlogCategorySchema,
);
