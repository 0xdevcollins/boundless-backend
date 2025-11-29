/**
 * Admin Authentication Client Examples
 *
 * This file provides comprehensive examples for implementing admin passkey
 * authentication in a frontend application (React/Next.js).
 *
 * Copy these examples to your admin dashboard frontend project.
 */

// =============================================================================
// 1. ADMIN AUTH CLIENT SETUP
// =============================================================================

/**
 * admin-auth-client.ts
 *
 * Create this file in your frontend project to set up the admin auth client.
 */
export const adminAuthClientSetup = `
import { createAuthClient } from "better-auth/react"; // or "better-auth/client" for vanilla JS
import { passkeyClient } from "@better-auth/passkey/client";
import { adminClient } from "better-auth/client/plugins";

// Import access control configuration (copy from backend)
import { ac, adminRoles } from "./admin-permissions";

// Admin Auth Client - Passkey + Admin Plugin
export const adminAuth = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://api.boundlessfi.xyz",
  basePath: "/api/admin-auth",
  plugins: [
    passkeyClient(),
    // Admin plugin for user management
    adminClient({
      ac,
      roles: adminRoles,
    }),
  ],
});

// Export typed hooks and utilities
export const {
  useSession: useAdminSession,
  signOut: adminSignOut,
  passkey: adminPasskey,
  admin: adminActions, // User management actions
} = adminAuth;
`;

// =============================================================================
// 2. PASSKEY SIGN-IN COMPONENT
// =============================================================================

/**
 * AdminPasskeyLogin.tsx
 *
 * A React component for admin passkey sign-in.
 */
export const adminPasskeyLoginComponent = `
"use client";

import { useState, useEffect } from "react";
import { adminAuth } from "@/lib/admin-auth-client";

export function AdminPasskeyLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportsPasskey, setSupportsPasskey] = useState(false);

  // Check if browser supports passkeys
  useEffect(() => {
    const checkPasskeySupport = async () => {
      if (
        window.PublicKeyCredential &&
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setSupportsPasskey(available);
      }
    };
    checkPasskeySupport();
  }, []);

  // Conditional UI - preload passkeys for autofill
  useEffect(() => {
    if (!PublicKeyCredential.isConditionalMediationAvailable) return;

    const preloadPasskeys = async () => {
      try {
        const available = await PublicKeyCredential.isConditionalMediationAvailable();
        if (available) {
          // This enables the browser to show passkey suggestions
          adminAuth.signIn.passkey({ autoFill: true });
        }
      } catch (err) {
        // Ignore errors during preload
      }
    };

    preloadPasskeys();
  }, []);

  const handlePasskeySignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await adminAuth.signIn.passkey({
        fetchOptions: {
          onSuccess: () => {
            // Redirect to admin dashboard
            window.location.href = "/admin/dashboard";
          },
          onError: (ctx) => {
            setError(ctx.error.message || "Authentication failed");
          },
        },
      });

      if (error) {
        setError(error.message || "Failed to sign in with passkey");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Passkey sign-in error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!supportsPasskey) {
    return (
      <div className="admin-login-container">
        <div className="error-message">
          Your browser does not support passkeys. Please use a modern browser
          with WebAuthn support.
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-container">
      <h1>Admin Login</h1>
      <p>Sign in with your registered passkey</p>

      {error && <div className="error-message">{error}</div>}

      {/* Input with webauthn autocomplete for Conditional UI */}
      <input
        type="email"
        placeholder="Email (for passkey autofill)"
        autoComplete="username webauthn"
        className="email-input"
      />

      <button
        onClick={handlePasskeySignIn}
        disabled={isLoading}
        className="passkey-button"
      >
        {isLoading ? "Authenticating..." : "Sign in with Passkey"}
      </button>

      <p className="help-text">
        Use your fingerprint, face recognition, or security key to sign in.
      </p>
    </div>
  );
}
`;

// =============================================================================
// 3. PASSKEY REGISTRATION COMPONENT
// =============================================================================

/**
 * AdminPasskeyRegister.tsx
 *
 * A React component for registering a new passkey (for authenticated admins).
 */
