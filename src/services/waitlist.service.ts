import crypto from "crypto";
import mongoose from "mongoose";
import Waitlist, { IWaitlist, WaitlistStatus } from "../models/waitlist.model";
import { sendEmail } from "../utils/email.utils";
import { config } from "../config";
import {
  loadEmailTemplate,
  getWaitlistTemplatePath,
  generatePlainTextFromTemplate,
  EmailTemplateVariables,
} from "../utils/emailTemplate.utils";

export interface CreateWaitlistData {
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  referrer?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    [key: string]: any;
  };
  tags?: string[];
}

export interface WaitlistStats {
  total: number;
  pending: number;
  confirmed: number;
  unsubscribed: number;
  bounced: number;
  spam: number;
  active: number;
  growthRate: number; // percentage growth in last 30 days
}

export class WaitlistService {
  /**
   * Add a new email to the waitlist
   */
  static async subscribe(
    data: CreateWaitlistData,
    req?: any,
  ): Promise<IWaitlist> {
    try {
      const existingSubscriber = await Waitlist.findOne({
        email: data.email.toLowerCase(),
      });

      if (existingSubscriber) {
        // If already unsubscribed, reactivate
        if (existingSubscriber.status === WaitlistStatus.UNSUBSCRIBED) {
          existingSubscriber.status = WaitlistStatus.ACTIVE;
          existingSubscriber.isActive = true;
          existingSubscriber.unsubscribedAt = undefined;
          existingSubscriber.metadata = {
            ...existingSubscriber.metadata,
            ...data.metadata,
          };
          await existingSubscriber.save();

          // Send welcome email for reactivated user (but don't fail if email fails)
          try {
            await this.sendWelcomeEmail(existingSubscriber);
          } catch (emailError) {
            console.error(
              "Failed to send welcome email for reactivated user:",
              {
                email: existingSubscriber.email,
                error:
                  emailError instanceof Error
                    ? emailError.message
                    : String(emailError),
                timestamp: new Date().toISOString(),
              },
            );
          }
          return existingSubscriber;
        }

        // If already active, return existing
        if (existingSubscriber.isActive) {
          throw new Error("Email already subscribed to waitlist");
        }
      }

      // Generate unsubscribe token
      const unsubscribeToken = crypto.randomBytes(32).toString("hex");

      // Create new waitlist entry
      const waitlistEntry = new Waitlist({
        ...data,
        email: data.email.toLowerCase(),
        status: WaitlistStatus.ACTIVE,
        unsubscribeToken,
        metadata: {
          ...data.metadata,
          ipAddress: req?.ip || req?.connection?.remoteAddress,
          userAgent: req?.headers?.["user-agent"],
        },
      });

      await waitlistEntry.save();

      // Send welcome email immediately (but don't fail if email fails)
      try {
        await this.sendWelcomeEmail(waitlistEntry);
      } catch (emailError) {
        console.error("Failed to send welcome email for new subscriber:", {
          email: waitlistEntry.email,
          error:
            emailError instanceof Error
              ? emailError.message
              : String(emailError),
          timestamp: new Date().toISOString(),
        });
        // Don't fail the subscription if email fails - the user is still subscribed
      }

      return waitlistEntry;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Unsubscribe from waitlist
   */
  static async unsubscribe(token: string): Promise<IWaitlist> {
    try {
      const subscriber = await Waitlist.findOne({ unsubscribeToken: token });

      if (!subscriber) {
        throw new Error("Invalid unsubscribe token");
      }

      if (subscriber.status === WaitlistStatus.UNSUBSCRIBED) {
        throw new Error("Already unsubscribed");
      }

      subscriber.unsubscribe();
      await subscriber.save();

      // Send unsubscribe confirmation email
      await this.sendUnsubscribeEmail(subscriber);

      return subscriber;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send welcome email after confirmation
   */
  static async sendWelcomeEmail(subscriber: IWaitlist): Promise<void> {
    const subject = "You're on the Waitlist! 🎉";
    const unsubscribeUrl = `${config.frontendUrl}/waitlist/unsubscribe/${subscriber.unsubscribeToken}`;
    const viewInBrowserUrl = `${config.frontendUrl}/waitlist/email/view/${subscriber.unsubscribeToken}`;
    const ctaUrl = `${config.frontendUrl}/announcement`;

    // Prepare template variables
    const templateVariables: EmailTemplateVariables = {
      firstName: subscriber.firstName,
      lastName: subscriber.lastName,
      email: subscriber.email,
      companyName: "Boundless",
      companyAddress:
        "Boundless, Inc. | Building the future of transparent funding",
      ctaUrl,
      viewInBrowserUrl,
      unsubscribeUrl,
      privacyUrl: `${config.frontendUrl}/privacy`,
      termsUrl: `${config.frontendUrl}/terms`,
      twitterUrl: "https://x.com/boundless_fi",
      linkedinUrl: "https://www.linkedin.com/company/boundlesshq/",
      githubUrl: "https://github.com/boundlessproject",
      preheaderText: `Welcome to Boundless! You're position #${await this.getSubscriberPosition(subscriber._id)} on our waitlist.`,
    };

    try {
      // Load and process the email template
      const templatePath = getWaitlistTemplatePath();
      const html = loadEmailTemplate(templatePath, templateVariables);
      const text = generatePlainTextFromTemplate(templateVariables);

      await sendEmail({
        to: subscriber.email,
        subject,
        text,
        html,
      });

      // Update email count
      subscriber.incrementEmailCount();
      await subscriber.save();
    } catch (error) {
      console.error("Error sending welcome email with template:", error);

      // Fallback to simple email if template fails
      const fallbackHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Boundless</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>Welcome to Boundless! 🎉</h1>
            <p>Hi ${subscriber.firstName || "there"},</p>
            <p>Congratulations! You've secured a spot on the exclusive Boundless Waitlist.</p>
            <p>We're thrilled to have you join our mission to help builders validate ideas, access milestone-based funding, and grow with transparency powered by Stellar.</p>
            <p><a href="${ctaUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">See announcement</a></p>
            <p>You're receiving this email because you signed up for the Boundless waitlist.</p>
            <p><a href="${unsubscribeUrl}">Unsubscribe</a></p>
          </div>
        </body>
        </html>
      `;

      const fallbackText = `
        Welcome to Boundless!
        
        Hi ${subscriber.firstName || "there"},
        
        Congratulations! You've secured a spot on the exclusive Boundless Waitlist.
        
        We're thrilled to have you join our mission to help builders validate ideas, access milestone-based funding, and grow with transparency powered by Stellar.
        
        See announcement: ${ctaUrl}
        
        You're receiving this email because you signed up for the Boundless waitlist.
        
        Unsubscribe: ${unsubscribeUrl}
      `;

      await sendEmail({
        to: subscriber.email,
        subject,
        text: fallbackText,
        html: fallbackHtml,
      });

      // Update email count
      subscriber.incrementEmailCount();
      await subscriber.save();
    }
  }

  /**
   * Send unsubscribe confirmation email
   */
  static async sendUnsubscribeEmail(subscriber: IWaitlist): Promise<void> {
    const subject = "You've been unsubscribed from Boundless";
    const resubscribeUrl = `${config.frontendUrl}/waitlist`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribed from Boundless</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👋 Sorry to see you go</h1>
            <p>You've been unsubscribed from our waitlist</p>
          </div>
          <div class="content">
            <h2>Hi ${subscriber.firstName || "there"}!</h2>
            <p>We're sorry to see you leave the Boundless waitlist. You've been successfully unsubscribed and won't receive any more emails from us.</p>
            
            <p>If you change your mind, you can always resubscribe at any time:</p>
            
            <div style="text-align: center;">
              <a href="${resubscribeUrl}" class="btn">Resubscribe to Waitlist</a>
            </div>
            
            <p>Thank you for being part of our community, even if only briefly. We hope to see you again soon!</p>
            
            <p>Best regards,<br>The Boundless Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Boundless. All rights reserved.</p>
            <p>This email was sent to ${subscriber.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Unsubscribed from Boundless
      
      Hi ${subscriber.firstName || "there"}!
      
      We're sorry to see you leave the Boundless waitlist. You've been successfully unsubscribed and won't receive any more emails from us.
      
      If you change your mind, you can always resubscribe at any time by visiting:
      ${resubscribeUrl}
      
      Thank you for being part of our community, even if only briefly. We hope to see you again soon!
      
      Best regards,
      The Boundless Team
      
      © ${new Date().getFullYear()} Boundless. All rights reserved.
    `;

    await sendEmail({
      to: subscriber.email,
      subject,
      text,
      html,
    });
  }

  /**
   * Get subscriber position in waitlist
   */
  static async getSubscriberPosition(
    subscriberId: string | mongoose.Types.ObjectId,
  ): Promise<number> {
    const subscriber = await Waitlist.findById(subscriberId);
    if (!subscriber) return 0;

    const position = await Waitlist.countDocuments({
      subscribedAt: { $lt: subscriber.subscribedAt },
      status: WaitlistStatus.ACTIVE,
      isActive: true,
    });

    return position + 1;
  }

  /**
   * Get waitlist statistics
   */
  static async getStats(): Promise<WaitlistStats> {
    const [total, active, unsubscribed, bounced, spam] = await Promise.all([
      Waitlist.countDocuments(),
      Waitlist.countDocuments({ status: WaitlistStatus.ACTIVE }),
      Waitlist.countDocuments({ status: WaitlistStatus.UNSUBSCRIBED }),
      Waitlist.countDocuments({ status: WaitlistStatus.BOUNCED }),
      Waitlist.countDocuments({ status: WaitlistStatus.SPAM }),
    ]);

    // Calculate growth rate (last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [currentPeriod, previousPeriod] = await Promise.all([
      Waitlist.countDocuments({ subscribedAt: { $gte: thirtyDaysAgo } }),
      Waitlist.countDocuments({
        subscribedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }),
    ]);

    const growthRate =
      previousPeriod === 0
        ? 100
        : ((currentPeriod - previousPeriod) / previousPeriod) * 100;

    return {
      total,
      pending: 0, // No pending status anymore
      confirmed: active, // All active subscribers are confirmed
      unsubscribed,
      bounced,
      spam,
      active,
      growthRate: Math.round(growthRate * 100) / 100,
    };
  }

  /**
   * Get subscribers with pagination
   */
  static async getSubscribers(
    page: number = 1,
    limit: number = 20,
    status?: WaitlistStatus,
    tag?: string,
    search?: string,
  ): Promise<{
    subscribers: IWaitlist[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    let query: any = { isActive: true };

    if (status) {
      query.status = status;
    }

    if (tag) {
      query.tags = tag;
    }

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    const [subscribers, total] = await Promise.all([
      Waitlist.find(query).sort({ subscribedAt: -1 }).skip(skip).limit(limit),
      Waitlist.countDocuments(query),
    ]);

    return {
      subscribers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Add tags to subscriber
   */
  static async addTags(
    subscriberId: string,
    tags: string[],
  ): Promise<IWaitlist> {
    const subscriber = await Waitlist.findById(subscriberId);
    if (!subscriber) {
      throw new Error("Subscriber not found");
    }

    // Add new tags without duplicates
    const existingTags = new Set(subscriber.tags || []);
    tags.forEach((tag) => existingTags.add(tag));
    subscriber.tags = Array.from(existingTags);

    await subscriber.save();
    return subscriber;
  }

  /**
   * Remove tags from subscriber
   */
  static async removeTags(
    subscriberId: string,
    tags: string[],
  ): Promise<IWaitlist> {
    const subscriber = await Waitlist.findById(subscriberId);
    if (!subscriber) {
      throw new Error("Subscriber not found");
    }

    subscriber.tags = (subscriber.tags || []).filter(
      (tag) => !tags.includes(tag),
    );
    await subscriber.save();
    return subscriber;
  }

  /**
   * Mark email as bounced
   */
  static async markAsBounced(email: string): Promise<void> {
    const subscriber = await Waitlist.findOne({ email: email.toLowerCase() });
    if (subscriber) {
      subscriber.markAsBounced();
      await subscriber.save();
    }
  }

  /**
   * Mark email as spam
   */
  static async markAsSpam(email: string): Promise<void> {
    const subscriber = await Waitlist.findOne({ email: email.toLowerCase() });
    if (subscriber) {
      subscriber.markAsSpam();
      await subscriber.save();
    }
  }

  /**
   * Export subscribers for email campaigns
   */
  static async exportSubscribers(
    status?: WaitlistStatus,
    tags?: string[],
  ): Promise<IWaitlist[]> {
    let query: any = { isActive: true };

    if (status) {
      query.status = status;
    } else {
      query.status = WaitlistStatus.ACTIVE;
    }

    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    return await Waitlist.find(query)
      .select("email firstName lastName status subscribedAt tags")
      .sort({ subscribedAt: -1 });
  }
}

export default WaitlistService;
