import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { switchMap, takeWhile, tap } from 'rxjs/operators';

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

const TERMINAL_STATUSES: ScanStatus[] = ['complete', 'failed', 'purged'];

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

  constructor(private readonly http: HttpClient) {}

  // ─── Submit ────────────────────────────────────────────────────────────

  submitScan(
    file: File,
    email: string,
    referralSource?: string | null,
  ): Observable<ScanSubmitResponse> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('email', email);
    fd.append('channel', 'residential');
    if (referralSource) {
      fd.append('referral_source', referralSource);
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