export const adminPasskeyRegisterComponent = `
"use client";

import { useState } from "react";
import { adminAuth, useAdminSession } from "@/lib/admin-auth-client";

export function AdminPasskeyRegister() {
  const { data: session, isPending } = useAdminSession();
  const [isRegistering, setIsRegistering] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegisterPasskey = async () => {
    if (!passkeyName.trim()) {
      setError("Please enter a name for your passkey");
      return;
    }

    setIsRegistering(true);
    setError(null);
    setSuccess(false);

    try {
      const { data, error } = await adminAuth.passkey.addPasskey({
        name: passkeyName,
        // Use platform authenticator for built-in biometrics
        authenticatorAttachment: "platform",
      });

      if (error) {
        setError(error.message || "Failed to register passkey");
      } else {
        setSuccess(true);
        setPasskeyName("");
      }
    } catch (err) {
      setError("An unexpected error occurred during registration");
      console.error("Passkey registration error:", err);
    } finally {
      setIsRegistering(false);
    }
  };

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return (
      <div className="error-message">
        You must be authenticated to register a passkey.
      </div>
    );
  }

  return (
    <div className="passkey-register-container">
      <h2>Register New Passkey</h2>
      <p>Add a passkey for secure, passwordless authentication.</p>

      {error && <div className="error-message">{error}</div>}
      {success && (
        <div className="success-message">
          Passkey registered successfully! You can now use it to sign in.
        </div>
      )}

      <div className="form-group">
        <label htmlFor="passkeyName">Passkey Name</label>
        <input
          id="passkeyName"
          type="text"
          value={passkeyName}
          onChange={(e) => setPasskeyName(e.target.value)}
          placeholder="e.g., MacBook Pro, iPhone 15"
          disabled={isRegistering}
        />
      </div>

      <button
        onClick={handleRegisterPasskey}
        disabled={isRegistering || !passkeyName.trim()}
        className="register-button"
      >
        {isRegistering ? "Registering..." : "Register Passkey"}
      </button>

      <p className="help-text">
        You'll be prompted to use your device's biometric authentication
        (fingerprint, face recognition) or PIN.
      </p>
    </div>
  );
}
`;

// =============================================================================
// 4. PASSKEY MANAGEMENT COMPONENT
// =============================================================================

/**
 * AdminPasskeyList.tsx
 *
 * A React component for managing registered passkeys.
 */
export const adminPasskeyListComponent = `
"use client";

import { useState, useEffect } from "react";
import { adminAuth, useAdminSession } from "@/lib/admin-auth-client";

interface Passkey {
  id: string;
  name: string;
  deviceType: string;
  createdAt: string;
  backedUp: boolean;
}

export function AdminPasskeyList() {
  const { data: session } = useAdminSession();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPasskeys = async () => {
    try {
      const { data, error } = await adminAuth.passkey.listUserPasskeys();
      if (error) {
        setError(error.message);
      } else {
        setPasskeys(data || []);
      }
    } catch (err) {
      setError("Failed to load passkeys");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchPasskeys();
    }
  }, [session]);

  const handleDeletePasskey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this passkey?")) return;

    try {
      const { error } = await adminAuth.passkey.deletePasskey({ id });
      if (error) {
        setError(error.message);
      } else {
        setPasskeys((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      setError("Failed to delete passkey");
    }
  };

  const handleUpdatePasskeyName = async (id: string, newName: string) => {
    try {
      const { error } = await adminAuth.passkey.updatePasskey({
        id,
        name: newName,
      });
      if (error) {
        setError(error.message);
      } else {
        setPasskeys((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
        );
      }
    } catch (err) {
      setError("Failed to update passkey");
    }
  };

  if (isLoading) return <div>Loading passkeys...</div>;

  return (
    <div className="passkey-list-container">
      <h2>Your Passkeys</h2>

      {error && <div className="error-message">{error}</div>}

      {passkeys.length === 0 ? (
        <p>No passkeys registered yet.</p>
      ) : (
        <ul className="passkey-list">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="passkey-item">
              <div className="passkey-info">
                <strong>{passkey.name || "Unnamed Passkey"}</strong>
                <span className="device-type">{passkey.deviceType}</span>
                <span className="created-at">
                  Added: {new Date(passkey.createdAt).toLocaleDateString()}
                </span>
                {passkey.backedUp && (
                  <span className="backed-up-badge">Backed Up</span>
                )}
              </div>
              <div className="passkey-actions">
                <button
                  onClick={() => {
                    const newName = prompt("Enter new name:", passkey.name);
                    if (newName) handleUpdatePasskeyName(passkey.id, newName);
                  }}
                  className="edit-button"
                >
                  Rename
                </button>
                <button
                  onClick={() => handleDeletePasskey(passkey.id)}
                  className="delete-button"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
`;

