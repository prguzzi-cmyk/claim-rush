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

/**
 * Mission Log row — one entry per usage_event attributed to the
 * caller. Surfaced in the Operational Reserve panel as a personal
 * operational feed. Shape mirrors GET /v1/wallet/me/events.
 */
export interface MissionLogEvent {
  id: string;
  created_at: string | null;
  operation_type: string;
  vendor: string | null;
  source_system: string | null;
  lead_id: string | null;
  claim_id: string | null;
  estimated_cost_cents: number;
  actual_cost_cents: number | null;
  token_debit: number;
  quantity: number | null;
  territory: string | null;
  success: boolean | null;
  suppression_reason: string | null;
  note: string | null;
}

/**
 * One reward event row surfaced in the Bonus Achievements feed.
 * Sourced from GET /v1/wallet/me/monthly-summary.reward_events_month.
 * Credit amount is always positive (number of tokens awarded) and is
 * 0 when the reward catalog entry is still configured at 0.
 */
export interface RewardEvent {
  id: string;
  created_at: string | null;
  operation_type: string;
  credit_amount: number;
  note: string | null;
  vendor: string | null;
}

/**
 * UI-shaped snapshot of the caller's wallet rolled up over the current
 * calendar month. Backed by GET /v1/wallet/me/monthly-summary. All four
 * "this month" stats roll on the 1st of the month (UTC); the
 * `reward_catalog` carries the live admin-configured reward amounts so
 * the Bonus Achievements panel can render achievement values without
 * a separate fetch.
 */
export interface MonthlySummary {
  schema_pending: boolean;
  month_anchor: string;
  actor_role: string | null;
  balance: number;
  hard_limit_tokens: number | null;
  monthly_reserve: number | null;
  rewards_earned_month: number;
  usage_spent_month: number;
  bonus_credits_month: number;
  reward_events_month: RewardEvent[];
  reward_catalog: Record<string, number>;
  remaining_balance: number;
}

export interface WalletTelemetry {
  myWallet: MyWallet | null;
  topSpenders: TopSpender[];
  dailyBurn: DailyBurnPoint[];
  projected: ProjectedMonthly | null;
  todaySnapshot: TodaySnapshot | null;
  missionLog: MissionLogEvent[];
  /** Calendar-month rollup powering the Operational Reserve UI's
   *  rewards-earned / usage-spent / bonus-credits stat cluster. */
  monthly: MonthlySummary | null;
  /** True iff the caller is permitted to read admin endpoints. */
  adminVisible: boolean;
  /** Backend reachable on the last poll. */
  reachable: boolean;
}

/**
 * Reserve grant signal — emitted by the telemetry service when the
 * caller's wallet token_balance jumps upward between polls. Phase 3A
 * uses this to trigger the "+50,000 Credits granted" celebration
 * chip + strip pulse highlight in the Operational Reserve UI.
 *
 * `at` is the wall-clock ms timestamp so subscribers can collapse
 * duplicate emissions and auto-dismiss the chip after a window.
 */
export interface ReserveGrantSignal {
  amount: number;
  newBalance: number;
  at: number;
}

@Injectable({ providedIn: 'root' })
export class WalletTelemetryService {

  private telemetry$ = new BehaviorSubject<WalletTelemetry>(this.empty());
  private grant$ = new BehaviorSubject<ReserveGrantSignal | null>(null);
  private pollSub: Subscription | null = null;

  // Track the prior balance across polls so we can detect a positive
  // delta (= a grant landed). Null until the first poll lands.
  private lastSeenBalance: number | null = null;

  constructor(private http: HttpClient) {}

  getTelemetry(): Observable<WalletTelemetry> { return this.telemetry$.asObservable(); }
  /**
   * Emits a non-null signal exactly when the wallet's token_balance
   * increases between two polls. Resets to null after the consumer
   * acknowledges (via acknowledgeGrant()) or after the consumer's
   * own auto-dismiss window. The stream emits null on subscribe so
   * consumers don't replay a stale grant on view re-mount.
   */
  getRecentGrant(): Observable<ReserveGrantSignal | null> {
    return this.grant$.asObservable();
  }
  acknowledgeGrant(): void { this.grant$.next(null); }
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
      // Mission Log — caller-scoped, NOT admin-gated. Powers the
      // personal operational feed in the Operational Reserve panel.
      missionLog: this.http.get<{ items: MissionLogEvent[] }>('wallet/me/events?limit=20').pipe(
        timeout(10000),
        catchError(() => of(null)),
      ),
      // Phase 6 monthly rollup — feeds the rewards-earned-this-month /
      // usage-spent-this-month / Bonus Achievements feed sections of
      // the Operational Reserve panel. Caller-scoped, never admin-gated.
      monthly: this.http.get<MonthlySummary>('wallet/me/monthly-summary').pipe(
        timeout(10000),
        catchError(() => of(null)),
      ),
    }).subscribe(({ myWallet, topSpenders, dailyBurn, projected, todaySnapshot, missionLog, monthly }) => {
      const adminVisible = !!(topSpenders || dailyBurn || projected || todaySnapshot);
      const reachable = !!(myWallet || adminVisible || monthly);

      // Detect a positive balance delta — that's a grant landing.
      // Initial mount (lastSeenBalance===null) never fires; we only
      // celebrate transitions, never first-paint values.
      const newBal = myWallet?.token_balance ?? null;
      if (
        this.lastSeenBalance !== null
        && newBal !== null
        && newBal > this.lastSeenBalance
      ) {
        const delta = newBal - this.lastSeenBalance;
        this.grant$.next({ amount: delta, newBalance: newBal, at: Date.now() });
      }
      if (newBal !== null) this.lastSeenBalance = newBal;

      this.telemetry$.next({
        myWallet: myWallet || null,
        topSpenders: topSpenders?.items || [],
        dailyBurn: dailyBurn?.series || [],
        projected: projected || null,
        todaySnapshot: todaySnapshot || null,
        missionLog: missionLog?.items || [],
        monthly: monthly || null,
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
      missionLog: [],
      monthly: null,
      adminVisible: false,
      reachable: false,
    };
  }

  /**
   * Admin-only manual trigger for the Phase 3A monthly reserve grant
   * scanner. Calls POST /v1/admin/wallets/run-monthly-grants with
   * { force }. Triggers the celery task's logic synchronously; the
   * caller's wallet balance will bump on the next 30s telemetry
   * refresh, which the grant$ stream will detect and the UI will
   * celebrate. Returns the run summary.
   */
  runMonthlyGrants(force = false): Observable<{
    wallets_processed: number;
    wallets_skipped: number;
    wallets_failed: number;
    total_credits_granted: number;
    events_written: number;
    force: boolean;
  }> {
    return this.http.post<any>('admin/wallets/run-monthly-grants', { force });
  }
}
