import Blog from "../models/blog";

/**
 * Generate a URL-friendly slug from a title
 */
export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Ensure a slug is unique by appending a number if necessary
 */
export const ensureUniqueSlug = async (
  slug: string,
  excludeId?: string,
): Promise<string> => {
  let finalSlug = slug;
  let counter = 1;

  while (await slugExists(finalSlug, excludeId)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
};

/**
 * Check if a slug already exists
 */
export const slugExists = async (
  slug: string,
  excludeId?: string,
): Promise<boolean> => {
  const query: any = { slug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingBlog = await Blog.findOne(query);
  return !!existingBlog;
};

/**
 * Calculate reading time based on content
 */
export const calculateReadingTime = (content: string): number => {
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / 200); // Assuming 200 words per minute
};

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeContent = (content: string): string => {
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
};

/**
 * Extract excerpt from content (first 150 words)
 */
export const extractExcerpt = (
  content: string,
  maxLength: number = 150,
): string => {
  const words = content.split(/\s+/);
  if (words.length <= maxLength) {
    return content;
  }

  return words.slice(0, maxLength).join(" ") + "...";
};

/**
 * Process markdown content (placeholder for markdown processing)
 */
export const processMarkdown = async (content: string): Promise<string> => {
  // This is a placeholder - you can integrate a markdown processor like marked or markdown-it
  // For now, just return the content as-is
  return content;
};

/**
 * Generate SEO-friendly meta title
 */
export const generateMetaTitle = (title: string, siteName?: string): string => {
  const maxLength = 60;
  const baseTitle = siteName ? `${title} | ${siteName}` : title;

  if (baseTitle.length <= maxLength) {
    return baseTitle;
  }

  return title.substring(0, maxLength - 3) + "...";
};

/**
 * Generate SEO-friendly meta description
 */
export const generateMetaDescription = (
  excerpt: string,
  maxLength: number = 160,
): string => {
  if (excerpt.length <= maxLength) {
    return excerpt;
  }

  return excerpt.substring(0, maxLength - 3) + "...";
};

/**
 * Validate blog post data
 */
export const validateBlogPost = (post: any): string[] => {
  const errors: string[] = [];

  if (!post.title || post.title.length < 5) {
    errors.push("Title must be at least 5 characters");
  }

  if (!post.excerpt || post.excerpt.length < 20) {
    errors.push("Excerpt must be at least 20 characters");
  }

  if (!post.content || post.content.length < 100) {
    errors.push("Content must be at least 100 characters");
  }

  if (!post.slug || !/^[a-z0-9-]+$/.test(post.slug)) {
    errors.push(
      "Slug must contain only lowercase letters, numbers, and hyphens",
    );
  }

  if (!post.category) {
    errors.push("Category is required");
  }

  if (!post.authors || post.authors.length === 0) {
    errors.push("At least one author is required");
  }

  if (!post.publishedAt || isNaN(Date.parse(post.publishedAt))) {
    errors.push("Valid published date is required");
  }

  return errors;
};

/**
 * Process blog post data before saving
 */
export const processBlogPost = async (post: any): Promise<any> => {
  // Generate slug if not provided
  if (!post.slug) {
    post.slug = generateSlug(post.title);
  }

  // Ensure unique slug
  post.slug = await ensureUniqueSlug(post.slug, post.id);

  // Calculate reading time
  post.readingTime = calculateReadingTime(post.content);

  // Sanitize content
  post.content = sanitizeContent(post.content);

  // Process markdown
  post.content = await processMarkdown(post.content);

  // Format dates
  if (post.publishedAt) {
    post.publishedAt = new Date(post.publishedAt).toISOString();
  }
  post.updatedAt = new Date().toISOString();

  return post;
};

/**
 * Build search query for full-text search
 */
export const buildSearchQuery = (searchTerm: string, filters: any = {}) => {
  const query: any = {
    status: "published",
    $or: [
      { title: { $regex: searchTerm, $options: "i" } },
      { excerpt: { $regex: searchTerm, $options: "i" } },
      { content: { $regex: searchTerm, $options: "i" } },
    ],
  };

  // Add additional filters
  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $in: filters.tags };
  }

  if (filters.author) {
    query.authors = { $in: [filters.author] };
  }

  if (filters.dateFrom || filters.dateTo) {
    query.publishedAt = {};
    if (filters.dateFrom) {
      query.publishedAt.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      query.publishedAt.$lte = new Date(filters.dateTo);
    }
  }

  return query;
};

/**
 * Build sort options for blog queries
 */
export const buildSortOptions = (
  sortBy: string = "publishedAt",
  sortOrder: string = "desc",
) => {
  const sortOptions: any = {};

  switch (sortBy) {
    case "title":
      sortOptions.title = sortOrder === "asc" ? 1 : -1;
      break;
    case "views":
      sortOptions["stats.views"] = sortOrder === "asc" ? 1 : -1;
      break;
    case "likes":
      sortOptions["stats.likes"] = sortOrder === "asc" ? 1 : -1;
      break;
    case "createdAt":
      sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
      break;
    case "updatedAt":
      sortOptions.updatedAt = sortOrder === "asc" ? 1 : -1;
      break;
    default:
      sortOptions.publishedAt = sortOrder === "asc" ? 1 : -1;
  }

  return sortOptions;
};
