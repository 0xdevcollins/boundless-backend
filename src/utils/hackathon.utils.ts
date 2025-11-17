import Hackathon from "../models/hackathon.model.js";
import { generateSlug } from "./blog.utils.js";

/**
 * Check if a hackathon slug already exists
 */
export const hackathonSlugExists = async (
  slug: string,
  excludeId?: string,
): Promise<boolean> => {
  const query: any = { slug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingHackathon = await Hackathon.findOne(query);
  return !!existingHackathon;
};

/**
 * Ensure a hackathon slug is unique by appending a number if necessary
 */
export const ensureUniqueHackathonSlug = async (
  slug: string,
  excludeId?: string,
): Promise<string> => {
  let finalSlug = slug;
  let counter = 1;

  while (await hackathonSlugExists(finalSlug, excludeId)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
};

/**
 * Generate and ensure unique slug for a hackathon
 */
export const generateHackathonSlug = async (
  title: string,
  excludeId?: string,
): Promise<string> => {
  const baseSlug = generateSlug(title);
  return await ensureUniqueHackathonSlug(baseSlug, excludeId);
};
