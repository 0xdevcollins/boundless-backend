import { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";

/**
 * Get session from Express request
 * Useful for server-side route handlers
 */
export async function getSessionFromRequest(req: Request) {
  return await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
}

/**
 * Server-side email sign up
 */
export async function signUpEmailServerSide(body: {
  name: string;
  email: string;
  password: string;
  image?: string;
  callbackURL?: string;
  invitation?: string;
}) {
  return await auth.api.signUpEmail({
    body,
  });
}

/**
 * Server-side email sign in
 * Requires session cookies in headers
 */
export async function signInEmailServerSide(
  body: {
    email: string;
    password: string;
    rememberMe?: boolean;
    callbackURL?: string;
  },
  headers: Headers,
) {
  return await auth.api.signInEmail({
    body,
    headers,
  });
}

/**
 * Server-side sign out
 * Requires session cookies in headers
 */
export async function signOutServerSide(headers: Headers) {
  return await auth.api.signOut({
    headers,
  });
}

/**
 * Server-side password reset request
 */
export async function requestPasswordResetServerSide(body: {
  email: string;
  redirectTo?: string;
}) {
  return await auth.api.requestPasswordReset({
    body,
  });
}

/**
 * Server-side password reset with token
 */
export async function resetPasswordServerSide(body: {
  newPassword: string;
  token: string;
}) {
  return await auth.api.resetPassword({
    body,
  });
}

/**
 * Server-side password change
 * Requires session cookies in headers
 */
export async function changePasswordServerSide(
  body: {
    newPassword: string;
    currentPassword: string;
    revokeOtherSessions?: boolean;
  },
  headers: Headers,
) {
  return await auth.api.changePassword({
    body,
    headers,
  });
}

/**
 * Note: OTP-related endpoints are automatically created by Better Auth
 * and are available at:
 * - POST /api/auth/email-otp/send-verification-otp
 * - POST /api/auth/email-otp/check-verification-otp
 * - POST /api/auth/email-otp/verify-email
 * - POST /api/auth/sign-in/email-otp
 * - POST /api/auth/email-otp/reset-password
 * - POST /api/auth/forget-password/email-otp
 *
 * These can be called directly via HTTP requests or through the Better Auth client.
 * For server-side usage, you can make HTTP requests to these endpoints.
 */

/**
 * Server-side OAuth sign in
 */
export async function signInSocialServerSide(body: {
  provider: "google" | "github";
  callbackURL?: string;
  invitation?: string;
}) {
  return await auth.api.signInSocial({
    body,
  });
}

/**
 * Helper to convert Express request to Headers for Better Auth
 */
export function getHeadersFromRequest(req: Request): Headers {
  return fromNodeHeaders(req.headers);
}
