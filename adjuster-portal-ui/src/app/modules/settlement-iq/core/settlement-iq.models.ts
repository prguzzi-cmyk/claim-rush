/**
 * TS type definitions mirroring the backend Pydantic schemas.
 * Backend source: ~/upa-portal-backend/app/app/services/settlement_iq/schemas.py
 *
 * Literal-union types pinned to the backend's runtime tuples — if the
 * backend enum grows, TypeScript will refuse to compile until this file
 * is updated.
 */

// ─── Literal aliases (mirror backend models.py constants) ──────────────────

export type Channel = 'residential' | 'commercial';

export type Peril = 'hail' | 'wind' | 'water' | 'fire' | 'theft' | 'other';

export type ScanStatus =
  | 'pending'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'purged';

export type Verdict =
  | 'strong_reopen'
  | 'possible_reopen'
  | 'weak_reopen'
  | 'open_claim'
  | 'released_decline'
  | 'statute_expired'
  | 'limited_analysis';

export type FindingType =
  | 'scope_omission'
  | 'pricing_discrepancy'
  | 'depreciation_error'
  | 'code_violation'
  | 'policy_provision_misapplied';

export type FindingSeverity = 'minor' | 'moderate' | 'major';


// ─── HTTP response shapes ──────────────────────────────────────────────────

export interface ScanSubmitResponse {
  scan_id: string;
  status: ScanStatus;
  estimated_completion_seconds: number;
}

export interface ScanStatusResponse {
  scan_id: string;
  status: ScanStatus;
  verdict: Verdict | null;
  progress_pct: number | null;
  failure_reason: string | null;
}

export interface FindingPublic {
  finding_type: FindingType;
  severity: FindingSeverity;
  description: string;
  estimated_dollar_impact_cents: number | null;
  evidence_citation: string | null;
  sort_order: number;
}

export interface ReportPayload {
  scan_id: string;
  verdict: Verdict;
  recovery_low_cents: number | null;
  recovery_high_cents: number | null;
  statute_window_days: number | null;

  // Extracted-claim summary fields — homeowner name + address are NOT in
  // the public report payload by design (PII stays server-side).
  carrier_name: string | null;
  loss_date: string | null;          // ISO date YYYY-MM-DD
  settlement_date: string | null;
  settlement_amount_cents: number | null;
  peril: Peril | null;
  state: string | null;
  county: string | null;

  // Extracted carrier-side dollar fields (in cents). Populated for
  // verdict='limited_analysis' so the report screen renders a "Carrier
  // Settlement" row instead of a recovery range. Null on standard
  // forensic verdicts.
  carrier_rcv_cents: number | null;
  carrier_acv_cents: number | null;
  carrier_deductible_cents: number | null;
  carrier_depreciation_cents: number | null;
  carrier_net_remaining_cents: number | null;

  // Limited-analysis narrative — populated by the backend's
  // generate_summary_only_narrative.md when verdict='limited_analysis'
  // (both summary_only and post-analysis safety-net paths). Null on
  // standard forensic verdicts.
  narrative_paragraphs: string[] | null;
  summary_findings: string[] | null;
  carrier_specific_note: string | null;
  next_step_recommendation: string | null;

  findings: FindingPublic[];

  report_version: string;
  report_sha256: string;
  generated_at: string;              // ISO datetime
}

export interface DataRequestResponse {
  accepted: boolean;
  purge_scheduled_by: string;        // ISO datetime
  matched_scans: number;
  note: string;
}

export interface ConsultationRequestPayload {
  scan_id: string;
  full_name: string;
  phone: string;
  preferred_contact_time: 'morning' | 'afternoon' | 'evening' | 'anytime';
  message: string | null;
}

export interface ConsultationRequestResponse {
  accepted: boolean;
  note: string;
}

export interface HealthcheckResponse {
  storage_backend: 'r2' | 'local_fs';
  r2_configured: boolean;
  anthropic_api_key_configured: boolean;
  pii_key_configured: boolean;
  tenant_id_default: string;
  report_version: string;
}


// ─── Frontend-internal state shape held by the service ─────────────────────

export interface ScanState {
  scanId: string | null;
  status: ScanStatus | null;
  verdict: Verdict | null;
  progressPct: number;
  failureReason: string | null;
  report: ReportPayload | null;
}

export const INITIAL_SCAN_STATE: ScanState = {
  scanId: null,
  status: null,
  verdict: null,
  progressPct: 0,
  failureReason: null,
  report: null,
};
