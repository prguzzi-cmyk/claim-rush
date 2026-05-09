import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, forkJoin, interval, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

const LOG_PREFIX = '[WalletTelemetry]';

export interface MyWallet {
  id?: string;
  wallet_kind: string;
  owner_user_id?: string | null;
  token_balance: number;
  reserved_tokens: number;
  lifetime_spend_cents: number;
  daily_spend_cents: number;
  monthly_spend_cents: number;
  hard_limit_tokens: number | null;
  soft_limit_tokens: number | null;
  governance_mode: string;
  schema_pending: boolean;
  actor_role?: string | null;
}

export interface TopSpender {
  actor_user_id: string;
  actor_role: string | null;
  tokens: number;
  cents: number;
  calls: number;
}

export interface DailyBurnPoint {
  date: string;
  tokens: number;
  cents: number;
  events: number;
  failed_or_suppressed: number;
}

export interface ProjectedMonthly {
  mtd_cents: number;
  mtd_tokens: number;
  projected_cents: number;
  projected_tokens: number;
}

export interface TodaySnapshot {
  sms_sent_today: number;
  estimated_spend_today_cents: number;
  active_operators_today: number;
  projected_monthly_cents: number;
  top_operator: {
    user_id: string;
    name: string | null;
    spend_cents: number;
    event_count: number;
  } | null;
  schema_pending: boolean;
}

export interface WalletTelemetry {
  myWallet: MyWallet | null;
  topSpenders: TopSpender[];
  dailyBurn: DailyBurnPoint[];
  projected: ProjectedMonthly | null;
  todaySnapshot: TodaySnapshot | null;
  /** True iff the caller is permitted to read admin endpoints. */
  adminVisible: boolean;
  /** Backend reachable on the last poll. */
  reachable: boolean;
}

@Injectable({ providedIn: 'root' })
export class WalletTelemetryService {

  private telemetry$ = new BehaviorSubject<WalletTelemetry>(this.empty());
  private pollSub: Subscription | null = null;

  constructor(private http: HttpClient) {}

  getTelemetry(): Observable<WalletTelemetry> { return this.telemetry$.asObservable(); }
  getSnapshot(): WalletTelemetry { return this.telemetry$.value; }

  startPolling(intervalMs = 30000): void {
    this.stopPolling();
    console.log(LOG_PREFIX, 'startPolling', intervalMs + 'ms');
    this.refresh();
    this.pollSub = interval(intervalMs).subscribe(() => this.refresh());
  }

  stopPolling(): void { this.pollSub?.unsubscribe(); this.pollSub = null; }

  refresh(): void {
    // forkJoin so all four panels reflect the same point-in-time
    // snapshot. Each call has its own catchError so an admin-only 403
    // doesn't poison the wallet card.
    forkJoin({
      myWallet: this.http.get<MyWallet>('wallet/me').pipe(
        timeout(10000),
        catchError(() => of(null)),
      ),
      topSpenders: this.http.get<{ items: TopSpender[] }>('admin/usage/top-spenders?hours=24&limit=5').pipe(
        timeout(10000),
        catchError(() => of(null)),
      ),
      dailyBurn: this.http.get<{ series: DailyBurnPoint[] }>('admin/usage/daily-burn?days=14').pipe(
        timeout(10000),
        catchError(() => of(null)),
      ),
      projected: this.http.get<ProjectedMonthly>('admin/usage/projected-monthly').pipe(
        timeout(10000),
        catchError(() => of(null)),
      ),
      todaySnapshot: this.http.get<TodaySnapshot>('admin/usage/today-snapshot').pipe(
        timeout(10000),
        catchError(() => of(null)),
      ),
    }).subscribe(({ myWallet, topSpenders, dailyBurn, projected, todaySnapshot }) => {
      const adminVisible = !!(topSpenders || dailyBurn || projected || todaySnapshot);
      const reachable = !!(myWallet || adminVisible);
      this.telemetry$.next({
        myWallet: myWallet || null,
        topSpenders: topSpenders?.items || [],
        dailyBurn: dailyBurn?.series || [],
        projected: projected || null,
        todaySnapshot: todaySnapshot || null,
        adminVisible,
        reachable,
      });
    });
  }

  private empty(): WalletTelemetry {
    return {
      myWallet: null,
      topSpenders: [],
      dailyBurn: [],
      projected: null,
      todaySnapshot: null,
      adminVisible: false,
      reachable: false,
    };
  }
}