// =============================================================================
// 5. ADMIN SESSION HOOK & PROTECTED ROUTE
// =============================================================================

/**
 * useAdminAuth.ts
 *
 * Custom hook for admin authentication state.
 */
export const useAdminAuthHook = `
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession, adminSignOut } from "@/lib/admin-auth-client";

export function useAdminAuth(options?: { redirectTo?: string }) {
  const { data: session, isPending, error } = useAdminSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session && options?.redirectTo) {
      router.push(options.redirectTo);
    }
  }, [isPending, session, options?.redirectTo, router]);

  const signOut = async () => {
    await adminSignOut();
    router.push("/admin/login");
  };

  return {
    session,
    admin: session?.user,
    isLoading: isPending,
    isAuthenticated: !!session,
    error,
    signOut,
  };
}

// Usage example:
// const { admin, isLoading, isAuthenticated, signOut } = useAdminAuth({
//   redirectTo: "/admin/login"
// });
`;

// =============================================================================
// 6. ADMIN PROTECTED ROUTE COMPONENT
// =============================================================================

/**
 * AdminProtectedRoute.tsx
 *
 * Higher-order component for protecting admin routes.
 */
export const adminProtectedRouteComponent = `
"use client";

import { useAdminAuth } from "@/hooks/useAdminAuth";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminProtectedRoute({
  children,
  fallback = <div>Loading...</div>,
}: AdminProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAdminAuth({
    redirectTo: "/admin/login",
  });

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

// Usage example:
// <AdminProtectedRoute>
//   <AdminDashboard />
// </AdminProtectedRoute>
`;

// =============================================================================
// 7. FULL ADMIN DASHBOARD LAYOUT EXAMPLE
// =============================================================================

/**
 * AdminLayout.tsx
 *
 * Example admin dashboard layout with authentication.
 */
export const adminLayoutExample = `
"use client";

import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { admin, signOut } = useAdminAuth({ redirectTo: "/admin/login" });

  return (
    <AdminProtectedRoute>
      <div className="admin-layout">
        <header className="admin-header">
          <h1>Boundless Admin</h1>
          <nav>
            <a href="/admin/dashboard">Dashboard</a>
            <a href="/admin/users">Users</a>
            <a href="/admin/settings">Settings</a>
          </nav>
          <div className="admin-user">
            <span>{admin?.name}</span>
            <span className="role">{admin?.role}</span>
            <button onClick={signOut}>Sign Out</button>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </AdminProtectedRoute>
  );
}
`;

// =============================================================================
// 8. API ENDPOINTS REFERENCE
// =============================================================================

/**
 * Admin Auth API Endpoints
 *
 * These are the endpoints available for admin authentication.
 */
export const adminAuthEndpoints = {
  // Session
  getSession: {
    method: "GET",
    path: "/api/admin-auth/session",
    description: "Get current admin session",
  },

  // Passkey Registration
  addPasskey: {
    method: "POST",
    path: "/api/admin-auth/passkey/add-passkey",
    description: "Register a new passkey for the authenticated admin",
    body: {
      name: "string (optional) - Name for the passkey",
      authenticatorAttachment: "'platform' | 'cross-platform' (optional)",
    },
  },

  // Passkey Sign In
  signInPasskey: {
    method: "POST",
    path: "/api/admin-auth/sign-in/passkey",
    description: "Sign in using a registered passkey",
    body: {
      autoFill: "boolean (optional) - Enable conditional UI",
    },
  },

  // List Passkeys
  listPasskeys: {
    method: "GET",
    path: "/api/admin-auth/passkey/list-user-passkeys",
    description: "List all passkeys for the authenticated admin",
  },

  // Delete Passkey
  deletePasskey: {
    method: "DELETE",
    path: "/api/admin-auth/passkey/delete-passkey",
    description: "Delete a passkey",
    body: {
      id: "string - The passkey ID to delete",
    },
  },

  // Update Passkey
  updatePasskey: {
    method: "PATCH",
    path: "/api/admin-auth/passkey/update-passkey",
    description: "Update a passkey name",
    body: {
      id: "string - The passkey ID",
      name: "string - New name for the passkey",
    },
  },

  // Sign Out
  signOut: {
    method: "POST",
    path: "/api/admin-auth/sign-out",
    description: "Sign out the current admin session",
  },
};

// =============================================================================
// 9. USER MANAGEMENT EXAMPLES (Admin Plugin)
// =============================================================================

/**
 * UserManagement.tsx
 *
 * Examples for managing regular users via the Admin plugin.
 */
