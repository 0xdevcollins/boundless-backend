import User from "../../models/user.model.js";

export const createDefaultUserSettings = () => ({
  notifications: { email: true, push: true, inApp: true },
  privacy: {
    profileVisibility: "PUBLIC" as const,
    showWalletAddress: false,
    showContributions: true,
  },
  preferences: {
    language: "en",
    timezone: "UTC",
    theme: "SYSTEM" as const,
  },
});

export const createDefaultUserProfile = (
  firstName: string,
  lastName: string,
  username: string,
  avatar: string = "",
) => ({
  firstName,
  lastName,
  username,
  avatar,
  bio: "",
  location: "",
  website: "",
  socialLinks: {},
});

export const createUserFromOAuth = (
  email: string,
  firstName: string,
  lastName: string,
  username: string,
  avatar: string,
  invitation?: string,
) => {
  return new User({
    email,
    profile: createDefaultUserProfile(firstName, lastName, username, avatar),
    settings: createDefaultUserSettings(),
    isVerified: true,
    ...(invitation && { invitationToken: invitation }),
  });
};

export const extractRefreshToken = (req: any): string | null => {
  return (
    req.cookies?.refreshToken ||
    req.body?.refreshToken ||
    req.headers["x-refresh-token"] ||
    null
  );
};
