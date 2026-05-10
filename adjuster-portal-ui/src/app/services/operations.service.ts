import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Ticker event ─────────────────────────────────────────────────
export type TickerSeverity = 'critical' | 'engagement' | 'info' | 'warning' | 'muted';

export interface TickerEvent {
  kind: 'decision' | 'notification';
  at: string | null;
  decision: string;
  lead_id: string | null;
  title: string;
  body: string;
  severity: TickerSeverity;
  meta: Record<string, unknown>;
}

export interface TickerResponse {
  count: number;
  as_of: string;
  events: TickerEvent[];
}

// ── Action queue ─────────────────────────────────────────────────
export interface ActionLead {
  lead_id: string;
  ref_number: number;
  priority_score: number | null;
  followup_required: boolean;
  last_routed_role: string | null;
  last_routed_to_id: string | null;
  last_routed_at: string | null;
  outreach_state: string | null;
  contact_status: string | null;
  peril: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  state_loss: string | null;
  last_reply: string | null;
}

export interface ActionNotification {
  id: string;
  title: string;
  message: string;
  lead_id: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActionQueueResponse {
  as_of: string;
  target_user_id: string | null;
  leads_needing_followup: ActionLead[];
  lead_count: number;
  notifications: ActionNotification[];
  notification_count: number;
  filters: { territory: string | null; priority_min: number | null; unread_only: boolean };
}

// ── Dashboard metrics ────────────────────────────────────────────
export interface DashboardMetrics {
  lookback_hours: number;
  as_of: string;
  scan_runs_in_window: number;
  total_decisions: number;
  engaged_homeowners: number;
  opted_out: number;
  followup_backlog: number;
  escalations_routed: number;
  escalations_suppressed: number;
  legal_hour_suppressions: number;
  dnc_suppressions: number;
  daily_cap_hits: number;
  allowlist_blocks: number;
  skip_traces_queued: number;
  skip_traces_resolved: number;
  skip_traces_failed: number;
  leads_by_outreach_state: Record<string, number>;
  leads_by_contact_status: Record<string, number>;
  top_territories: Array<{ state: string; lead_count: number; max_priority: number | null }>;
  top_agents: Array<{ user_id: string; routed_count: number }>;
  by_decision: Record<string, number>;
}

// ── Lead timeline ────────────────────────────────────────────────
export interface TimelineEvent {
  kind: 'decision' | 'attempt' | 'notification';
  at: string | null;
  title: string;
  body: string;
  severity: TickerSeverity;
  raw: Record<string, unknown>;
}

export interface LeadTimelineResponse {
  lead_id: string;
  ref_number?: number;
  outreach_state: string | null;
  contact_status: string | null;
  priority_score: number | null;
  followup_required: boolean;
  last_routed_role: string | null;
  last_routed_to_id: string | null;
  last_routed_at: string | null;
  peril: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  state_loss: string | null;
  last_reply: string | null;
  timeline_event_count: number;
  timeline: TimelineEvent[];
}

@Injectable({ providedIn: 'root' })
export class OperationsService {
  private base = 'operations';

  constructor(private http: HttpClient) {}

  ticker(limit = 50, since?: string): Observable<TickerResponse> {
    const params: string[] = [`limit=${limit}`];
    if (since) params.push(`since=${encodeURIComponent(since)}`);
    return this.http.get<TickerResponse>(`${this.base}/ticker?${params.join('&')}`);
  }

  actionQueue(opts: {
    user_id?: string;
    territory?: string;
    priority_min?: number;
    unread_only?: boolean;
    limit?: number;
  } = {}): Observable<ActionQueueResponse> {
    const params: string[] = [];
    if (opts.user_id) params.push(`user_id=${opts.user_id}`);
    if (opts.territory) params.push(`territory=${opts.territory}`);
    if (opts.priority_min != null) params.push(`priority_min=${opts.priority_min}`);
    if (opts.unread_only) params.push(`unread_only=true`);
    if (opts.limit) params.push(`limit=${opts.limit}`);
    const q = params.length ? '?' + params.join('&') : '';
    return this.http.get<ActionQueueResponse>(`${this.base}/action-queue${q}`);
  }

  dashboardMetrics(lookback_hours = 24): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.base}/dashboard-metrics?lookback_hours=${lookback_hours}`);
  }

  leadTimeline(leadId: string): Observable<LeadTimelineResponse> {
    return this.http.get<LeadTimelineResponse>(`${this.base}/lead/${leadId}/timeline`);
  }
}