export const userManagementExamples = `
"use client";

import { useState, useEffect } from "react";
import { adminAuth, adminActions } from "@/lib/admin-auth-client";

// ============================================
// CREATE USER
// ============================================
export async function createUser() {
  const { data, error } = await adminAuth.admin.createUser({
    email: "newuser@example.com",
    password: "securePassword123",
    name: "John Doe",
    role: "user", // optional, defaults to "user"
    data: {
      // Optional additional fields
      department: "Engineering",
    },
  });

  if (error) {
    console.error("Failed to create user:", error.message);
    return null;
  }

  console.log("User created:", data);
  return data;
}

// ============================================
// LIST USERS WITH PAGINATION & FILTERING
// ============================================
export async function listUsers(page = 1, pageSize = 10) {
  const { data, error } = await adminAuth.admin.listUsers({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sortBy: "createdAt",
    sortDirection: "desc",
    // Optional filtering
    // searchValue: "john",
    // searchField: "name",
    // searchOperator: "contains",
    // filterField: "role",
    // filterValue: "user",
    // filterOperator: "eq",
  });

  if (error) {
    console.error("Failed to list users:", error.message);
    return null;
  }

  const { users, total, limit, offset } = data;
  const totalPages = Math.ceil(total / pageSize);
  const currentPage = Math.floor(offset / pageSize) + 1;

  return {
    users,
    pagination: {
      total,
      totalPages,
      currentPage,
      pageSize: limit,
    },
  };
}

// ============================================
// UPDATE USER
// ============================================
export async function updateUser(userId: string, updates: Record<string, any>) {
  const { data, error } = await adminAuth.admin.updateUser({
    userId,
    data: updates,
  });

  if (error) {
    console.error("Failed to update user:", error.message);
    return null;
  }

  return data;
}

// ============================================
// SET USER ROLE
// ============================================
export async function setUserRole(userId: string, role: string | string[]) {
  const { data, error } = await adminAuth.admin.setRole({
    userId,
    role, // Can be "admin", "user", or ["admin", "moderator"]
  });

  if (error) {
    console.error("Failed to set role:", error.message);
    return null;
  }

  return data;
}

// ============================================
// SET USER PASSWORD
// ============================================
export async function setUserPassword(userId: string, newPassword: string) {
  const { data, error } = await adminAuth.admin.setUserPassword({
    userId,
    newPassword,
  });

  if (error) {
    console.error("Failed to set password:", error.message);
    return null;
  }

  return data;
}

// ============================================
// REMOVE USER (HARD DELETE)
// ============================================
export async function removeUser(userId: string) {
  const { data, error } = await adminAuth.admin.removeUser({
    userId,
  });

  if (error) {
    console.error("Failed to remove user:", error.message);
    return null;
  }

  return data;
}
`;

// =============================================================================
// 10. BAN/UNBAN USER EXAMPLES
// =============================================================================

/**
 * BanManagement.tsx
 *
 * Examples for banning and unbanning users.
 */
export const banManagementExamples = `
"use client";

import { adminAuth } from "@/lib/admin-auth-client";

// ============================================
// BAN USER
// ============================================
export async function banUser(
  userId: string,
  reason?: string,
  expiresInSeconds?: number
) {
  const { data, error } = await adminAuth.admin.banUser({
    userId,
    banReason: reason || "Violation of terms of service",
    // Optional: Ban expires after X seconds (undefined = permanent)
    banExpiresIn: expiresInSeconds, // e.g., 60 * 60 * 24 * 7 for 7 days
  });

  if (error) {
    console.error("Failed to ban user:", error.message);
    return false;
  }

  console.log("User banned successfully");
  return true;
}

// ============================================
// UNBAN USER
// ============================================
export async function unbanUser(userId: string) {
  const { data, error } = await adminAuth.admin.unbanUser({
    userId,
  });

  if (error) {
    console.error("Failed to unban user:", error.message);
    return false;
  }

  console.log("User unbanned successfully");
  return true;
}

// ============================================
// BAN USER COMPONENT
// ============================================
export function BanUserButton({ userId, isBanned }: { userId: string; isBanned: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleToggleBan = async () => {
    setLoading(true);
    try {
      if (isBanned) {
        await unbanUser(userId);
      } else {
        const reason = prompt("Enter ban reason:");
        if (reason) {
          await banUser(userId, reason);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleToggleBan} disabled={loading}>
      {loading ? "Processing..." : isBanned ? "Unban User" : "Ban User"}
    </button>
  );
}
`;

