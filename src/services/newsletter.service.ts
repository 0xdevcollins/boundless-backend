import NewsletterSubscriber from "../models/newsletter.model";

export interface CreateNewsletterData {
  email: string;
  name?: string;
  source?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
}

class NewsletterService {
  static async subscribe(data: CreateNewsletterData) {
    try {
      const existing = await NewsletterSubscriber.findOne({
        email: data.email,
      });
      if (existing) {
        throw new Error("Email already subscribed");
      }

      const subscriber = new NewsletterSubscriber(data);
      const savedSubscriber = await subscriber.save();

      return savedSubscriber;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error("Email already subscribed");
      }

      if (error.message === "Email already subscribed") {
        throw error;
      }
      throw new Error("Failed to subscribe to newsletter");
    }
  }

  static async getSubscriberByEmail(email: string) {
    try {
      return await NewsletterSubscriber.findOne({ email: email.toLowerCase() });
    } catch {
      throw new Error("Failed to retrieve subscriber");
    }
  }
}

export default NewsletterService;
