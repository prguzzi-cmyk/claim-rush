import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, timer } from 'rxjs';
import { delay, switchMap, takeWhile, tap } from 'rxjs/operators';

import { DEMO_REPORT } from './demo-report-fixture';
import {
  ConsultationRequestPayload,
  ConsultationRequestResponse,
  DataRequestResponse,
  HealthcheckResponse,
  INITIAL_SCAN_STATE,
  ReportPayload,
  ScanState,
  ScanStatus,
  ScanStatusResponse,
  ScanSubmitResponse,
} from './settlement-iq.models';

/** Special scan_id that returns the demo fixture instead of hitting the API.
 *  Useful for design review + browser smoke tests without the backend running. */
export const DEMO_SCAN_ID = 'demo';

const TERMINAL_STATUSES: ScanStatus[] = ['complete', 'failed', 'purged'];

/** sessionStorage key for the active referral rep slug. Survives a
 *  page reload during the Door→Upload flow without persisting across
 *  browser sessions (homeowners shouldn't be cross-attributed if they
 *  return weeks later from a different entry point). */
const REP_SLUG_STORAGE_KEY = 'si_referral_rep';

/**
 * Settlement IQ — public API client + per-scan state holder.
 *
 * Single instance, providedIn: 'root'. One BehaviorSubject<ScanState>
 * tracks the active scan; components subscribe to slices. Status
 * polling uses timer(0, 2000) + switchMap and stops automatically
 * when the scan reaches a terminal state (complete / failed / purged).
 *
 * Base path is 'settlement-iq' (relative). The existing ApiInterceptor
 * prepends '/v1/' so the URL routes to /v1/settlement-iq/* on the
 * configured backend.
 */
@Injectable({ providedIn: 'root' })
export class SettlementIqService {
  private readonly base = 'settlement-iq';

  private readonly state$ = new BehaviorSubject<ScanState>({ ...INITIAL_SCAN_STATE });
  readonly scan$: Observable<ScanState> = this.state$.asObservable();

  /** Rep slug captured from ?rep=<slug> on the Door or Upload screen.
   *  Threaded into POST /scan as the rep_slug form field so the scan
   *  row records which rep referred the homeowner. Distinct from
   *  referral_source (marketing-channel attribution). */
  private readonly referralRepSlugState$ = new BehaviorSubject<string | null>(
    SettlementIqService.readStoredRepSlug(),
  );
  readonly referralRepSlug$: Observable<string | null> =
    this.referralRepSlugState$.asObservable();

  constructor(private readonly http: HttpClient) {}

  /** Update the active rep slug. Idempotent — passing the same slug
   *  twice is a no-op. Passing null clears (used after submit so a
   *  subsequent scan from a different entry point isn't mis-attributed). */
  setReferralRepSlug(slug: string | null): void {
    const normalized = SettlementIqService.normalizeRepSlug(slug);
    if (normalized === this.referralRepSlugState$.value) return;
    this.referralRepSlugState$.next(normalized);
    try {
      if (normalized) {
        sessionStorage.setItem(REP_SLUG_STORAGE_KEY, normalized);
      } else {
        sessionStorage.removeItem(REP_SLUG_STORAGE_KEY);
      }
    } catch {
      // sessionStorage may be unavailable (private mode in some browsers).
      // The BehaviorSubject still holds the value for the active tab —
      // we just lose reload-survival, which is acceptable graceful
      // degradation rather than a hard failure.
    }
  }

  get currentReferralRepSlug(): string | null {
    return this.referralRepSlugState$.value;
  }