// =============================================================================
// 11. SESSION MANAGEMENT EXAMPLES
// =============================================================================

/**
 * SessionManagement.tsx
 *
 * Examples for managing user sessions.
 */
export const sessionManagementExamples = `
"use client";

import { adminAuth } from "@/lib/admin-auth-client";

// ============================================
// LIST USER SESSIONS
// ============================================
export async function listUserSessions(userId: string) {
  const { data, error } = await adminAuth.admin.listUserSessions({
    userId,
  });

  if (error) {
    console.error("Failed to list sessions:", error.message);
    return [];
  }

  return data;
}

// ============================================
// REVOKE SPECIFIC SESSION
// ============================================
export async function revokeSession(sessionToken: string) {
  const { data, error } = await adminAuth.admin.revokeUserSession({
    sessionToken,
  });

  if (error) {
    console.error("Failed to revoke session:", error.message);
    return false;
  }

  return true;
}

// ============================================
// REVOKE ALL USER SESSIONS
// ============================================
export async function revokeAllUserSessions(userId: string) {
  const { data, error } = await adminAuth.admin.revokeUserSessions({
    userId,
  });

  if (error) {
    console.error("Failed to revoke sessions:", error.message);
    return false;
  }

  return true;
}

// ============================================
// SESSION LIST COMPONENT
// ============================================
export function UserSessionsList({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    setLoading(true);
    const data = await listUserSessions(userId);
    setSessions(data);
    setLoading(false);
  };

  const handleRevokeSession = async (token: string) => {
    await revokeSession(token);
    loadSessions();
  };

  const handleRevokeAll = async () => {
    await revokeAllUserSessions(userId);
    loadSessions();
  };

  if (loading) return <div>Loading sessions...</div>;

  return (
    <div>
      <h3>Active Sessions</h3>
      <button onClick={handleRevokeAll}>Revoke All Sessions</button>
      <ul>
        {sessions.map((session) => (
          <li key={session.token}>
            <span>Created: {new Date(session.createdAt).toLocaleString()}</span>
            <span>Expires: {new Date(session.expiresAt).toLocaleString()}</span>
            <button onClick={() => handleRevokeSession(session.token)}>
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
`;

// =============================================================================
// 12. USER IMPERSONATION EXAMPLES
// =============================================================================

/**
 * Impersonation.tsx
 *
 * Examples for impersonating users (for debugging/support).
 */
export const impersonationExamples = `
"use client";

import { adminAuth } from "@/lib/admin-auth-client";

// ============================================
// IMPERSONATE USER
// ============================================
export async function impersonateUser(userId: string) {
  const { data, error } = await adminAuth.admin.impersonateUser({
    userId,
  });

  if (error) {
    console.error("Failed to impersonate user:", error.message);
    return false;
  }

  // Session is now impersonating the target user
  // Redirect to the user's dashboard to see their view
  window.location.href = "/dashboard";
  return true;
}

// ============================================
// STOP IMPERSONATING
// ============================================
export async function stopImpersonating() {
  const { data, error } = await adminAuth.admin.stopImpersonating();

  if (error) {
    console.error("Failed to stop impersonating:", error.message);
    return false;
  }

  // Session is restored to admin's original session
  window.location.href = "/admin/dashboard";
  return true;
}

// ============================================
// IMPERSONATION BANNER COMPONENT
// ============================================
export function ImpersonationBanner() {
  const { data: session } = useAdminSession();
  
  // Check if currently impersonating (session has impersonatedBy field)
  const isImpersonating = session?.session?.impersonatedBy;

  if (!isImpersonating) return null;

  return (
    <div className="impersonation-banner">
      <span>⚠️ You are currently impersonating a user</span>
      <button onClick={stopImpersonating}>
        Stop Impersonating
      </button>
    </div>
  );
}

// ============================================
// IMPERSONATE BUTTON COMPONENT
// ============================================
export function ImpersonateUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [loading, setLoading] = useState(false);

  const handleImpersonate = async () => {
    if (!confirm(\`Are you sure you want to impersonate \${userName}?\`)) return;
    
    setLoading(true);
    await impersonateUser(userId);
    setLoading(false);
  };

  return (
    <button onClick={handleImpersonate} disabled={loading}>
      {loading ? "Starting session..." : "Impersonate"}
    </button>
  );
}
`;

// =============================================================================
// 13. PERMISSION CHECKING EXAMPLES
// =============================================================================

