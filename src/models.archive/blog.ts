import mongoose, { Document, Schema } from "mongoose";

export interface IBlog extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage?: string;
  category: mongoose.Types.ObjectId;
  tags: string[];
  status: "draft" | "published" | "archived";
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    keywords?: string[];
  };
  authors: mongoose.Types.ObjectId[];
  publishedAt?: Date;
  scheduledAt?: Date;
  featured: boolean;
  allowComments: boolean;
  readingTime: number;
  stats: {
    views: number;
    likes: number;
    shares: number;
    commentCount: number;
  };
  revisions: {
    version: number;
    editedBy: mongoose.Types.ObjectId;
    editedAt: Date;
    changes: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      required: true,
      maxlength: 500,
    },
    coverImage: {
      type: String,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "BlogCategory",
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    seo: {
      metaTitle: {
        type: String,
        maxlength: 60,
      },
      metaDescription: {
        type: String,
        maxlength: 160,
      },
      ogImage: {
        type: String,
      },
      keywords: [
        {
          type: String,
          trim: true,
        },
      ],
    },
    authors: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    publishedAt: {
      type: Date,
    },
    scheduledAt: {
      type: Date,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    allowComments: {
      type: Boolean,
      default: true,
    },
    readingTime: {
      type: Number,
      default: 0,
    },
    stats: {
      views: {
        type: Number,
        default: 0,
      },
      likes: {
        type: Number,
        default: 0,
      },
      shares: {
        type: Number,
        default: 0,
      },
      commentCount: {
        type: Number,
        default: 0,
      },
    },
    revisions: [
      {
        version: {
          type: Number,
          required: true,
        },
        editedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        editedAt: {
          type: Date,
          default: Date.now,
        },
        changes: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
BlogSchema.index({ status: 1, publishedAt: -1 });
BlogSchema.index({ category: 1, status: 1 });
BlogSchema.index({ tags: 1, status: 1 });
BlogSchema.index({ authors: 1, status: 1 });
BlogSchema.index({ slug: 1 }, { unique: true });
BlogSchema.index({ "stats.views": -1 });
BlogSchema.index({ "stats.likes": -1 });
BlogSchema.index({ title: "text", content: "text", excerpt: "text" });

BlogSchema.pre("save", function (next) {
  if (this.isModified("title") && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 100);
  }

  if (this.isModified("content")) {
    const wordCount = this.content.split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / 200);
  }

  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }

  next();
});

export default mongoose.model<IBlog>("Blog", BlogSchema);
