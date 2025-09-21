import { Request } from "express";

/**
 * Source detection configuration
 */
export interface SourceDetectionConfig {
  /** Custom source mappings for referer URLs */
  customRefererMappings?: Record<string, string>;
  /** Custom source mappings for user agent patterns */
  customUserAgentMappings?: Record<string, string>;
  /** Default source when no pattern matches */
  defaultSource?: string;
}

/**
 * Predefined source mappings
 */
const DEFAULT_REFERER_MAPPINGS: Record<string, string> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "linkedin.com": "linkedin",
  "instagram.com": "instagram",
  "youtube.com": "youtube",
  "tiktok.com": "tiktok",
  "google.com": "google",
  "/landing": "landing-page",
  "/blog": "blog",
  "/newsletter": "newsletter",
  "/waitlist": "waitlist",
  "/signup": "signup",
  "/register": "register",
};

const DEFAULT_USER_AGENT_MAPPINGS: Record<string, string> = {
  "Mobile App": "mobile-app",
  Android: "mobile-web",
  iPhone: "mobile-web",
  iPad: "mobile-web",
  "Windows Phone": "mobile-web",
};

/**
 * Detects the source of a request based on referer URL and user agent
 * @param req - Express request object
 * @param config - Optional configuration for custom mappings
 * @returns Detected source string
 */
export const detectSourceFromRequest = (
  req: Request,
  config: SourceDetectionConfig = {},
): string => {
  const {
    customRefererMappings = {},
    customUserAgentMappings = {},
    defaultSource = "website",
  } = config;

  const referer = req.headers.referer || req.headers.referrer;
  const userAgent = req.headers["user-agent"] || "";

  const refererMappings = {
    ...DEFAULT_REFERER_MAPPINGS,
    ...customRefererMappings,
  };
  const userAgentMappings = {
    ...DEFAULT_USER_AGENT_MAPPINGS,
    ...customUserAgentMappings,
  };

  if (referer) {
    for (const [pattern, source] of Object.entries(refererMappings)) {
      if (referer.includes(pattern)) {
        return source;
      }
    }
  }

  for (const [pattern, source] of Object.entries(userAgentMappings)) {
    if (userAgent.includes(pattern)) {
      return source;
    }
  }

  return defaultSource;
};

/**
 * Detects source with additional context (e.g., campaign parameters)
 * @param req - Express request object
 * @param additionalContext - Additional context like campaign parameters
 * @param config - Optional configuration for custom mappings
 * @returns Detected source string
 */
export const detectSourceWithContext = (
  req: Request,
  additionalContext: {
    campaign?: string;
    medium?: string;
    source?: string;
    [key: string]: any;
  } = {},
  config: SourceDetectionConfig = {},
): string => {
  if (additionalContext.source) {
    return additionalContext.source;
  }

  if (additionalContext.campaign) {
    return `campaign-${additionalContext.campaign}`;
  }

  if (additionalContext.medium) {
    return `medium-${additionalContext.medium}`;
  }

  return detectSourceFromRequest(req, config);
};

/**
 * Common source detection configurations for different use cases
 */
export const SOURCE_CONFIGS = {
  /** Configuration for newsletter subscriptions */
  NEWSLETTER: {
    defaultSource: "website",
    customRefererMappings: {
      "/newsletter": "newsletter",
      "/subscribe": "newsletter",
    },
  },
  WAITLIST: {
    defaultSource: "website",
    customRefererMappings: {
      "/waitlist": "waitlist",
      "/early-access": "waitlist",
    },
  },
  REGISTRATION: {
    defaultSource: "website",
    customRefererMappings: {
      "/signup": "signup",
      "/register": "register",
      "/join": "register",
    },
  },
  GENERAL: {
    defaultSource: "website",
  },
} as const;

export default {
  detectSourceFromRequest,
  detectSourceWithContext,
  SOURCE_CONFIGS,
};
