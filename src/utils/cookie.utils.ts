import { Response } from "express";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const setAuthCookies = (res: Response, tokens: TokenPair): void => {
  res.cookie("accessToken", tokens.accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 60 * 60 * 1000, // 1 hour
    path: "/",
  });

  // Set refresh token cookie
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
};
