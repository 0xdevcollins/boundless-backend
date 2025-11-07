import { IOrganization } from "../models/organization.model";

const getUserRole = (
  organization: IOrganization,
  userEmail: string,
): "owner" | "admin" | "member" | null => {
  if (organization.owner === userEmail) return "owner";
  if (organization.admins?.includes(userEmail)) return "admin";
  if (organization.members.includes(userEmail)) return "member";
  return null;
};

export const checkPermission = (
  organization: IOrganization,
  userEmail: string,
  requiredPermissions: Array<"owner" | "admin" | "member">,
): boolean => {
  const userRole = getUserRole(organization, userEmail);
  if (!userRole) return false;
  return requiredPermissions.includes(userRole);
};

export default getUserRole;
