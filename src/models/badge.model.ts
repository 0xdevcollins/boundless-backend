import mongoose, { Document, Schema } from "mongoose";

export enum BadgeType {
  ROLE = "ROLE",
  ACHIEVEMENT = "ACHIEVEMENT",
  SPECIAL = "SPECIAL",
}

export enum CriteriaType {
  PROJECTS_CREATED = "PROJECTS_CREATED",
  PROJECTS_FUNDED = "PROJECTS_FUNDED",
  TOTAL_CONTRIBUTION = "TOTAL_CONTRIBUTION",
  COMMUNITY_ENGAGEMENT = "COMMUNITY_ENGAGEMENT",
}

export enum ConditionType {
  GREATER_THAN = "GREATER_THAN",
  EQUAL_TO = "EQUAL_TO",
  LESS_THAN = "LESS_THAN",
}

export interface IBadge extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  type: BadgeType;
  icon: string;
  criteria: {
    type: CriteriaType;
    threshold: number;
    condition: ConditionType;
  };
  benefits: string[];
  createdAt: Date;
  updatedAt: Date;
}

const badgeSchema = new Schema<IBadge>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, enum: Object.values(BadgeType), required: true },
    icon: { type: String, required: true },
    criteria: {
      type: { type: String, enum: Object.values(CriteriaType), required: true },
      threshold: { type: Number, required: true },
      condition: {
        type: String,
        enum: Object.values(ConditionType),
        required: true,
      },
    },
    benefits: [{ type: String }],
  },
  { timestamps: true },
);

const Badge = mongoose.model<IBadge>("Badge", badgeSchema);
export default Badge;