  private static normalizeRepSlug(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim().toLowerCase();
    // Defensive: reject anything that doesn't look like a slug. Backend
    // will also validate, but we'd rather not POST garbage. Matches the
    // backend's expected character set (lowercase alphanumerics + hyphen,
    // 2-64 chars, no leading/trailing hyphen).
    if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(trimmed)) return null;
    return trimmed;
  }

  private static readStoredRepSlug(): string | null {
    try {
      return SettlementIqService.normalizeRepSlug(
        sessionStorage.getItem(REP_SLUG_STORAGE_KEY),
      );
    } catch {
      return null;
    }
  }

  // ─── Submit ────────────────────────────────────────────────────────────

  submitScan(
    file: File,
    email: string,
    referralSource?: string | null,
    repSlug?: string | null,
  ): Observable<ScanSubmitResponse> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('email', email);
    fd.append('channel', 'residential');
    if (referralSource) {
      fd.append('referral_source', referralSource);
    }
    if (repSlug) {
      fd.append('rep_slug', repSlug);
    }
    return this.http.post<ScanSubmitResponse>(`${this.base}/scan`, fd).pipe(
      tap((res) => {
        this.state$.next({
          ...INITIAL_SCAN_STATE,
          scanId: res.scan_id,
          status: res.status,
          progressPct: 0,
        });
      }),
    );
  }

  // ─── Poll ──────────────────────────────────────────────────────────────

  /**
   * Poll /scan/{id}/status every 2 seconds. Emits each response and
   * automatically stops when status is terminal (complete / failed /
   * purged). takeWhile(..., true) keeps the terminal emission so the
   * subscriber sees the final state.
   */
  pollStatus(scanId: string): Observable<ScanStatusResponse> {
    return timer(0, 2000).pipe(
      switchMap(() => this.http.get<ScanStatusResponse>(`${this.base}/scan/${scanId}/status`)),
      tap((s) => {
        this.state$.next({
          ...this.state$.value,
          scanId: s.scan_id,
          status: s.status,
          verdict: s.verdict,
          progressPct: s.progress_pct ?? this.state$.value.progressPct,
          failureReason: s.failure_reason,
        });
      }),
      takeWhile((s) => !TERMINAL_STATUSES.includes(s.status), true),
    );
  }

  // ─── Fetch report ──────────────────────────────────────────────────────

  fetchReport(scanId: string): Observable<ReportPayload> {
    // Special-case the demo fixture so designers and stakeholders can
    // review the Report screen without a running backend.
    if (scanId === DEMO_SCAN_ID) {
      return of(DEMO_REPORT).pipe(
        delay(150),
        tap((report) => {
          this.state$.next({
            ...this.state$.value,
            report,
          });
        }),
      );
    }
    return this.http.get<ReportPayload>(`${this.base}/scan/${scanId}/report`).pipe(
      tap((report) => {
        this.state$.next({
          ...this.state$.value,
          report,
        });
      }),
    );
  }

  /**
   * URL for the rendered HTML report — surfaced via an anchor href on
   * the report screen ("Open print-friendly version"). No service call
   * because the response is HTML, not JSON.
   */
  reportHtmlUrl(scanId: string): string {
    // The demo fixture has no server-side HTML render.
    if (scanId === DEMO_SCAN_ID) {
      return '';
    }
    return `/v1/${this.base}/scan/${scanId}/report.html`;
  }

  // ─── Right to delete ───────────────────────────────────────────────────

  submitDataRequest(email: string): Observable<DataRequestResponse> {
    return this.http.post<DataRequestResponse>(`${this.base}/data-request`, { email });
  }

  /**
   * POST a consultation request. Backend endpoint is a Phase 1.5 follow-up
   * (route exists on the frontend so the homeowner experience ships now;
   * the backend handler is a separate slice that will fan out to the
   * tenant's configured PA firm by tenant_id + scan context).
   *
   * Until the backend handler ships, this call returns 404. The
   * consultation form component handles that gracefully by surfacing a
   * fallback "please contact us at ..." message instead of pretending the
   * submission succeeded.
   */
  submitConsultationRequest(
    payload: ConsultationRequestPayload,
  ): Observable<ConsultationRequestResponse> {
    return this.http.post<ConsultationRequestResponse>(
      `${this.base}/consultation`,
      payload,
    );
  }

  // ─── Ops ───────────────────────────────────────────────────────────────

  fetchHealthcheck(): Observable<HealthcheckResponse> {
    return this.http.get<HealthcheckResponse>(`${this.base}/admin/healthcheck`);
  }

  // ─── State control ─────────────────────────────────────────────────────

  resetState(): void {
    this.state$.next({ ...INITIAL_SCAN_STATE });
  }

  get snapshot(): ScanState {
    return this.state$.value;
  }
}
