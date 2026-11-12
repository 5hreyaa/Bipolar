export type UserRole = "admin" | "member";

export type SnackCategory = "sweet" | "savoury" | "drink" | "healthy-ish";

export type SnackStatus = "stocked" | "running_low" | "gone";

export type ActivityAction = "consume" | "restock" | "create" | "update" | "delete";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Snack {
  id: number;
  name: string;
  brand: string | null;
  category: SnackCategory;
  quantity: number;
  low_stock_threshold: number;
  image_url: string | null;
  price: number | null;
  status: SnackStatus;
  vote_count: number;
  has_voted: boolean;
  created_at: string;
  updated_at: string;
}

export interface SnackListResponse {
  items: Snack[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SnackSummary {
  total_snacks: number;
  stocked_count: number;
  running_low_count: number;
  gone_count: number;
  total_units: number;
  total_votes: number;
  snack_of_the_week: Snack | null;
}

export interface ConsumeResponse {
  snack: Snack;
  consumed_amount: number;
  remaining_quantity: number;
}

export interface RestockResponse {
  snack: Snack;
  restocked_amount: number;
  new_quantity: number;
}

export interface VoteResponse {
  snack_id: number;
  vote_count: number;
  has_voted: boolean;
}

export interface Activity {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  snack_id: number | null;
  snack_name: string;
  action: ActivityAction;
  amount: number;
  created_at: string;
}

export interface ActivityListResponse {
  items: Activity[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SnackCreateInput {
  name: string;
  brand?: string | null;
  category: SnackCategory;
  quantity: number;
  low_stock_threshold: number;
  image_url?: string | null;
  price?: number | null;
}

export interface SnackUpdateInput {
  name?: string;
  brand?: string | null;
  category?: SnackCategory;
  quantity?: number;
  low_stock_threshold?: number;
  image_url?: string | null;
  price?: number | null;
}

export interface ImageUploadResponse {
  image_url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface ScannerPredictResponse {
  predicted_category: SnackCategory;
  confidence: number;
  low_confidence: boolean;
  scores: Record<SnackCategory, number>;
  image_url: string;
  model_name: string;
  limitations: string;
}

export interface ScannerInfoResponse {
  model_name: string;
  categories: SnackCategory[];
  low_confidence_threshold: number;
  limitations: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetail;
}

export interface WsEventMessage {
  event:
    | "connected"
    | "pong"
    | "stock_updated"
    | "vote_updated"
    | "snack_created"
    | "snack_updated"
    | "snack_deleted";
  data: Record<string, unknown>;
}

