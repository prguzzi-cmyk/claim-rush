import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, interval, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

const LOG_PREFIX = '[GovernanceTelemetry]';

export interface VendorUsageRow {
  allowed: number;
  suppressed: number;
  spend_cents: number;
}

export interface TopOperator {
  operator_id: string;
  spend_cents: number;
  calls: number;
}

export interface GovernanceTelemetry {
  mode: string;
  daily_budget_cents: number;
  daily_spend_cents: number;
  remaining_cents: number;
  suppressed_count_24h: number;
  vendor_usage_by_stage: Record<string, VendorUsageRow>;
  top_operators: TopOperator[];
  active_disaster_state: boolean;
  schema_pending: boolean;
  /** Local flag: backend reachable on the last poll. */
  reachable: boolean;
}

@Injectable({ providedIn: 'root' })
export class GovernanceTelemetryService {

  private telemetry$ = new BehaviorSubject<GovernanceTelemetry>(this.empty());
  private pollSub: Subscription | null = null;

  constructor(private http: HttpClient) {}

  getTelemetry(): Observable<GovernanceTelemetry> { return this.telemetry$.asObservable(); }
  getSnapshot(): GovernanceTelemetry { return this.telemetry$.value; }

  startPolling(intervalMs = 30000): void {
    this.stopPolling();
    console.log(LOG_PREFIX, 'startPolling', intervalMs + 'ms');
    this.refresh();
    this.pollSub = interval(intervalMs).subscribe(() => this.refresh());
  }

  stopPolling(): void { this.pollSub?.unsubscribe(); this.pollSub = null; }

  refresh(): void {
    this.http.get<GovernanceTelemetry>('governance/telemetry').pipe(
      timeout(10000),
      catchError(err => {
        // 401 or network error — keep prior values, mark unreachable.
        console.warn(LOG_PREFIX, 'refresh failed:', err?.status || err?.message || err);
        const prev = this.telemetry$.value;
        return of({ ...prev, reachable: false });
      }),
    ).subscribe(payload => {
      this.telemetry$.next({
        ...this.empty(),
        ...payload,
        reachable: true,
      });
    });
  }

  private empty(): GovernanceTelemetry {
    return {
      mode: 'conservative',
      daily_budget_cents: 0,
      daily_spend_cents: 0,
      remaining_cents: 0,
      suppressed_count_24h: 0,
      vendor_usage_by_stage: {},
      top_operators: [],
      active_disaster_state: false,
      schema_pending: false,
      reachable: false,
    };
  }
}
