import nodemailer from "nodemailer";
import { config } from "../config";

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.user,
    pass: config.email.password,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    await transporter.sendMail({
      from: config.email.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
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
