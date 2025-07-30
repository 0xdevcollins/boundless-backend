import { Response } from "express";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const setAuthCookies = (res: Response, tokens: TokenPair): void => {
  const isProduction = process.env.NODE_ENV === "production";
  const allowInsecureCookies = process.env.ALLOW_INSECURE_COOKIES === "true";

  // Access token cookie
  res.cookie("accessToken", tokens.accessToken, {
    httpOnly: true,
    secure: isProduction && !allowInsecureCookies,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: "/",
  });

  // Refresh token cookie
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction && !allowInsecureCookies,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
};

export const clearAuthCookies = (res: Response): void => {
  const isProduction = process.env.NODE_ENV === "production";
  const allowInsecureCookies = process.env.ALLOW_INSECURE_COOKIES === "true";

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProduction && !allowInsecureCookies,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProduction && !allowInsecureCookies,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
};
