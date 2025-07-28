import { Response } from "express";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const setAuthCookies = (res: Response, tokens: TokenPair): void => {
  const isProduction = process.env.NODE_ENV === "production";
  const allowInsecureCookies = process.env.ALLOW_INSECURE_COOKIES === "true";

  res.cookie("accessToken", tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Set refresh token cookie
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: false,
    secure: isProduction && !allowInsecureCookies, // Allow insecure in dev with flag
    sameSite: isProduction && !allowInsecureCookies ? "strict" : "none", // Allow cross-origin in development
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    // In production, don't set domain to allow subdomain sharing
    // In development, don't set domain to allow localhost
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
};
