import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

// ── Outreach Profile (template) ──

export interface OutreachProfile {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ── Sequence step ──

export interface SequenceStep {
  step: number;
  name: string;
  channel: string;
  delay_label: string;
  trigger: string;
}

// ── Opt-out ──

export interface OptOutStatus {
  lead_id: string;
  sms_opt_out: boolean;
  email_opt_out: boolean;
  voice_opt_out: boolean;
  contact_status: string | null;
  opt_out_at: string | null;
}

// ── Compliance config ──

export interface ComplianceConfig {
  id: string;
  master_pause: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_tz: string;
  stop_word_list: string;
  auto_suppress_enabled: boolean;
  max_daily_sms_per_lead: number;
  max_daily_emails_per_lead: number;
}

// ── Funnel metrics ──

export interface FunnelMetrics {
  new: number;
  sent: number;
  engaged: number;
  opted_out: number;
  aci_ready: number;
  closed: number;
  total: number;
}

// ── Contact status options ──

export const CONTACT_STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: '#9e9e9e', icon: 'fiber_new' },
  { value: 'sent', label: 'Sent', color: '#2196f3', icon: 'send' },
  { value: 'engaged', label: 'Engaged', color: '#ff9800', icon: 'chat' },
  { value: 'opted_out', label: 'Opted Out', color: '#f44336', icon: 'block' },
  { value: 'aci_ready', label: 'ACI Ready', color: '#4caf50', icon: 'check_circle' },
  { value: 'closed', label: 'Closed', color: '#607d8b', icon: 'archive' },
];

export const ROUTING_BUCKET_OPTIONS = [
  { value: 'ACI_LEAD', label: 'ACI Lead' },
  { value: 'UPA_OUTREACH', label: 'UPA Outreach' },
];

/** Variable keys available for outreach templates. */
export const TEMPLATE_VARIABLE_KEYS: string[] = [
  'first_name',
  'last_name',
  'address',
  'city',
  'state',
  'incident_type',
  'incident_date',
  'organization_name',
  'agent_name',
  'reply_stop_line',
];

/** Build the insert token at runtime so the Angular compiler never sees "{{" in the .ts source. */
export function wrapVariable(key: string): string {
  return '{' + '{' + key + '}' + '}';
}

@Injectable({
  providedIn: 'root',
})
export class UpaOutreachService {
  private base = 'upa-outreach';

  constructor(private http: HttpClient) {}

  private readonly TIMEOUT_MS = 10000; // 10s — if no response in 10s, error out

  // ── Profiles ──

  /** Simple body-only version (used by campaign manager and other consumers). */
  getProfiles(): Observable<OutreachProfile[]> {
    return this.http.get<OutreachProfile[]>(`${this.base}/profiles`)
      .pipe(timeout(this.TIMEOUT_MS));
  }

  /** Full response version with HTTP status (used by outreach-profiles debug). */
  getProfilesFull(): Observable<HttpResponse<OutreachProfile[]>> {
    return this.http.get<OutreachProfile[]>(`${this.base}/profiles`, { observe: 'response' })
      .pipe(timeout(this.TIMEOUT_MS));
  }

  createProfileFull(profile: Partial<OutreachProfile>): Observable<HttpResponse<OutreachProfile>> {
    return this.http.post<OutreachProfile>(`${this.base}/profiles`, profile, { observe: 'response' })
      .pipe(timeout(this.TIMEOUT_MS));
  }

  updateProfileFull(id: string, profile: Partial<OutreachProfile>): Observable<HttpResponse<OutreachProfile>> {
    return this.http.put<OutreachProfile>(`${this.base}/profiles/${id}`, profile, { observe: 'response' })
      .pipe(timeout(this.TIMEOUT_MS));
  }

  deleteProfile(id: string): Observable<any> {
    return this.http.delete(`${this.base}/profiles/${id}`)
      .pipe(timeout(this.TIMEOUT_MS));
  }

  seedDefaultsFull(): Observable<HttpResponse<any>> {
    return this.http.post<any>(`${this.base}/profiles/seed-defaults`, {}, { observe: 'response' })
      .pipe(timeout(this.TIMEOUT_MS));
  }

  // ── Sequence ──

  getSequence(): Observable<SequenceStep[]> {
    return this.http.get<SequenceStep[]>(`${this.base}/sequence`);
  }

  // ── Opt-out ──

  getOptOutStatus(leadId: string): Observable<OptOutStatus> {
    return this.http.get<OptOutStatus>(`${this.base}/opt-out/${leadId}`);
  }

  optOut(leadId: string, channels?: string[]): Observable<any> {
    return this.http.post(`${this.base}/opt-out`, { lead_id: leadId, channels });
  }

  optIn(leadId: string, channels?: string[]): Observable<any> {
    return this.http.post(`${this.base}/opt-in`, { lead_id: leadId, channels });
  }

  // ── Compliance ──

  getComplianceConfig(): Observable<ComplianceConfig> {
    return this.http.get<ComplianceConfig>(`${this.base}/compliance`);
  }

  updateComplianceConfig(config: Partial<ComplianceConfig>): Observable<ComplianceConfig> {
    return this.http.put<ComplianceConfig>(`${this.base}/compliance`, config);
  }

  // ── Funnel Metrics ──

  getFunnelMetrics(): Observable<FunnelMetrics> {
    return this.http.get<FunnelMetrics>(`${this.base}/funnel-metrics`);
  }
}
