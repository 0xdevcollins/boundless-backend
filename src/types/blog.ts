export interface CreateBlogRequest {
  title: string;
  content: string;
  excerpt: string;
  coverImage?: string;
  category: string;
  tags?: string[];
  status?: "draft" | "published";
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    keywords?: string[];
  };
  authors: string[];
  scheduledAt?: Date;
  featured?: boolean;
  allowComments?: boolean;
}

export interface UpdateBlogRequest {
  title?: string;
  content?: string;
  excerpt?: string;
  coverImage?: string;
  category?: string;
  tags?: string[];
  status?: "draft" | "published" | "archived";
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    keywords?: string[];
  };
  authors?: string[];
  scheduledAt?: Date;
  featured?: boolean;
  allowComments?: boolean;
  revisionNote?: string;
}

export interface BlogListQuery {
  page?: number;
  limit?: number;
  status?: "draft" | "published" | "archived";
  category?: string;
  tag?: string;
  author?: string;
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "publishedAt" | "views" | "likes";
  sortOrder?: "asc" | "desc";
  featured?: boolean;
}

export interface DeleteBlogRequest {
  reason?: string;
  permanent?: boolean;
  redirectUrl?: string;
}

export interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  period?: "daily" | "weekly" | "monthly";
}

export interface BlogAnalytics {
  overview: {
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    publishedPosts: number;
    draftPosts: number;
    archivedPosts: number;
  };
  trends: {
    daily?: Array<{
      date: string;
      posts: number;
      views: number;
      likes: number;
      comments: number;
    }>;
    monthly?: Array<{
      month: string;
      posts: number;
      views: number;
      likes: number;
      comments: number;
    }>;
  };
  topPosts: Array<{
    id: string;
    title: string;
    views: number;
    likes: number;
    comments: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    postCount: number;
    totalViews: number;
    percentage: number;
  }>;
}

export interface PaginatedBlogResponse {
  blogs: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
