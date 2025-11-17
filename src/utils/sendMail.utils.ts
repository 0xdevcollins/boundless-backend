import nodemailer from "nodemailer";
import { config } from "../config/main.config.js";
import { NotificationType } from "../models/notification.model.js";

interface EmailTemplate {
  type: NotificationType;
  subject: string;
  template: string;
}

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: true, // true for port 465, false for 587
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

export default async function sendMail({
  from = "info@boundlessfi.xyz",
  to,
  subject,
  html,
}: {
  from?: string;
  to: string;
  subject: string;
  html: string;
}) {
  const mailOptions = {
    from,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

function generateNotificationHtml({
  name,
  title,
  message,
  subject,
}: {
  name: string;
  title: string;
  message: string;
  subject: string;
}) {
  const year = new Date().getFullYear();

  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .container {
              max-width: 600px;
              margin: auto;
              padding: 20px;
              border: 1px solid #ddd;
              border-radius: 10px;
            }
            .header {
              background-color: #f4f4f4;
              padding: 10px;
              text-align: center;
              font-size: 24px;
              font-weight: bold;
            }
            .content {
              margin-top: 20px;
              font-size: 16px;
            }
            .footer {
              margin-top: 30px;
              font-size: 12px;
              color: #888;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">${title}</div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>${message}</p>
            </div>
            <div class="footer">© ${year} Your Company</div>
          </div>
        </body>
      </html>
    `.trim();
}
