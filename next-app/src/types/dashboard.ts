export interface LeadsByStatus {
  status: string | null;
  leads_count: number | null;
}

export interface LeadsBySource {
  user_name: string | null;
  email: string | null;
  source: string | null;
  leads_count: number | null;
}

export interface LeadsByAssignedUser {
  display_name: string | null;
  leads_count: number | null;
}

export interface ClaimsByPhase {
  current_phase: string | null;
  claims_count: number | null;
}

export interface UsersByRole {
  name: string | null;
  display_name: string | null;
  users_count: number | null;
}
