/**
 * Admin Access Control Configuration
 *
 * Defines custom permissions for different admin roles using Better Auth's
 * access control system. This allows fine-grained control over what each
 * admin role can do.
 *
 * @see https://www.better-auth.com/docs/plugins/admin#access-control
 */

import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

/**
 * Custom permission statements
 *
 * Extends the default Better Auth admin statements with custom resources
 * specific to the Boundless platform.
 */
export const statement = {
  // Include default Better Auth admin statements
  ...defaultStatements,

  // Custom Boundless-specific resources
  organization: ["create", "read", "update", "delete", "manage-members"],
  project: ["create", "read", "update", "delete", "feature", "approve"],
  grant: ["create", "read", "update", "delete", "approve", "reject"],
  hackathon: ["create", "read", "update", "delete", "manage"],
  blog: ["create", "read", "update", "delete", "publish"],
  crowdfunding: ["create", "read", "update", "delete", "approve", "feature"],
  analytics: ["view", "export"],
  settings: ["read", "update"],
  overview: ["view"], // Add overview permission
} as const;

/**
 * Create the access controller with our custom statements
 */
export const ac = createAccessControl(statement);

/**
 * SUPER_ADMIN Role
 *
 * Full access to everything. Can manage other admins, all users,
 * and all platform resources.
 */
export const superAdmin = ac.newRole({
  // Include all default admin permissions
  ...adminAc.statements,

  // Full access to all custom resources
  organization: ["create", "read", "update", "delete", "manage-members"],
  project: ["create", "read", "update", "delete", "feature", "approve"],
  grant: ["create", "read", "update", "delete", "approve", "reject"],
  hackathon: ["create", "read", "update", "delete", "manage"],
  blog: ["create", "read", "update", "delete", "publish"],
  crowdfunding: ["create", "read", "update", "delete", "approve", "feature"],
  analytics: ["view", "export"],
  settings: ["read", "update"],
});

/**
 * ADMIN Role
 *
 * Can manage regular users and most platform resources.
 * Cannot manage other admins or access sensitive settings.
 */
export const adminRole = ac.newRole({
  // User management (cannot delete users or set admin roles)
  user: ["create", "list", "ban", "set-role", "set-password"],
  session: ["list", "revoke"],

  // Platform resource management
  organization: ["read", "update", "manage-members"],
  project: ["read", "update", "delete", "feature", "approve"],
  grant: ["read", "update", "approve", "reject"],
  hackathon: ["read", "update", "manage"],
  blog: ["create", "read", "update", "delete", "publish"],
  crowdfunding: ["read", "update", "approve", "feature"],
  analytics: ["view"],
  settings: ["read"],
});

/**
 * MODERATOR Role
 *
 * Limited to content moderation and user oversight.
 * Cannot create or delete major resources.
 */
export const moderator = ac.newRole({
  // Limited user management (can only view and ban)
  user: ["list", "ban"],
  session: ["list"],

  // Read-only access to most resources, can moderate content
  organization: ["read"],
  project: ["read", "approve"],
  grant: ["read"],
  hackathon: ["read"],
  blog: ["read", "update"], // Can edit blog posts for moderation
  crowdfunding: ["read", "approve"],
  analytics: ["view"],
});

/**
 * Role configuration object for the admin plugin
 *
 * Pass this to the admin plugin's `roles` option.
 */
export const adminRoles = {
  super_admin: superAdmin,
  admin: adminRole,
  moderator: moderator,
};

/**
 * Permission check helper
 *
 * Use this to check if a role has a specific permission.
 *
 * @example
 * ```ts
 * if (hasPermission('admin', 'project', 'delete')) {
 *   // Allow deletion
 * }
 * ```
 */
export function hasPermission(
  role: keyof typeof adminRoles,
  resource: keyof typeof statement,
  action: string,
): boolean {
  const rolePermissions = adminRoles[role];
  if (!rolePermissions) return false;

  const resourcePermissions = (rolePermissions as any).statements?.[resource];
  if (!resourcePermissions) return false;

  return resourcePermissions.includes(action);
}

/**
 * Get all permissions for a role
 *
 * @example
 * ```ts
 * const perms = getRolePermissions('moderator');
 * // Returns: { user: ['list', 'ban'], project: ['read', 'approve'], ... }
 * ```
 */
export function getRolePermissions(
  role: keyof typeof adminRoles,
): Record<string, string[]> | null {
  const roleConfig = adminRoles[role];
  if (!roleConfig) return null;

  return (roleConfig as any).statements || null;
}
