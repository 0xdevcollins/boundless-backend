import { Response } from "express";
import { sendBadRequest } from "../../utils/apiResponse";
import { isValidUrl } from "./crowdfunding.helpers";

export const validateMilestones = (
  milestones: any[],
  res: Response,
): boolean => {
  for (const milestone of milestones) {
    if (!milestone.name?.trim() || !milestone.description?.trim()) {
      sendBadRequest(res, "Each milestone must have a name and description");
      return false;
    }
    if (!milestone.startDate || !milestone.endDate) {
      sendBadRequest(res, "Each milestone must have start and end dates");
      return false;
    }
    if (new Date(milestone.startDate) >= new Date(milestone.endDate)) {
      sendBadRequest(res, "Milestone start date must be before end date");
      return false;
    }
  }
  return true;
};

export const validateTeamMembers = (
  team: any[],
  res: Response,
): { valid: boolean; invitations: Array<{ email: string }> } => {
  const invitations: Array<{ email: string }> = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const member of team) {
    if (!member.email?.trim()) {
      sendBadRequest(res, "Each team member must have an email");
      return { valid: false, invitations: [] };
    }

    if (!emailRegex.test(member.email.trim())) {
      sendBadRequest(
        res,
        `Invalid email format for team member: ${member.email}`,
      );
      return { valid: false, invitations: [] };
    }

    invitations.push({ email: member.email.trim() });
  }

  return { valid: true, invitations };
};

export const validateSocialLinks = (
  socialLinks: any[],
  res: Response,
): boolean => {
  for (const link of socialLinks) {
    if (!link.platform?.trim() || !link.url?.trim()) {
      sendBadRequest(res, "Each social link must have a platform and URL");
      return false;
    }
    if (!isValidUrl(link.url)) {
      sendBadRequest(res, `Invalid URL for ${link.platform} social link`);
      return false;
    }
  }
  return true;
};

export const validateUrls = (
  urlFields: Array<{ field?: string; name: string }>,
  res: Response,
): boolean => {
  for (const { field, name } of urlFields) {
    if (field && !isValidUrl(field)) {
      sendBadRequest(res, `Invalid ${name}`);
      return false;
    }
  }
  return true;
};
