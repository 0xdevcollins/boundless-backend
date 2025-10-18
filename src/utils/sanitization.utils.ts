/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes all HTML tags and attributes, keeping only text content
 */
export const sanitizeHtml = (content: string): string => {
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "") // Remove iframe tags
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "") // Remove object tags
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "") // Remove embed tags
    .replace(/<[^>]*>/g, "") // Remove all remaining HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .replace(/data:/gi, "") // Remove data: protocols
    .replace(/vbscript:/gi, "") // Remove vbscript: protocols
    .trim();
};

/**
 * Sanitize plain text content
 */
export const sanitizeText = (content: string): string => {
  return content
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML characters
    .replace(/javascript:/gi, "") // Remove javascript: protocols
    .replace(/on\w+=/gi, "") // Remove event handlers
    .replace(/script/gi, "") // Remove script tags
    .replace(/iframe/gi, "") // Remove iframe tags
    .replace(/object/gi, "") // Remove object tags
    .replace(/embed/gi, ""); // Remove embed tags
};

/**
 * Validate and sanitize comment content
 */
export const sanitizeCommentContent = (content: string): string => {
  // First sanitize HTML
  let sanitized = sanitizeHtml(content);

  // Then sanitize text
  sanitized = sanitizeText(sanitized);

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, " ");

  return sanitized;
};

/**
 * Validate URL format
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ["http:", "https:"].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

/**
 * Sanitize and validate URLs
 */
export const sanitizeUrl = (url: string): string | null => {
  const sanitized = url.trim();

  if (!isValidUrl(sanitized)) {
    return null;
  }

  return sanitized;
};

/**
 * Check for potential SQL injection patterns (though MongoDB is less vulnerable)
 */
export const containsSqlInjection = (content: string): boolean => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(\b(OR|AND)\s+'.*'\s*=\s*'.*')/gi,
    /(\bUNION\s+SELECT\b)/gi,
    /(\bDROP\s+TABLE\b)/gi,
    /(\bINSERT\s+INTO\b)/gi,
    /(\bUPDATE\s+SET\b)/gi,
    /(\bDELETE\s+FROM\b)/gi,
  ];

  return sqlPatterns.some((pattern) => pattern.test(content));
};

/**
 * Check for potential NoSQL injection patterns
 */
export const containsNoSqlInjection = (content: string): boolean => {
  const nosqlPatterns = [
    /\$where/gi,
    /\$ne/gi,
    /\$gt/gi,
    /\$lt/gi,
    /\$gte/gi,
    /\$lte/gi,
    /\$in/gi,
    /\$nin/gi,
    /\$exists/gi,
    /\$regex/gi,
    /\$or/gi,
    /\$and/gi,
    /\$not/gi,
    /\$nor/gi,
    /\$all/gi,
    /\$elemMatch/gi,
    /\$size/gi,
    /\$type/gi,
    /\$mod/gi,
    /\$text/gi,
    /\$geoWithin/gi,
    /\$geoIntersects/gi,
    /\$near/gi,
    /\$nearSphere/gi,
    /\$center/gi,
    /\$centerSphere/gi,
    /\$box/gi,
    /\$polygon/gi,
    /\$geometry/gi,
    /\$maxDistance/gi,
    /\$minDistance/gi,
    /\$slice/gi,
    /\$comment/gi,
    /\$explain/gi,
    /\$hint/gi,
    /\$maxScan/gi,
    /\$maxTimeMS/gi,
    /\$orderby/gi,
    /\$returnKey/gi,
    /\$showDiskLoc/gi,
    /\$natural/gi,
  ];

  return nosqlPatterns.some((pattern) => pattern.test(content));
};

/**
 * Comprehensive content validation for comments
 */
export const validateCommentContent = (
  content: string,
): {
  isValid: boolean;
  sanitizedContent: string;
  warnings: string[];
} => {
  const warnings: string[] = [];
  let sanitizedContent = sanitizeCommentContent(content);

  // Check for SQL injection
  if (containsSqlInjection(content)) {
    warnings.push("Content contains potential SQL injection patterns");
  }

  // Check for NoSQL injection
  if (containsNoSqlInjection(content)) {
    warnings.push("Content contains potential NoSQL injection patterns");
  }

  // Check for excessive length
  if (sanitizedContent.length > 2000) {
    warnings.push("Content exceeds maximum length");
    sanitizedContent = sanitizedContent.substring(0, 2000);
  }

  // Check for empty content after sanitization
  if (sanitizedContent.trim().length === 0) {
    return {
      isValid: false,
      sanitizedContent: "",
      warnings: ["Content is empty after sanitization"],
    };
  }

  return {
    isValid: true,
    sanitizedContent,
    warnings,
  };
};

/**
 * Sanitize user input for search queries
 */
export const sanitizeSearchQuery = (query: string): string => {
  return query
    .trim()
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .replace(/script/gi, "")
    .replace(/iframe/gi, "")
    .replace(/object/gi, "")
    .replace(/embed/gi, "")
    .replace(/[^\w\s\-\.]/g, "") // Keep only alphanumeric, spaces, hyphens, and dots
    .substring(0, 100); // Limit length
};
