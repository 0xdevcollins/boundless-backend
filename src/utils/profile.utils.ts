import { IUser } from "../models/user.model.js";

export interface ProfileCompletenessResult {
  isComplete: boolean;
  missingFields: string[];
  completionPercentage: number;
}

/**
 * Check if a user's profile is complete
 * Required fields: firstName, lastName, username, avatar, bio
 * Optional fields (included in missingFields but not counted in percentage): location, website, socialLinks
 */
export function checkProfileCompleteness(
  user: IUser | null | undefined,
): ProfileCompletenessResult {
  if (!user || !user.profile) {
    return {
      isComplete: false,
      missingFields: [
        "firstName",
        "lastName",
        "username",
        "avatar",
        "bio",
        "location",
        "website",
        "socialLinks",
      ],
      completionPercentage: 0,
    };
  }

  const { profile } = user;
  const missingFields: string[] = [];

  // Required fields for profile completion
  const requiredFields = [
    { key: "firstName", value: profile.firstName },
    { key: "lastName", value: profile.lastName },
    { key: "username", value: profile.username },
    { key: "avatar", value: profile.avatar },
    { key: "bio", value: profile.bio },
  ];

  // Check required fields
  requiredFields.forEach((field) => {
    if (
      !field.value ||
      (typeof field.value === "string" && field.value.trim() === "")
    ) {
      missingFields.push(field.key);
    }
  });

  // Optional fields (included in missingFields but not counted in percentage)
  if (!profile.location || profile.location.trim() === "") {
    missingFields.push("location");
  }

  if (!profile.website || profile.website.trim() === "") {
    missingFields.push("website");
  }

  // Check if at least one social link exists
  const hasSocialLinks =
    profile.socialLinks &&
    (profile.socialLinks.twitter ||
      profile.socialLinks.linkedin ||
      profile.socialLinks.github ||
      profile.socialLinks.discord);

  if (!hasSocialLinks) {
    missingFields.push("socialLinks");
  }

  // Calculate completion percentage based on required fields only
  const totalRequiredFields = requiredFields.length;
  const completedRequiredFields =
    totalRequiredFields -
    missingFields.filter((field) =>
      requiredFields.some((rf) => rf.key === field),
    ).length;
  const completionPercentage = Math.round(
    (completedRequiredFields / totalRequiredFields) * 100,
  );

  const isComplete =
    missingFields.filter((field) =>
      requiredFields.some((rf) => rf.key === field),
    ).length === 0;

  return {
    isComplete,
    missingFields,
    completionPercentage,
  };
}
