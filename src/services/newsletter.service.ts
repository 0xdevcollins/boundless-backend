import NewsletterSubscriber from "../models/newsletter.model";

export interface CreateNewsletterData {
  email: string;
  source?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
}

class NewsletterService {
  static async subscribe(data: CreateNewsletterData) {
    const existing = await NewsletterSubscriber.findOne({ email: data.email });
    if (existing) {
      throw new Error("Email already subscribed");
    }

    const subscriber = new NewsletterSubscriber(data);
    return subscriber.save();
  }
}

export default NewsletterService;
