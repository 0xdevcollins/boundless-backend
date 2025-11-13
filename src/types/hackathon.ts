export interface Participant {
  id: string | number;
  name: string;
  username: string;
  avatar: string;
  verified?: boolean;
  joinedDate?: string;
  role?: string;
  description?: string;
  categories?: string[];
  projects?: number;
  followers?: number;
  following?: number;
  hasSubmitted?: boolean;
}

export interface SubmissionCardProps {
  title: string;
  description: string;
  submitterName: string;
  submitterAvatar?: string;
  category?: string;
  categories?: string[];
  status?: "Pending" | "Approved" | "Rejected";
  upvotes?: number;
  votes?: { current: number; total: number };
  comments?: number;
  submittedDate?: string;
  daysLeft?: number;
  score?: number;
  image?: string;
  onViewClick?: () => void;
  onUpvoteClick?: () => void;
  onCommentClick?: () => void;
  hasUserUpvoted?: boolean;
}

export interface Hackathon {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  status: "upcoming" | "ongoing" | "ended";
  participants: number;
  totalPrizePool: string;
  deadline: string;
  categories: string[];
  startDate: string;
  endDate: string;
  organizer: string;
  featured?: boolean;
  resources?: string[];
}

export interface HackathonListResponse {
  hackathons: Hackathon[];
  hasMore: boolean;
  total: number;
  currentPage: number;
  totalPages: number;
}

export interface ParticipantListResponse {
  participants: Participant[];
  hasMore: boolean;
  total: number;
  currentPage: number;
  totalPages: number;
}

export interface SubmissionListResponse {
  submissions: SubmissionCardProps[];
  hasMore: boolean;
  total: number;
  currentPage: number;
  totalPages: number;
}
