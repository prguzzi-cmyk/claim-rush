export interface SkiptraceWalletSummary {
  credit_balance: number;
  credits_used_total: number;
  credits_used_this_month: number;
  is_unlimited: boolean;
}

export interface CreditPurchaseRequest {
  pack_size: number;
}

export interface CreditPurchaseResponse {
  new_balance: number;
  credits_added: number;
  stripe_checkout_url: string;
}

export interface SkiptraceTransaction {
  id: string;
  wallet_id: string;
  lead_id: string | null;
  action_type: string;
  credits_used: number;
  lookup_status: string;
  address_queried: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadOwnerIntelligence {
  id: string;
  lead_id: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  owner_mailing_street: string | null;
  owner_mailing_city: string | null;
  owner_mailing_state: string | null;
  owner_mailing_zip: string | null;
  raw_residents: string | null;
  lookup_status: string;
  created_at: string;
  updated_at: string;
}

export interface CreditPack {
  size: number;
  price: number;
  label: string;
  perCredit: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { size: 50, price: 25, label: "Starter", perCredit: "$0.50" },
  { size: 100, price: 45, label: "Standard", perCredit: "$0.45" },
  { size: 250, price: 100, label: "Professional", perCredit: "$0.40" },
  { size: 1000, price: 350, label: "Enterprise", perCredit: "$0.35" },
];

export type ActionType = "skip_trace" | "sms" | "ai_voice_call" | "enrichment";

export const ACTION_LABELS: Record<ActionType, string> = {
  skip_trace: "Skip Trace",
  sms: "SMS",
  ai_voice_call: "AI Voice Call",
  enrichment: "Enrichment",
};

export const ACTION_COSTS: Record<ActionType, number> = {
  skip_trace: 1,
  sms: 1,
  ai_voice_call: 5,
  enrichment: 2,
};

export interface AdminUserBilling {
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  credit_balance: number;
  is_unlimited: boolean;
  skip_traces_used: number;
  sms_used: number;
  ai_voice_calls_used: number;
  enrichments_used: number;
  total_credits_used: number;
  estimated_cost_cents: number;
  last_activity: string | null;
  last_recharge: string | null;
  subscription_status: string;
}

export interface AdminBillingOverview {
  total_users: number;
  total_credits_in_circulation: number;
  total_credits_used: number;
  total_revenue_cents: number;
  users: AdminUserBilling[];
}