/**
 * Permissions.tsx
 *
 * Examples for checking admin permissions.
 */
export const permissionCheckingExamples = `
"use client";

import { adminAuth } from "@/lib/admin-auth-client";

// ============================================
// CHECK IF CURRENT USER HAS PERMISSION
// ============================================
export async function checkPermission(
  resource: string,
  actions: string[]
): Promise<boolean> {
  const { data, error } = await adminAuth.admin.hasPermission({
    permission: {
      [resource]: actions,
    },
  });

  if (error) {
    console.error("Permission check failed:", error.message);
    return false;
  }

  return data?.success || false;
}

// ============================================
// CHECK ROLE PERMISSION (CLIENT-SIDE, SYNCHRONOUS)
// ============================================
export function checkRolePermission(
  role: string,
  resource: string,
  actions: string[]
): boolean {
  // This is synchronous and doesn't need to contact the server
  return adminAuth.admin.checkRolePermission({
    role,
    permissions: {
      [resource]: actions,
    },
  });
}

// ============================================
// PERMISSION-GATED COMPONENT
// ============================================
export function PermissionGate({
  resource,
  action,
  children,
  fallback = null,
}: {
  resource: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkPermission(resource, [action]).then(setHasPermission);
  }, [resource, action]);

  if (hasPermission === null) return null; // Loading
  if (!hasPermission) return <>{fallback}</>;
  
  return <>{children}</>;
}

// Usage:
// <PermissionGate resource="user" action="delete">
//   <DeleteUserButton userId={userId} />
// </PermissionGate>

// ============================================
// USE PERMISSIONS HOOK
// ============================================
export function usePermission(resource: string, action: string) {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    checkPermission(resource, [action])
      .then(setHasPermission)
      .finally(() => setLoading(false));
  }, [resource, action]);

  return { hasPermission, loading };
}

// Usage:
// const { hasPermission, loading } = usePermission("project", "delete");
// if (loading) return <Spinner />;
// if (hasPermission) return <DeleteButton />;
`;

// =============================================================================
// 14. ADMIN PLUGIN API ENDPOINTS REFERENCE
// =============================================================================

/**
 * Admin Plugin API Endpoints (in addition to passkey endpoints)
 */
export const adminPluginEndpoints = {
  // User Management
  createUser: {
    method: "POST",
    path: "/api/admin-auth/admin/create-user",
    description: "Create a new user",
  },
  listUsers: {
    method: "GET",
    path: "/api/admin-auth/admin/list-users",
    description: "List users with filtering, sorting, and pagination",
  },
  updateUser: {
    method: "POST",
    path: "/api/admin-auth/admin/update-user",
    description: "Update user details",
  },
  removeUser: {
    method: "POST",
    path: "/api/admin-auth/admin/remove-user",
    description: "Hard delete a user",
  },

  // Role Management
  setRole: {
    method: "POST",
    path: "/api/admin-auth/admin/set-role",
    description: "Set user role(s)",
  },
  setUserPassword: {
    method: "POST",
    path: "/api/admin-auth/admin/set-user-password",
    description: "Change user password",
  },

  // Ban Management
  banUser: {
    method: "POST",
    path: "/api/admin-auth/admin/ban-user",
    description: "Ban a user",
  },
  unbanUser: {
    method: "POST",
    path: "/api/admin-auth/admin/unban-user",
    description: "Unban a user",
  },

  // Session Management
  listUserSessions: {
    method: "POST",
    path: "/api/admin-auth/admin/list-user-sessions",
    description: "List all sessions for a user",
  },
  revokeUserSession: {
    method: "POST",
    path: "/api/admin-auth/admin/revoke-user-session",
    description: "Revoke a specific session",
  },
  revokeUserSessions: {
    method: "POST",
    path: "/api/admin-auth/admin/revoke-user-sessions",
    description: "Revoke all sessions for a user",
  },

  // Impersonation
  impersonateUser: {
    method: "POST",
    path: "/api/admin-auth/admin/impersonate-user",
    description: "Start impersonating a user",
  },
  stopImpersonating: {
    method: "POST",
    path: "/api/admin-auth/admin/stop-impersonating",
    description: "Stop impersonating and return to admin session",
  },

  // Permissions
  hasPermission: {
    method: "POST",
    path: "/api/admin-auth/admin/has-permission",
    description: "Check if current user has specific permissions",
  },
};

console.log("Admin Auth Client Examples loaded.");
console.log("Copy these examples to your frontend admin dashboard project.");
