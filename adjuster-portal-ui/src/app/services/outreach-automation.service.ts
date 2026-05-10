import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Legal-window read-out ────────────────────────────────────────
export interface LegalWindow {
  state: string | null;
  start: string;          // 'HH:mm'
  end: string;            // 'HH:mm'
  allowed_weekdays: number[];  // 0=Mon..6=Sun
  timezone: string;
  notes: string;
}

// ── Hours config ─────────────────────────────────────────────────
export interface OutreachHoursConfig {
  id?: string;
  scope_kind: 'global' | 'company' | 'territory' | 'user';
  scope_id?: string | null;
  weekday_mask: number;        // 7-bit; bit 0 = Mon
  start_time: string;          // 'HH:mm:ss'
  end_time: string;            // 'HH:mm:ss'
  timezone: string;
  daily_cap_sms: number;
  daily_cap_voice: number;
  channel_sequence: string;    // 'skip_trace,sms,voice'
  is_active: boolean;
}

// ── Decision log row ────────────────────────────────────────────
export interface DecisionLogRow {
  id: string;
  scan_run_id: string;
  lead_id: string | null;
  decision: string;
  reason: string | null;
  channel: string | null;
  gate_results: Record<string, unknown> | null;
  dry_run: boolean;
  created_at: string;
}

// ── Dry-run summary ─────────────────────────────────────────────
export interface DryRunResult {
  scan_run_id: string;
  leads_evaluated: number;
  decisions_by_kind: Record<string, number>;
  sample_rows: DecisionLogRow[];
  auto_dispatch_enabled: boolean;
  note: string;
}

// ── Status snapshot ─────────────────────────────────────────────
export interface AutomationStatus {
  phase: string;
  auto_dispatch_enabled: boolean;
  default_legal_window: LegalWindow;
  default_recipient_allowlist_size: number;
  twilio_enabled: boolean;
  scanner_in_beat_schedule: boolean;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class OutreachAutomationService {
  private base = 'outreach-automation';

  constructor(private http: HttpClient) {}

  status(): Observable<AutomationStatus> {
    return this.http.get<AutomationStatus>(`${this.base}/status`);
  }

  legalWindow(state?: string | null): Observable<LegalWindow> {
    const q = state ? `?state=${encodeURIComponent(state)}` : '';
    return this.http.get<LegalWindow>(`${this.base}/legal-windows${q}`);
  }

  legalWindowsAll(): Observable<Record<string, LegalWindow>> {
    return this.http.get<Record<string, LegalWindow>>(`${this.base}/legal-windows/all`);
  }

  listHoursConfigs(): Observable<OutreachHoursConfig[]> {
    return this.http.get<OutreachHoursConfig[]>(`${this.base}/hours-config`);
  }

  createHoursConfig(payload: OutreachHoursConfig): Observable<OutreachHoursConfig> {
    return this.http.post<OutreachHoursConfig>(`${this.base}/hours-config`, payload);
  }

  updateHoursConfig(id: string, payload: OutreachHoursConfig): Observable<OutreachHoursConfig> {
    return this.http.put<OutreachHoursConfig>(`${this.base}/hours-config/${id}`, payload);
  }

  disableHoursConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/hours-config/${id}`);
  }

  decisionLog(opts?: { scan_run_id?: string; decision?: string; limit?: number }): Observable<DecisionLogRow[]> {
    const params: string[] = [];
    if (opts?.scan_run_id) params.push(`scan_run_id=${encodeURIComponent(opts.scan_run_id)}`);
    if (opts?.decision) params.push(`decision=${encodeURIComponent(opts.decision)}`);
    if (opts?.limit) params.push(`limit=${opts.limit}`);
    const q = params.length ? '?' + params.join('&') : '';
    return this.http.get<DecisionLogRow[]>(`${this.base}/decision-log${q}`);
  }

  dryRun(opts?: { state?: string; channel?: 'sms' | 'voice'; limit?: number }): Observable<DryRunResult> {
    const params: string[] = [];
    if (opts?.state) params.push(`state=${encodeURIComponent(opts.state)}`);
    if (opts?.channel) params.push(`channel=${opts.channel}`);
    if (opts?.limit) params.push(`limit=${opts.limit}`);
    const q = params.length ? '?' + params.join('&') : '';
    return this.http.post<DryRunResult>(`${this.base}/dry-run${q}`, {});
  }

  // ── Client-side legal-floor validation ─────────────────────────
  // Mirror of validate_user_hours_against_legal_floor in the backend.
  // Returns null if OK or a human-readable rejection reason.
  // Backend re-validates — this is for immediate UI feedback only.
  validateAgainstLegalFloor(
    floor: LegalWindow,
    start: string,         // 'HH:mm' or 'HH:mm:ss'
    end: string,
    weekdays: number[],
  ): string | null {
    const [sh, sm] = start.split(':').map((x) => parseInt(x, 10));
    const [eh, em] = end.split(':').map((x) => parseInt(x, 10));
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (startMin >= endMin) return 'start must be strictly before end';

    const [fsh, fsm] = floor.start.split(':').map((x) => parseInt(x, 10));
    const [feh, fem] = floor.end.split(':').map((x) => parseInt(x, 10));
    const floorStartMin = fsh * 60 + fsm;
    const floorEndMin = feh * 60 + fem;

    if (startMin < floorStartMin) {
      return `start ${start} earlier than legal floor ${floor.start} (${floor.notes})`;
    }
    if (endMin > floorEndMin) {
      return `end ${end} later than legal floor ${floor.end} (${floor.notes})`;
    }
    const illegalDays = weekdays.filter((d) => !floor.allowed_weekdays.includes(d));
    if (illegalDays.length > 0) {
      const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const list = illegalDays.map((d) => names[d]).join(', ');
      return `weekdays [${list}] not allowed by legal floor (${floor.notes})`;
    }
    return null;
  }
}
