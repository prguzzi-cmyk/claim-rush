export interface LeadIntakeRecord {
  incident_id: string;
  call_type: string;
  call_type_description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  incident_time: string | null;
  source: string;
  is_active: boolean;
  lead_id: string | null;
  lead_ref_string: string | null;
  lead_status: string | null;
  territory_id: string | null;
  territory_name: string | null;
  state: string | null;
  auto_lead_attempted: boolean;
  auto_lead_skipped_reason: string | null;
  created_at: string;
}

export interface ManualLeadIntakeRequest {
  incident_type: string;
  address: string;
  city?: string;
  state: string;
  zip_code?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  full_name?: string;
  phone_number?: string;
  auto_distribute?: boolean;
}

export interface ManualLeadIntakeResponse {
  lead_id: string;
  lead_ref_string: string;
  territory_id: string | null;
  territory_name: string | null;
  distributed: boolean;
  assigned_agents: { agent_id: string; agent_name: string }[];
}
