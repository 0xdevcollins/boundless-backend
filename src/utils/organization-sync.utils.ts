import { auth } from "../lib/auth.js";
import Organization from "../models/organization.model.js";
import User from "../models/user.model.js";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";

/**
 * Get Better Auth organization ID from custom Organization model
 */
export async function getBetterAuthOrgId(
  customOrgId: string,
): Promise<string | null> {
  const customOrg = await Organization.findById(customOrgId);
  return customOrg?.betterAuthOrgId || null;
}

/**
 * Get custom Organization from Better Auth organization ID
 */
export async function getCustomOrgFromBetterAuth(
  betterAuthOrgId: string,
): Promise<InstanceType<typeof Organization> | null> {
  return await Organization.findOne({ betterAuthOrgId });
}

/**
 * Sync Better Auth organization members to custom Organization model
 */
export async function syncMembersToCustomOrg(
  betterAuthOrgId: string,
): Promise<void> {
  try {
    const customOrg = await Organization.findOne({ betterAuthOrgId });
    if (!customOrg) {
      return;
    }

    // Get members from Better Auth
    const members = await auth.api.listMembers({
      query: {
        organizationId: betterAuthOrgId,
      },
    });

    if (!members || !members.members || members.members.length === 0) {
      return;
    }

    // Get user emails from member user IDs
    const memberEmails: string[] = [];
    for (const member of members.members) {
      const user = await User.findOne({ email: member.user.email });
      if (user) {
        memberEmails.push(user.email.toLowerCase());
      }
    }

    // Update custom org members
    customOrg.members = memberEmails;

    // Update admins based on roles
    const adminEmails: string[] = [];
    for (const member of members.members) {
      if (member.role === "admin" || member.role === "owner") {
        const user = await User.findOne({ email: member.user.email });
        if (user) {
          adminEmails.push(user.email.toLowerCase());
        }
      }
    }
    customOrg.admins = adminEmails;

    // Update owner
    const ownerMember = members.members.find((m) => m.role === "owner");
    if (ownerMember) {
      const ownerUser = await User.findOne({ email: ownerMember.user.email });
      if (ownerUser) {
        customOrg.owner = ownerUser.email.toLowerCase();
      }
    }

    await customOrg.save();
  } catch (error) {
    console.error("Error syncing members to custom org:", error);
  }
}

/**
 * Link custom Organization to Better Auth organization
 */
export async function linkCustomOrgToBetterAuth(
  customOrgId: string,
  betterAuthOrgId: string,
): Promise<void> {
  await Organization.findByIdAndUpdate(customOrgId, {
    betterAuthOrgId,
  });
}

/**
 * Get Better Auth session from request headers
 */
export async function getBetterAuthSession(req: Request) {
  return await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
}
