import nodemailer from "nodemailer";
import { config } from "../config/main.config";

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
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  let lastError: any;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Verify connection before sending
      if (attempt === 1) {
        await transporter.verify();
      }

      const result = await transporter.sendMail({
        from: config.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
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
    <div>
      <h1>Welcome to Boundless!</h1>
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    </div>
  `;

  await sendEmail({ to: email, subject, text, html });
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
) => {
  const subject = "Password Reset";
  const text = `Your password reset code is: ${resetToken}`;
  const html = `
    <div>
      <h1>Password Reset Request</h1>
      <p>Your password reset code is: <strong>${resetToken}</strong></p>
      <p>This code will expire in 1 hour.</p>
    </div>
  `;

  await sendEmail({ to: email, subject, text, html });
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
