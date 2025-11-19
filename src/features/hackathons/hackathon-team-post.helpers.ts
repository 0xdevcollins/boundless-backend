import { ContactMethod } from "../../models/hackathon-team-recruitment-post.model.js";

/**
 * Validate contact info based on contact method
 */
export const validateContactInfo = (
  method: ContactMethod,
  info: string,
): { valid: boolean; message?: string } => {
  if (!info || typeof info !== "string" || info.trim().length === 0) {
    return { valid: false, message: "Contact info is required" };
  }

  const trimmedInfo = info.trim();

  switch (method) {
    case ContactMethod.EMAIL: {
      // Email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedInfo)) {
        return { valid: false, message: "Invalid email format" };
      }
      break;
    }

    case ContactMethod.TELEGRAM: {
      // Telegram: username (with or without @) or URL
      if (trimmedInfo.startsWith("http")) {
        // URL format - basic validation
        try {
          new URL(trimmedInfo);
        } catch {
          return { valid: false, message: "Invalid Telegram URL format" };
        }
      } else {
        // Username format: @username or username (alphanumeric + underscore)
        const usernameRegex = /^@?[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(trimmedInfo)) {
          return {
            valid: false,
            message:
              "Telegram username must be alphanumeric with optional underscore",
          };
        }
      }
      break;
    }

    case ContactMethod.DISCORD: {
      // Discord: username (e.g., username#1234) or invite link
      // Very permissive - just check it's not empty
      // Discord usernames can be complex, so we accept any string
      if (trimmedInfo.startsWith("http")) {
        try {
          new URL(trimmedInfo);
        } catch {
          return { valid: false, message: "Invalid Discord URL format" };
        }
      }
      // Otherwise accept any string for Discord username
      break;
    }

    case ContactMethod.GITHUB: {
      // GitHub: username (with or without @) or profile URL
      if (trimmedInfo.startsWith("http")) {
        // URL format
        try {
          const url = new URL(trimmedInfo);
          if (!url.hostname.includes("github.com")) {
            return {
              valid: false,
              message: "GitHub URL must be from github.com",
            };
          }
        } catch {
          return { valid: false, message: "Invalid GitHub URL format" };
        }
      } else {
        // Username format: GitHub username pattern
        // GitHub usernames: alphanumeric, hyphens (but not consecutive or at start/end)
        const githubUsernameRegex =
          /^[a-zA-Z0-9]([a-zA-Z0-9]|-(?![.-])){0,38}$/;
        const cleanUsername = trimmedInfo.replace(/^@/, ""); // Remove @ if present
        if (!githubUsernameRegex.test(cleanUsername)) {
          return {
            valid: false,
            message: "Invalid GitHub username format",
          };
        }
      }
      break;
    }

    case ContactMethod.OTHER: {
      // Other: Accept any string
      break;
    }

    default:
      return { valid: false, message: "Invalid contact method" };
  }

  return { valid: true };
};

/**
 * Format contact info for display
 */
export const formatContactInfo = (
  method: ContactMethod,
  info: string,
): string => {
  switch (method) {
    case ContactMethod.EMAIL:
      return info;
    case ContactMethod.TELEGRAM:
      if (info.startsWith("http")) {
        return info;
      }
      return info.startsWith("@") ? info : `@${info}`;
    case ContactMethod.DISCORD:
      return info;
    case ContactMethod.GITHUB:
      if (info.startsWith("http")) {
        return info;
      }
      return info.startsWith("@") ? info : `@${info}`;
    case ContactMethod.OTHER:
      return info;
    default:
      return info;
  }
};
