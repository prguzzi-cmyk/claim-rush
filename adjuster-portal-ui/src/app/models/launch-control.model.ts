export interface TerritoryRef {
  territory_id: string;
  name: string;
  territory_type: string;
  state: string | null;
  county: string | null;
  zip_code: string | null;
  priority: number;
}

export type Readiness = 'ready' | 'missing_setup' | 'broken';
export type DeploymentStatus = 'broken' | 'not_ready' | 'ready' | 'deployed';

export interface LaunchControlUser {
  user_id: string;
  name: string;
  email: string;
  role: string;
  role_display: string | null;

  // Optional partner profile photo. Surfaced as a thumbnail next to the
  // name in the Launch Control table.
  profile_image_url?: string | null;

  upline_user_id: string | null;
  upline_name: string | null;

  territories: TerritoryRef[];

  routing_mode: string | null;
  rotation_enabled: boolean;
  rotation_inactivity_minutes: number | null;

  portal_active: boolean;
  login_url: string;

  personal_landing_slug: string | null;
  personal_landing_url: string | null;
  client_intake_url: string | null;

  readiness: Readiness;
  issues: string[];

  // Deployment lifecycle (broken/not_ready/ready/deployed) and the
  // admin-side preview URL once the user has been deployed.
  deployment_status: DeploymentStatus;
  portal_deployed_at: string | null;
  portal_url: string | null;

  // Onboarding e-sign + activation visibility. Populated by the backend
  // from User flags + AgentProfile.agent_number; read-only on the UI.
  upa_agreement_signed?: boolean;
  aci_agreement_signed?: boolean;
  agreement_signed_at?: string | null;
  agent_number?: string | null;
  is_activated?: boolean;
}

export interface PortalLeadRow {
  lead_id: string;
  ref_number: number;
  peril: string | null;
  status: string | null;
  rotation_status: string | null;
  assigned_at: string | null;
  matched_level: string | null;
  matched_value: string | null;
}

export interface LaunchControlUserDetail extends LaunchControlUser {
  recent_leads: PortalLeadRow[];
  total_leads: number;
}

export interface DeployResponse {
  user_id: string;
  deployment_status: DeploymentStatus;
  portal_deployed_at: string | null;
  portal_url: string | null;
  login_url: string;
  intake_url: string | null;
}

export interface EnrollTerritoryInput {
  territory_type: 'state' | 'county' | 'zip';
  state: string | null;
  county: string | null;
  zip_code: string | null;
}

export interface EnrollRequest {
  full_name: string;
  email: string;
  role: 'cp' | 'rvp' | 'agent';
  manager_email: string | null;
  // Multiple territories per user. The backend also accepts the legacy
  // single `territory` key for back-compat; new code should always send
  // `territories: [...]`.
  territories: EnrollTerritoryInput[];
  password: string | null;
}

export interface EnrollTerritoryEcho {
  territory_type: string;
  state: string | null;
  county: string | null;
  zip_code: string | null;
  value: string;
}

export interface EnrollResponse {
  user_id: string;
  name: string;
  email: string;
  role: string;
  role_display: string | null;
  upline_user_id: string | null;
  upline_name: string | null;

  // Single-territory mirror — first item in `territories`. Kept for
  // older UI that hasn't switched to the array yet.
  territory_type: string;
  territory_state: string | null;
  territory_county: string | null;
  territory_zip: string | null;
  territories: EnrollTerritoryEcho[];

  login_email: string;
  temporary_password: string;

  login_url: string;
  portal_url: string;
  intake_url: string | null;
  intake_slug: string | null;

  deployment_status: DeploymentStatus;
}

export const LC_ROLE_FILTERS: ('all' | 'cp' | 'rvp' | 'agent')[] = ['all', 'cp', 'rvp', 'agent'];
export const LC_READINESS_FILTERS: ('all' | Readiness)[] = ['all', 'ready', 'missing_setup', 'broken'];
