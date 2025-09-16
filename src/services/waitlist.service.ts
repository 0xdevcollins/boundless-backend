import crypto from "crypto";
import mongoose from "mongoose";
import Waitlist, { IWaitlist, WaitlistStatus } from "../models/waitlist.model";
import { sendEmail } from "../utils/email.utils";
import { config } from "../config";

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
    const subject = "Welcome to Boundless! 🚀";
    const unsubscribeUrl = `${config.frontendUrl}/waitlist/unsubscribe/${subscriber.unsubscribeToken}`;

    const html = `
      <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Boundless</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      color: #374151; 
      margin: 0; 
      padding: 0;
      background-color: #f9fafb;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: white;
    }
    .logo-container {
      background: white;
      padding: 32px 40px 24px;
      text-align: center;
      border-bottom: 1px solid #e5e7eb;
    }
    .logo {
      display: inline-block;
      padding: 12px 20px;
      background: #f3f4f6;
      border-radius: 8px;
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      text-decoration: none;
      border: 1px solid #e5e7eb;
    }
    .content { 
      padding: 40px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 24px;
      color: #1f2937;
    }
    .position-card {
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .position-number {
      font-size: 28px;
      font-weight: 700;
      color: #0ea5e9;
      margin-bottom: 4px;
    }
    .social-links {
      margin: 32px 0;
      text-align: center;
    }
    .social-links a {
      display: inline-block;
      margin: 0 12px;
      padding: 8px 16px;
      background: #f3f4f6;
      color: #374151;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      border: 1px solid #d1d5db;
    }
    .social-links a:hover {
      background: #e5e7eb;
    }
    .footer { 
      background: #f9fafb;
      padding: 24px 40px;
      text-align: center; 
      color: #6b7280; 
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .unsubscribe {
      margin-top: 16px;
      font-size: 12px;
    }
    .unsubscribe a {
      color: #6b7280;
    }
    
    /* Dark mode support for logo container */
    @media (prefers-color-scheme: dark) {
      .logo-container {
        background: #1f2937;
        border-bottom-color: #374151;
      }
      .logo {
        background: #374151;
        color: #f9fafb;
        border-color: #4b5563;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Added proper logo container with dark/light mode support -->
    <div class="logo-container">
      <img src="https://i.ibb.co/5hhhZ7KZ/loa.png" class="logo" />
    </div>
    
    <div class="content">
      <!-- Simplified greeting and removed excessive emojis -->
      <div class="greeting">
        Hi ${subscriber.firstName || "there"},
      </div>
      
      <p>Welcome to Boundless. You've successfully joined our waitlist and we're excited to have you on board.</p>
      
      <!-- Cleaner position display -->
      <div class="position-card">
        <div class="position-number">#${await this.getSubscriberPosition(subscriber._id)}</div>
        <p style="margin: 0; color: #374151;">Your position on the waitlist</p>
      </div>
      
      <!-- Simplified and more professional copy -->
      <p><strong>What's next:</strong></p>
      <p>We'll keep you updated on our progress and notify you when we're ready to launch. You'll be among the first to get access.</p>
      
      <!-- Added social media links as requested -->
      <div class="social-links">
        <a href="https://x.com/boundless_fi" target="_blank">Follow on X</a>
        <a href="https://www.linkedin.com/company/boundlesshq/" target="_blank">Connect on LinkedIn</a>
      </div>
      
      <p>Thank you for your interest in Boundless.</p>
      
      <p style="margin-bottom: 0;">
        Best regards,<br>
        The Boundless Team
      </p>
    </div>
    
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Boundless. All rights reserved.</p>
      <p>This email was sent to ${subscriber.email}</p>
      
      <div class="unsubscribe">
        <p><a href="${unsubscribeUrl}">Unsubscribe</a> from these emails</p>
      </div>
    </div>
  </div>
</body>
</html>

    `;

    const text = `
      Welcome to Boundless!
      
      Hi ${subscriber.firstName || "there"}!
      
      🎊 Congratulations! You've successfully confirmed your subscription to the Boundless waitlist.
      
      
      What to expect:
      Regular updates about our development progress
      Early access notifications when we launch
      Exclusive insights and behind-the-scenes content
      Invitations to beta testing and feedback sessions
      
      Stay connected:
      Follow us on social media for real-time updates
      Join our community discussions
      Check out our blog for detailed insights
      
      We're working hard to bring you something amazing. Thank you for being part of this journey!
      
      Best regards,
      The Boundless Team
      
      Unsubscribe: ${unsubscribeUrl}
      
      © ${new Date().getFullYear()} Boundless. All rights reserved.
    `;

    await sendEmail({
      to: subscriber.email,
      subject,
      text,
      html,
    });

    // Update email count
    subscriber.incrementEmailCount();
    await subscriber.save();
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
