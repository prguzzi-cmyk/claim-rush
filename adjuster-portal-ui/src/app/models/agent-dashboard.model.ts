export interface AgentDashboardLead {
  lead_id: string;
  ref_number: number;
  ref_string: string;
  contact_name: string;
  address: string | null;
  peril: string | null;
  source_label: string;
  assigned_at: string | null;
  timeout_at: string | null;
  remaining_seconds: number;
  dashboard_status: 'pending' | 'accepted' | 'declined' | 'expired' | 'escalated';
  escalation_level: number;
  escalation_label: string;
  tracker_id: string | null;
  attempt_id: string | null;
  latitude: number | null;
  longitude: number | null;
  state: string | null;
  county: string | null;
  zip_code: string | null;
}

export interface AcceptDeclineResponse {
  success: boolean;
  lead_id: string;
  new_status: string;
  message: string;
}

export interface AgentDashboardConfig {
  escalation_timeout_seconds: number;
  poll_interval_ms: number;
}
