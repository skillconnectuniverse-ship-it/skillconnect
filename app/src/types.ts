export type PlanKey = 'hourly' | 'daily' | 'monthly' | 'yearly';
export type StatusKey = 'available' | 'unavailable' | 'dnd' | 'brb' | 'away' | 'offline';

export interface Skill {
  _id?: string;
  name: string;
  category: string;
  description: string;
  experienceYears: number;
  currency: string;
  rates: Partial<Record<PlanKey, number>>;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  city: string;
  country: string;
  skills: Skill[];
  status: StatusKey;
  statusNote: string;
  ratingAvg: number;
  ratingCount: number;
  completedJobs: number;
  createdAt: string;
  coords: { lat: number; lng: number } | null;
  distanceKm?: number | null;
  clientRatingAvg: number;
  clientRatingCount: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  kycVerified: boolean;
  role?: 'user' | 'admin';
  kyc?: { status: KycStatus; legalName: string; rejectReason: string };
  payoutMethod?: { kind: 'bank' | 'upi'; holderName: string; label: string } | null;
  email?: string;
  phone?: string;
}

export interface Post {
  id: string;
  images: string[];
  caption: string;
  skillTag: string;
  likeCount: number;
  liked: boolean;
  createdAt: string;
  author: { id: string; name: string; avatar: string; city: string; status: StatusKey };
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  skillName: string;
  createdAt: string;
  client: { id: string; name: string; avatar: string } | null;
}

export type BookingStatus = 'pending_payment' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface BookingParty {
  id: string;
  name: string;
  avatar: string;
  city: string;
  ratingAvg: number;
  ratingCount: number;
  clientRatingAvg?: number;
  clientRatingCount?: number;
  phone?: string;
}

export interface Booking {
  id: string;
  role: 'client' | 'provider';
  client: BookingParty;
  provider: BookingParty;
  skill: { skillId: string; name: string; category: string };
  plan: PlanKey;
  quantity: number;
  currency: string;
  unitPriceMinor: number;
  amountMinor: number;
  platformFeeMinor: number;
  providerEarningMinor: number;
  scheduledFor: string;
  notes: string;
  address: string;
  coords: { lat: number; lng: number } | null;
  status: BookingStatus;
  startedAt?: string;
  endedAt?: string;
  cancelReason?: string;
  reviewed: boolean;
  clientReviewed: boolean;
  disputeOpen: boolean;
  providerLocation?: { lat: number; lng: number; updatedAt: string };
  createdAt: string;
  startOtp?: string;
  endOtp?: string;
}

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  user: { id: string; name: string; avatar: string; status: StatusKey };
  lastMessage: ChatMessage;
  unread: number;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: { bookingId?: string; userId?: string };
  read: boolean;
  createdAt: string;
}

export interface Gateway {
  id: 'razorpay' | 'stripe' | 'demo';
  label: string;
}

export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface WalletData {
  balances: { currency: string; availableMinor: number; pendingMinor: number }[];
  minPayoutMinor: number;
  holdHours: number;
  kyc: { status: KycStatus; legalName: string; idType: string; idLast4: string; rejectReason: string };
  payoutMethod: { kind: 'bank' | 'upi'; holderName: string; label: string } | null;
  entries: { id: string; kind: string; amountMinor: number; currency: string; note: string; availableAt: string; held: boolean; createdAt: string; bookingId?: string }[];
  payouts: { id: string; amountMinor: number; currency: string; method: string; destinationLabel: string; status: 'requested' | 'paid' | 'rejected'; txnRef: string; adminNote: string; createdAt: string }[];
}

export interface Complaint {
  id: string;
  type: 'dispute' | 'report';
  category: string;
  description: string;
  status: 'open' | 'resolved' | 'dismissed';
  bookingId?: string;
  raisedBy: { id: string; name?: string };
  against: { id: string; name?: string };
  messages: { id: string; from: string; isAdmin: boolean; text: string; createdAt: string }[];
  resolution: { action: string; refundMinor: number; note?: string; at: string } | null;
  createdAt: string;
}
