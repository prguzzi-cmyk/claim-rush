import type { LeadOwnerIntelligence } from "./skip-trace";

export interface LeadContact {
  id: string;
  lead_id: string;
  full_name: string;
  full_name_alt: string | null;
  email: string | null;
  email_alt: string | null;
  phone_number: string;
  phone_number_alt: string | null;
  phone_is_valid: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  address_loss: string | null;
  city_loss: string | null;
  state_loss: string | null;
  zip_code_loss: string | null;
}

export interface Lead {
  id: string;
  ref_number: number;
  loss_date: string | null;
  peril: string | null;
  insurance_company: string | null;
  policy_number: string | null;
  claim_number: string | null;
  status: string;
  source_info: string | null;
  instructions_or_notes: string | null;
  last_outcome_status: string | null;
  contact: LeadContact | null;
  owner_intelligence: LeadOwnerIntelligence | null;
  assigned_user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedLeads {
  items: Lead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
