export interface LeadSkipTrace {
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
