import nodemailer from "nodemailer";
import { config } from "../config/main.config";
import { randomBytes } from "crypto";

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465, // Port 465 requires SSL, port 587 uses STARTTLS
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
  // Add connection pooling and timeout settings
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 20000,
  rateLimit: 5,
  // Connection timeout settings
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000, // 30 seconds
  socketTimeout: 60000, // 60 seconds
  // Keep connection alive
  keepAlive: true,
  // TLS settings for better security
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates if needed
    ciphers: "SSLv3",
  },
} as any);

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  priority?: "high" | "normal" | "low";
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  listUnsubscribe?: string;
  customHeaders?: Record<string, string>;
}

/**
 * Generate a unique Message-ID following RFC 5322 format
 * Format: <unique-id@domain>
 */
const generateMessageId = (): string => {
  const timestamp = Date.now();
  const random = randomBytes(8).toString("hex");
  const domain = config.EMAIL_FROM.split("@")[1] || "boundlessfi.xyz";
  return `<${timestamp}.${random}@${domain}>`;
};

/**
 * Build comprehensive email headers for better deliverability and security
 */
const buildEmailHeaders = (
  options: EmailOptions,
  messageId: string,
): Record<string, string> => {
  const headers: Record<string, string> = {
    // Standard headers
    "Message-ID": messageId,
    Date: new Date().toUTCString(),
    "MIME-Version": "1.0",

    // Security and authentication headers
    "X-Mailer": "Boundless Platform v1.0",
    "X-Priority": getPriorityValue(options.priority || "normal"),
    "X-MSMail-Priority": getPriorityValue(options.priority || "normal"),
    Importance:
      options.priority === "high"
        ? "high"
        : options.priority === "low"
          ? "low"
          : "normal",

    // Anti-spam headers
    "X-Auto-Response-Suppress": "All",
    Precedence: "bulk",
    "X-Entity-Ref-ID": randomBytes(16).toString("hex"),

    // List management headers
    "List-Unsubscribe":
      options.listUnsubscribe ||
      `<mailto:unsubscribe@${config.EMAIL_FROM.split("@")[1] || "boundlessfi.xyz"}>, <https://boundlessfi.xyz/unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",

    // Threading headers
    ...(options.inReplyTo && { "In-Reply-To": options.inReplyTo }),
    ...(options.references && { References: options.references }),

    // Custom application headers
    "X-Boundless-Version": "1.0",
    "X-Application": "Boundless Platform",
    "X-Sent-At": new Date().toISOString(),
  };

  // Add custom headers if provided
  if (options.customHeaders) {
    Object.assign(headers, options.customHeaders);
  }

  return headers;
};

/**
 * Convert priority string to numeric value for X-Priority header
 */
const getPriorityValue = (priority: string): string => {
  switch (priority) {
    case "high":
      return "1 (Highest)";
    case "low":
      return "5 (Lowest)";
    default:
      return "3 (Normal)";
  }
};

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  let lastError: any;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Verify connection before sending
      if (attempt === 1) {
        await transporter.verify();
      }

      // Generate unique Message-ID if not provided
      const messageId = options.messageId || generateMessageId();

      // Build comprehensive headers
      const headers = buildEmailHeaders(options, messageId);

      const result = await transporter.sendMail({
        from: `"Boundless Team" <${config.EMAIL_FROM}>`,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        subject: options.subject,
        text: options.text,
        html: options.html,
        messageId,
        headers,
        priority: options.priority || "normal",
      });

      console.log(
        `Email sent successfully to ${options.to}. Message ID: ${result.messageId}`,
      );
      return; // Success, exit the retry loop
    } catch (error: any) {
      lastError = error;
      console.error(`Email send attempt ${attempt} failed:`, {
        error: error.message,
        code: error.code,
        response: error.response,
        to: options.to,
        subject: options.subject,
      });

      // If this is not the last attempt, wait before retrying
      if (attempt < 3) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s
        console.log(`Retrying email send in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // If all attempts failed, log the final error and re-throw
  console.error("All email send attempts failed:", {
    to: options.to,
    subject: options.subject,
    finalError: lastError?.message,
    errorCode: lastError?.code,
  });

  throw new Error(
    `Failed to send email after 3 attempts: ${lastError?.message}`,
  );
};

export const sendVerificationEmail = async (email: string, otp: string) => {
  const subject = "Verify your email";
  const text = `Your verification code is: ${otp}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Welcome to Boundless!</h1>
      <p>Your verification code is: <strong style="font-size: 18px; color: #007bff;">${otp}</strong></p>
      <p style="color: #666;">This code will expire in 10 minutes.</p>
      <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
    priority: "high",
    customHeaders: {
      "X-Email-Type": "verification",
      "X-OTP-Code": otp,
    },
  });
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
) => {
  const subject = "Password Reset Request";
  const text = `Your password reset code is: ${resetToken}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Password Reset Request</h1>
      <p>You requested a password reset for your Boundless account.</p>
      <p>Your password reset code is: <strong style="font-size: 18px; color: #dc3545;">${resetToken}</strong></p>
      <p style="color: #666;">This code will expire in 1 hour.</p>
      <p style="color: #666; font-size: 12px;">If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
    priority: "high",
    customHeaders: {
      "X-Email-Type": "password-reset",
      "X-Reset-Token": resetToken,
    },
  });
};

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (email: string, name?: string) => {
  const subject = "Welcome to Boundless!";
  const text = `Welcome to Boundless! We're excited to have you on board.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Welcome to Boundless${name ? `, ${name}` : ""}!</h1>
      <p>We're excited to have you on board. Your account has been successfully created.</p>
      <p>Get started by exploring our platform and connecting with the community.</p>
      <p style="color: #666; font-size: 12px;">If you have any questions, feel free to reach out to our support team.</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
    priority: "normal",
    customHeaders: {
      "X-Email-Type": "welcome",
    },
  });
};

/**
 * Send notification email
 */
export const sendNotificationEmail = async (
  email: string,
  title: string,
  message: string,
  priority: "high" | "normal" | "low" = "normal",
) => {
  const subject = `Boundless Notification: ${title}`;
  const text = message;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${title}</h2>
      <p>${message}</p>
      <p style="color: #666; font-size: 12px;">This is an automated notification from Boundless.</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
    priority,
    customHeaders: {
      "X-Email-Type": "notification",
      "X-Notification-Title": title,
    },
  });
};

/**
 * Send newsletter email
 */
export const sendNewsletterEmail = async (
  email: string,
  subject: string,
  content: string,
  unsubscribeUrl?: string,
) => {
  const text = content;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
        ${content}
      </div>
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
        <p style="color: #666; font-size: 12px;">
          You received this email because you subscribed to our newsletter.
          <a href="${unsubscribeUrl || "https://boundlessfi.xyz/unsubscribe"}" style="color: #007bff;">Unsubscribe</a>
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
    priority: "low",
    listUnsubscribe: unsubscribeUrl || "https://boundlessfi.xyz/unsubscribe",
    customHeaders: {
      "X-Email-Type": "newsletter",
    },
  });
};

// Graceful shutdown function to close the transporter
export const closeEmailTransporter = async (): Promise<void> => {
  try {
    await transporter.close();
    console.log("Email transporter closed successfully");
  } catch (error) {
    console.error("Error closing email transporter:", error);
  }
};

// Handle process termination
process.on("SIGINT", async () => {
  console.log("Received SIGINT, closing email transporter...");
  await closeEmailTransporter();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, closing email transporter...");
  await closeEmailTransporter();
  process.exit(0);
});
