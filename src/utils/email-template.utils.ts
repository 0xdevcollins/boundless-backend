import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface EmailTemplateData {
  emailTitle: string;
  emailSubtitle: string;
  emailDescription?: string;
  preheaderText: string;
  disclaimerText?: string;
  showOtpCode?: boolean;
  otpCode?: string;
  showCtaButton?: boolean;
  ctaUrl?: string;
  ctaButtonText?: string;
  showAdditionalInfo?: boolean;
  additionalInfo?: string;
  // Social links
  twitterUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  // Company info
  companyAddress?: string;
  privacyUrl?: string;
  termsUrl?: string;
  unsubscribeUrl?: string;
  // Reusable template fields
  headline?: string;
  bodyText1?: string;
  bodyText2?: string;
  bodyText3?: string;
  ctaText?: string;
}

export class EmailTemplateUtils {
  private static templateCache: Map<string, string> = new Map();

  /**
   * Load email template from file
   */
  private static loadTemplate(templateName: string): string {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      `${templateName}.html`,
    );

    try {
      const template = fs.readFileSync(templatePath, "utf-8");
      this.templateCache.set(templateName, template);
      return template;
    } catch (error) {
      console.error(`Failed to load email template: ${templateName}`, error);
      throw new Error(`Email template not found: ${templateName}`);
    }
  }

  /**
   * Simple template variable replacement
   */
  private static replaceVariables(
    template: string,
    data: EmailTemplateData,
  ): string {
    let result = template;

    // Replace all template variables
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const replacement = value !== undefined ? String(value) : "";
      result = result.replace(new RegExp(placeholder, "g"), replacement);
    });

    // Handle conditional sections
    result = this.processConditionalSections(result, data);

    return result;
  }

  /**
   * Process conditional sections in template
   */
  private static processConditionalSections(
    template: string,
    data: EmailTemplateData,
  ): string {
    let result = template;

    // Handle {{#if condition}}...{{/if}} blocks
    const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(ifRegex, (match, condition, content) => {
      const conditionValue = (data as any)[condition];
      return conditionValue ? content : "";
    });

    return result;
  }

  /**
   * Generate OTP verification email
   */
  static generateOtpEmail(otpCode: string, recipientName?: string): string {
    const template = this.loadTemplate("auth-email-template");

    const data: EmailTemplateData = {
      emailTitle: "🔐 Verify Your Email",
      emailSubtitle: `Hello${recipientName ? ` ${recipientName}` : ""}! Please verify your email address to complete your registration.`,
      emailDescription:
        "Enter the verification code below in the app to activate your account.",
      preheaderText: `Your verification code is ${otpCode}`,
      disclaimerText:
        "You're receiving this email because you signed up for a Boundless account. If you didn't create an account, please ignore this email.",
      showOtpCode: true,
      otpCode,
      showCtaButton: false,
      showAdditionalInfo: true,
      additionalInfo:
        "This code will expire in 10 minutes for security reasons. If you didn't request this code, please ignore this email.",
      twitterUrl: "https://twitter.com/boundlessfi",
      linkedinUrl: "https://linkedin.com/company/boundlessfi",
      githubUrl: "https://github.com/boundlessfi",
      companyAddress:
        "Boundless Platform, 123 Innovation Drive, Tech City, TC 12345",
      privacyUrl: "https://boundlessfi.xyz/privacy",
      termsUrl: "https://boundlessfi.xyz/terms",
      unsubscribeUrl: "https://boundlessfi.xyz/unsubscribe",
    };

    return this.replaceVariables(template, data);
  }

  /**
   * Generate welcome email
   */
  static generateWelcomeEmail(recipientName: string): string {
    const template = this.loadTemplate("auth-email-template");

    const data: EmailTemplateData = {
      emailTitle: "🎉 Welcome to Boundless!",
      emailSubtitle: `Welcome aboard, ${recipientName}! Your account has been successfully created and verified.`,
      emailDescription:
        "You're now ready to explore the world of transparent, milestone-based crowdfunding powered by Stellar.",
      preheaderText: `Welcome to Boundless, ${recipientName}! Your account is ready.`,
      disclaimerText:
        "You're receiving this email because you successfully created a Boundless account.",
      showOtpCode: false,
      showCtaButton: true,
      ctaUrl: "https://boundlessfi.xyz/dashboard",
      ctaButtonText: "Go to Dashboard",
      showAdditionalInfo: true,
      additionalInfo:
        "Get started by exploring existing projects, creating your first crowdfunding campaign, or connecting with the community.",
      twitterUrl: "https://twitter.com/boundlessfi",
      linkedinUrl: "https://linkedin.com/company/boundlessfi",
      githubUrl: "https://github.com/boundlessfi",
      companyAddress:
        "Boundless Platform, 123 Innovation Drive, Tech City, TC 12345",
      privacyUrl: "https://boundlessfi.xyz/privacy",
      termsUrl: "https://boundlessfi.xyz/terms",
      unsubscribeUrl: "https://boundlessfi.xyz/unsubscribe",
    };

    return this.replaceVariables(template, data);
  }

  /**
   * Generate password reset email
   */
  static generatePasswordResetEmail(
    resetToken: string,
    recipientName?: string,
  ): string {
    const template = this.loadTemplate("auth-email-template");

    const data: EmailTemplateData = {
      emailTitle: "🔑 Reset Your Password",
      emailSubtitle: `Hello${recipientName ? ` ${recipientName}` : ""}! You requested a password reset for your Boundless account.`,
      emailDescription:
        "Click the button below to reset your password. This link will expire in 1 hour for security reasons.",
      preheaderText: "Reset your Boundless password",
      disclaimerText:
        "You're receiving this email because you requested a password reset. If you didn't request this, please ignore this email.",
      showOtpCode: false,
      showCtaButton: true,
      ctaUrl: `https://boundlessfi.xyz/reset-password?token=${resetToken}`,
      ctaButtonText: "Reset Password",
      showAdditionalInfo: true,
      additionalInfo:
        "If you didn't request this password reset, please ignore this email. Your account remains secure.",
      twitterUrl: "https://twitter.com/boundlessfi",
      linkedinUrl: "https://linkedin.com/company/boundlessfi",
      githubUrl: "https://github.com/boundlessfi",
      companyAddress:
        "Boundless Platform, 123 Innovation Drive, Tech City, TC 12345",
      privacyUrl: "https://boundlessfi.xyz/privacy",
      termsUrl: "https://boundlessfi.xyz/terms",
      unsubscribeUrl: "https://boundlessfi.xyz/unsubscribe",
    };

    return this.replaceVariables(template, data);
  }

  /**
   * Generate email verification email (alternative to OTP)
   */
  static generateEmailVerificationEmail(
    verificationToken: string,
    recipientName?: string,
  ): string {
    const template = this.loadTemplate("auth-email-template");

    const data: EmailTemplateData = {
      emailTitle: "📧 Verify Your Email Address",
      emailSubtitle: `Hello${recipientName ? ` ${recipientName}` : ""}! Please verify your email address to complete your registration.`,
      emailDescription:
        "Click the button below to verify your email address and activate your account.",
      preheaderText: "Verify your Boundless email address",
      disclaimerText:
        "You're receiving this email because you signed up for a Boundless account. If you didn't create an account, please ignore this email.",
      showOtpCode: false,
      showCtaButton: true,
      ctaUrl: `https://boundlessfi.xyz/verify-email?token=${verificationToken}`,
      ctaButtonText: "Verify Email",
      showAdditionalInfo: true,
      additionalInfo:
        "This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.",
      twitterUrl: "https://twitter.com/boundlessfi",
      linkedinUrl: "https://linkedin.com/company/boundlessfi",
      githubUrl: "https://github.com/boundlessfi",
      companyAddress:
        "Boundless Platform, 123 Innovation Drive, Tech City, TC 12345",
      privacyUrl: "https://boundlessfi.xyz/privacy",
      termsUrl: "https://boundlessfi.xyz/terms",
      unsubscribeUrl: "https://boundlessfi.xyz/unsubscribe",
    };

    return this.replaceVariables(template, data);
  }

  /**
   * Generate email using the reusable index.html template
   */
  static generateEmail(data: {
    emailTitle: string;
    preheaderText: string;
    headline: string;
    bodyText1?: string;
    bodyText2?: string;
    bodyText3?: string;
    ctaUrl?: string;
    ctaText?: string;
    disclaimerText?: string;
    privacyUrl?: string;
    termsUrl?: string;
    unsubscribeUrl?: string;
  }): string {
    const template = this.loadTemplate("index");

    const templateData: EmailTemplateData = {
      emailTitle: data.emailTitle,
      emailSubtitle: "", // Not used in index template
      preheaderText: data.preheaderText,
      disclaimerText: data.disclaimerText || "",
      headline: data.headline,
      bodyText1: data.bodyText1 || "",
      bodyText2: data.bodyText2 || "",
      bodyText3: data.bodyText3 || "",
      ctaUrl: data.ctaUrl || "",
      ctaText: data.ctaText || "",
      privacyUrl: data.privacyUrl || "https://boundlessfi.xyz/privacy",
      termsUrl: data.termsUrl || "https://boundlessfi.xyz/terms",
      unsubscribeUrl: data.unsubscribeUrl || "",
    };

    return this.replaceVariables(template, templateData);
  }

  /**
   * Clear template cache (useful for development)
   */
  static clearCache(): void {
    this.templateCache.clear();
  }
}

export default EmailTemplateUtils;
