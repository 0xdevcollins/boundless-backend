import mongoose, { Schema, Document } from "mongoose";

export interface IComment extends Document {
  content: string;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema: Schema = new Schema(
  {
    content: { type: String, required: true },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
  },
  { timestamps: true },
);

// Indexes
CommentSchema.index({ projectId: 1 });
CommentSchema.index({ userId: 1 });
CommentSchema.index({ parentId: 1 });

export default mongoose.model<IComment>("Comment", CommentSchema);
