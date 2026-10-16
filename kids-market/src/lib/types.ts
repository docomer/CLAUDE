export type Role = "parent" | "kid";

export type Profile = {
  id: string;
  family_id: string;
  role: Role;
  full_name: string;
  nickname: string;
  avatar: string;
  is_admin: boolean;
  created_at: string;
};

export type Fair = {
  id: string;
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  organizer_id: string | null;
  invite_code: string;
};

export type ListingStatus = "pending" | "active" | "rejected" | "reserved" | "sold" | "withdrawn" | "removed";

export type Listing = {
  id: string;
  fair_id: string;
  family_id: string;
  seller_id: string;
  title: string;
  description: string;
  coolest: string;
  category: string;
  condition: string;
  price: number;
  photos: string[];
  status: ListingStatus;
  rejection_reason: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  buyer_family_id: string;
  seller_family_id: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  kind: "text" | "template" | "offer" | "system";
  body: string;
  amount: number | null;
  offer_status: "pending" | "accepted" | "declined" | "countered" | "expired" | null;
  filtered: boolean;
  created_at: string;
};

export type DealStatus = "awaiting_parent" | "approved" | "declined" | "completed" | "cancelled";

export type Deal = {
  id: string;
  conversation_id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_family_id: string;
  seller_family_id: string;
  price: number;
  status: DealStatus;
  buyer_confirmed: boolean;
  seller_confirmed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
};

export type ActionResult = { error?: string; ok?: string } | undefined;
