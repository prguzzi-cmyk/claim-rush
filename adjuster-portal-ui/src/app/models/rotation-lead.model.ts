export enum RotationLeadStatus {
  NEW_LEAD = 'new_lead',
  ASSIGNED = 'assigned',
  ATTEMPTED_CONTACT = 'attempted_contact',
  NO_ANSWER = 'no_answer',
  LEFT_MESSAGE = 'left_message',
  CALL_BACK_LATER = 'call_back_later',
  NOT_INTERESTED = 'not_interested',
  INTERESTED = 'interested',
  SIGNED_CLIENT = 'signed_client',
  INVALID_LEAD = 'invalid_lead',
}

export enum RotationActivityType {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  CONTACT_ATTEMPTED = 'contact_attempted',
  STATUS_CHANGED = 'status_changed',
  REASSIGNED = 'reassigned',
  ESCALATED = 'escalated',
  NOTE_ADDED = 'note_added',
}

export interface RotationLead {
  id: string;
  lead_source: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  owner_name: string;
  phone: string;
  email?: string;
  incident_type: string;
  lead_status: string;
  assigned_agent_id?: string;
  assignment_date?: string;
  last_contact_attempt?: string;
  contact_attempt_count: number;
  outcome?: string;
  notes?: string;
  reassignment_count: number;
  created_at?: string;
  updated_at?: string;
  assigned_agent?: any;
  activities?: RotationLeadActivity[];
}

export interface RotationLeadCreate {
  lead_source: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  owner_name: string;
  phone: string;
  email?: string;
  incident_type: string;
}

export interface RotationLeadUpdate {
  lead_status?: string;
  outcome?: string;
  notes?: string;
}

export interface RotationLeadActivity {
  id: string;
  rotation_lead_id: string;
  activity_type: string;
  description: string;
  old_value?: string;
  new_value?: string;
  performed_by_id?: string;
  performed_by?: any;
  created_at?: string;
}

export interface RotationConfig {
  id: string;
  territory_id?: string;
  contact_timeout_hours: number;
  max_contact_attempts: number;
  auto_reassign_enabled: boolean;
  rotation_index: number;
  last_assigned_agent_id?: string;
  use_performance_weighting: boolean;
  weight_closing_rate: number;
  weight_response_speed: number;
  weight_satisfaction: number;
  territory?: any;
  created_at?: string;
  updated_at?: string;
}

export interface RotationConfigUpdate {
  contact_timeout_hours?: number;
  max_contact_attempts?: number;
  auto_reassign_enabled?: boolean;
  use_performance_weighting?: boolean;
  weight_closing_rate?: number;
  weight_response_speed?: number;
  weight_satisfaction?: number;
}

export interface ContactAttemptRequest {
  outcome: string;
  notes?: string;
}

export interface ReassignRequest {
  new_agent_id?: string;
  reason?: string;
}

export interface AgentBreakdown {
  agent_id: string;
  agent_name: string;
  leads_assigned: number;
  leads_contacted: number;
  leads_signed: number;
  avg_response_hours?: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
}

export interface RotationLeadMetrics {
  total_leads: number;
  assigned_leads: number;
  signed_clients: number;
  avg_response_hours?: number;
  agent_breakdown: AgentBreakdown[];
  status_breakdown: StatusBreakdown[];
  conversion_rate: number;
}

// ── Agent Availability & Performance ──────────────────────────

/** Agent eligibility profile for rotation decisions. */
export interface AgentAvailability {
  agentId: string;
  agentName: string;
  isActive: boolean;
  isAcceptingLeads: boolean;
  dailyLeadLimit: number;
  leadsAssignedToday: number;
  territories: string[];
  nationalAccess: boolean;
}

/** Performance weight factors for rotation ordering. */
export interface AgentPerformanceWeight {
  agentId: string;
  closingRate: number;
  avgResponseHours: number;
  clientSatisfaction: number;
  /** Computed composite score (0-100). Higher = better priority in rotation. */
  compositeScore: number;
}

/** Combined eligibility result from the rotation engine. */
export interface EligibleAgent {
  agentId: string;
  agentName: string;
  weight: number;
  lastAssignedAt: string | null;
  leadsToday: number;
}

// ── Response Time Monitoring ──────────────────────────────────

export type ResponseTimerAction = 'reminder' | 'escalation_task' | 'reassign';

export interface ResponseTimerThreshold {
  minutesAfterAssignment: number;
  action: ResponseTimerAction;
  label: string;
}

export const DEFAULT_RESPONSE_THRESHOLDS: ResponseTimerThreshold[] = [
  { minutesAfterAssignment: 15, action: 'reminder',        label: '15 min — Send reminder' },
  { minutesAfterAssignment: 30, action: 'escalation_task', label: '30 min — Create escalation task' },
  { minutesAfterAssignment: 60, action: 'reassign',        label: '60 min — Reassign to next agent' },
];

/** Current timer state for an assigned lead. */
export interface LeadResponseTimerState {
  leadId: string;
  assignedAgentId: string;
  assignedAt: string;
  minutesSinceAssignment: number;
  currentThresholdIndex: number;
  nextAction: ResponseTimerThreshold | null;
  isOverdue: boolean;
}

// ── Lead Source Routing ───────────────────────────────────────

export type LeadSource =
  | 'storm_intelligence'
  | 'fire_incident'
  | 'crime_claim'
  | 'referral'
  | 'organic_inbound'
  | 'community_advocate'
  | 'manual_entry';

export const LEAD_SOURCE_META: Record<LeadSource, { label: string; icon: string; color: string; priority: number }> = {
  storm_intelligence:  { label: 'Storm Intelligence',  icon: 'thunderstorm',       color: '#1565c0', priority: 1 },
  fire_incident:       { label: 'Fire Incident',       icon: 'local_fire_department', color: '#c62828', priority: 1 },
  crime_claim:         { label: 'Crime Claim',         icon: 'shield',             color: '#6a1b9a', priority: 2 },
  referral:            { label: 'Referral',            icon: 'people',             color: '#2e7d32', priority: 2 },
  organic_inbound:     { label: 'Organic / Inbound',   icon: 'call_received',      color: '#00838f', priority: 3 },
  community_advocate:  { label: 'Community Advocate',  icon: 'volunteer_activism', color: '#e65100', priority: 3 },
  manual_entry:        { label: 'Manual Entry',        icon: 'edit',               color: '#757575', priority: 4 },
};

/** Source-based routing rule. Lower priority number = higher routing priority. */
export interface LeadSourceRoutingRule {
  source: LeadSource;
  priority: number;
  preferExclusiveAssignment: boolean;
}
