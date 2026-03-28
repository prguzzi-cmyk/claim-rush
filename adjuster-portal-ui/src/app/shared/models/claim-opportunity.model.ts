// ── Existing backend-driven models (unchanged) ─────────────────
export interface PotentialClaimRow {
  id: string;
  property_address: string;
  city: string | null;
  state: string;
  zip_code: string | null;
  claim_probability_score: number;
  estimated_claim_value: number;
  storm_event_id: string | null;
  impact_level: 'critical' | 'high' | 'moderate' | 'low';
  event_type: string;
  status: string;
  created_at: string;
}

export interface GenerateLeadResult {
  lead_id: string;
  assigned_agents_count: number;
  territory_name: string;
}

export interface OutreachStatus {
  channel: string; // sms, voice, email
  dispatched: boolean;
  error: string | null;
}

export interface AssignAgentResult {
  lead_id: string;
  territory_name: string;
  assigned_agent_name: string;
  assigned_agent_id: string;
  agent_performance_score: number;
  assignment_reason: string;
  outreach: OutreachStatus[];
  outcome_logged: boolean;
}

// ── Claim Opportunity Intelligence Engine models ────────────────

export type OpportunityPriority = 'critical' | 'high' | 'medium' | 'low';

export type RecommendedAction = 'assign_agent' | 'outreach' | 'monitor';

export interface ClaimOpportunity {
  id: string;
  event_type: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  damage_probability: number;
  estimated_claim_value: number;
  opportunity_score: number;
  priority: OpportunityPriority;
  recommended_action: RecommendedAction;
  source: string;
  timestamp: string;
  lead_status: string;
  raw_event?: any;
  scoring_factors?: ScoringFactorBreakdown;
  /** Unique incident ID from the originating source (e.g. PulsePoint ID) */
  source_incident_id?: string;
  /** Number of raw source events merged into this opportunity */
  merge_count?: number;
  /** All raw events that were merged (for audit) */
  merged_raw_events?: any[];
}

export const ACTION_META: Record<RecommendedAction, { label: string; color: string; icon: string }> = {
  assign_agent: { label: 'Assign Agent', color: '#00e676', icon: 'person_add' },
  outreach:     { label: 'Outreach',     color: '#ffd600', icon: 'campaign' },
  monitor:      { label: 'Monitor',      color: '#64748b', icon: 'visibility' },
};

export interface ScoringFactorBreakdown {
  event_severity: number;       // 0–1
  property_value: number;       // 0–1
  insurance_likelihood: number; // 0–1
  damage_probability: number;   // 0–1
  claim_size_estimate: number;  // 0–1
}

export const SCORING_FACTOR_META: { key: keyof ScoringFactorBreakdown; label: string; color: string }[] = [
  { key: 'event_severity',       label: 'Event Severity',       color: '#ff1744' },
  { key: 'property_value',       label: 'Property Value',       color: '#2979ff' },
  { key: 'insurance_likelihood', label: 'Insurance Likelihood', color: '#aa00ff' },
  { key: 'damage_probability',   label: 'Damage Probability',   color: '#ff6d00' },
  { key: 'claim_size_estimate',  label: 'Claim Size Estimate',  color: '#00e676' },
];

export interface OpportunityScoringWeights {
  event_severity: number;
  property_value: number;
  insurance_probability: number;
  damage_probability: number;
  claim_size: number;
}

export const DEFAULT_SCORING_WEIGHTS: OpportunityScoringWeights = {
  event_severity: 0.25,
  property_value: 0.20,
  insurance_probability: 0.20,
  damage_probability: 0.15,
  claim_size: 0.20,
};

export const PRIORITY_META: Record<OpportunityPriority, { label: string; color: string; icon: string }> = {
  critical: { label: 'Critical', color: '#ff1744', icon: 'error' },
  high:     { label: 'High',     color: '#ff6d00', icon: 'warning' },
  medium:   { label: 'Medium',   color: '#ffd600', icon: 'info' },
  low:      { label: 'Low',      color: '#64748b', icon: 'low_priority' },
};

export interface OpportunityMetrics {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalEstimatedValue: number;
  avgScore: number;
  topStates: { state: string; count: number }[];
  actionBreakdown: { assign_agent: number; outreach: number; monitor: number };
}
