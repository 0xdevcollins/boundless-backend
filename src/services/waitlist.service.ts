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
      // Check if email already exists
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

          // Send welcome email for reactivated user
          await this.sendWelcomeEmail(existingSubscriber);
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

      // Send welcome email immediately
      await this.sendWelcomeEmail(waitlistEntry);

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
        <title>Welcome to Boundless!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .highlight { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .unsubscribe { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Boundless!</h1>
            <p>You're officially on our exclusive waitlist</p>
          </div>
          <div class="content">
            <h2>Hi ${subscriber.firstName || "there"}!</h2>
            <p>🎊 <strong>Congratulations!</strong> You've successfully confirmed your subscription to the Boundless waitlist.</p>
            
            <div class="highlight">
              <h3>🎯 Your Position: #${await this.getSubscriberPosition(subscriber._id)}</h3>
              <p>You're among the first to join our exclusive community!</p>
            </div>
            
            <p><strong>What to expect:</strong></p>
            <ul>
              <li>📧 Regular updates about our development progress</li>
              <li>🔔 Early access notifications when we launch</li>
              <li>💎 Exclusive insights and behind-the-scenes content</li>
              <li>🎁 Special bonuses for early supporters</li>
              <li>🤝 Invitations to beta testing and feedback sessions</li>
            </ul>
            
            <p><strong>Stay connected:</strong></p>
            <ul>
              <li>📱 Follow us on social media for real-time updates</li>
              <li>💬 Join our community discussions</li>
              <li>📚 Check out our blog for detailed insights</li>
            </ul>
            
            <p>We're working hard to bring you something amazing. Thank you for being part of this journey!</p>
            
            <p>Best regards,<br>The Boundless Team</p>
            
            <div class="unsubscribe">
              <p><small>If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}">unsubscribe here</a>.</small></p>
            </div>
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
      Welcome to Boundless!
      
      Hi ${subscriber.firstName || "there"}!
      
      🎊 Congratulations! You've successfully confirmed your subscription to the Boundless waitlist.
      
      Your Position: #${await this.getSubscriberPosition(subscriber._id)}
      You're among the first to join our exclusive community!
      
      What to expect:
      📧 Regular updates about our development progress
      🔔 Early access notifications when we launch
      💎 Exclusive insights and behind-the-scenes content
      🎁 Special bonuses for early supporters
      🤝 Invitations to beta testing and feedback sessions
      
      Stay connected:
      📱 Follow us on social media for real-time updates
      💬 Join our community discussions
      📚 Check out our blog for detailed insights
      
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
    const resubscribeUrl = `${config.frontendUrl}/waitlist/subscribe`;

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
