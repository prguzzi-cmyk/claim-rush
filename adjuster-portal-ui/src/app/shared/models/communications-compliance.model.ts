/**
 * Communications Compliance Layer
 * Architecture for opt-in tracking, DNC filtering, and country rule toggles.
 */

// ── Opt-In Consent Tracking ──────────────────────────────────────

export type ConsentChannel = 'sms' | 'email' | 'voice';
export type ConsentStatus = 'opted_in' | 'opted_out' | 'pending' | 'revoked';
export type ConsentSource = 'web_form' | 'sms_keyword' | 'api' | 'manual' | 'import';

export interface ContactConsent {
  id: string;
  contact_id: string;
  lead_id: string | null;
  channel: ConsentChannel;
  status: ConsentStatus;
  source: ConsentSource;
  consented_at: string | null;
  revoked_at: string | null;
  ip_address: string | null;
  consent_text: string | null;
  created_at: string;
  updated_at: string | null;
}

// ── Do Not Call / Do Not Contact ─────────────────────────────────

export type DncSource = 'federal_registry' | 'state_registry' | 'internal' | 'carrier_complaint' | 'manual';

export interface DncEntry {
  id: string;
  phone_number: string;
  email: string | null;
  source: DncSource;
  reason: string | null;
  added_at: string;
  expires_at: string | null;
  is_active: boolean;
}

// ── Country / Region Rule Toggles ────────────────────────────────

export interface CountryRule {
  id: string;
  country_code: string;
  country_name: string;
  sms_enabled: boolean;
  voice_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start: string | null;   // HH:mm format
  quiet_hours_end: string | null;     // HH:mm format
  timezone: string;
  max_daily_sms: number | null;
  max_daily_calls: number | null;
  require_opt_in: boolean;
  tcpa_compliant: boolean;
  notes: string | null;
  is_active: boolean;
}

// ── Compliance Check Result ──────────────────────────────────────

export type ComplianceBlockReason =
  | 'no_consent'
  | 'opted_out'
  | 'dnc_list'
  | 'quiet_hours'
  | 'country_disabled'
  | 'daily_limit_reached'
  | 'tcpa_violation';

export interface ComplianceCheckResult {
  allowed: boolean;
  blocked_reasons: ComplianceBlockReason[];
  warnings: string[];
  consent_status: ConsentStatus | null;
  dnc_match: boolean;
  quiet_hours_active: boolean;
  country_rule: CountryRule | null;
}

// ── Compliance Dashboard Metrics ─────────────────────────────────

export interface ComplianceDashboardMetrics {
  total_opted_in: number;
  total_opted_out: number;
  total_dnc_entries: number;
  blocked_today: number;
  compliance_rate: number;
  countries_enabled: number;
  consent_by_channel: Record<ConsentChannel, { opted_in: number; opted_out: number }>;
}

// ── Compliance Audit Log ─────────────────────────────────────────

export type ComplianceAuditAction =
  | 'consent_granted'
  | 'consent_revoked'
  | 'dnc_added'
  | 'dnc_removed'
  | 'message_blocked'
  | 'country_rule_changed'
  | 'override_applied';

export interface ComplianceAuditEntry {
  id: string;
  action: ComplianceAuditAction;
  contact_id: string | null;
  channel: ConsentChannel | null;
  details: string;
  performed_by: string | null;
  created_at: string;
}
