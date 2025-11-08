import fs from "fs";
import path from "path";

export interface EmailTemplateVariables {
  // User data
  firstName?: string;
  lastName?: string;
  email: string;

  // Company data
  companyName: string;
  companyAddress: string;

  // URLs
  ctaUrl: string;
  viewInBrowserUrl: string;
  unsubscribeUrl: string;
  privacyUrl: string;
  termsUrl: string;

  // Social media URLs
  twitterUrl: string;
  linkedinUrl: string;
  githubUrl: string;

  // Optional
  preheaderText?: string;
}

/**
 * Load and process email template with variables
 */
export function loadEmailTemplate(
  templatePath: string,
  variables: EmailTemplateVariables,
): string {
  try {
    // Read the template file
    const templateContent = fs.readFileSync(templatePath, "utf8");

    // Replace template variables
    let processedTemplate = templateContent;

    // Replace all template variables
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const placeholder = `{{${key}}}`;
        processedTemplate = processedTemplate.replace(
          new RegExp(placeholder, "g"),
          String(value),
        );
      }
    });

    return processedTemplate;
  } catch (error) {
    console.error("Error loading email template:", error);
    throw new Error(`Failed to load email template: ${templatePath}`);
  }
}

/**
 * Get the path to the waitlist email template
 */
export function getWaitlistTemplatePath(): string {
  return path.join(
    __dirname,
    "..",
    "templates",
    "waitlist-email-template.html",
  );
}

/**
 * Generate plain text version from HTML template
 */
export function generatePlainTextFromTemplate(
  variables: EmailTemplateVariables,
): string {
  return `
Boundless - You're on the Waitlist!

Congratulations! You've secured a spot on the exclusive Boundless Waitlist.

We're thrilled to have you join our mission to help builders validate ideas, access milestone-based funding, and grow with transparency powered by Stellar.

See announcement: ${variables.ctaUrl}

You're receiving this email because you signed up for the Boundless waitlist. If this doesn't seem right, please feel free to disregard this message.

Follow us:
Twitter: ${variables.twitterUrl}
LinkedIn: ${variables.linkedinUrl}
GitHub: ${variables.githubUrl}

${variables.companyAddress}

Privacy Policy: ${variables.privacyUrl}
Terms of Service: ${variables.termsUrl}
Unsubscribe: ${variables.unsubscribeUrl}
  `.trim();
}
