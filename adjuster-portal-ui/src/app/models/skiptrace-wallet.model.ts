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
  raw_residents: any | null;
  lookup_status: string;
  created_at: string;
}

export interface CreditPack {
  size: number;
  price_cents: number;
  label: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { size: 50, price_cents: 2500, label: '50 Credits — $25' },
  { size: 100, price_cents: 4500, label: '100 Credits — $45' },
  { size: 250, price_cents: 10000, label: '250 Credits — $100' },
  { size: 1000, price_cents: 35000, label: '1,000 Credits — $350' },
];
