import { Component, ElementRef, NgZone, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { Subscription, interval } from 'rxjs';
import { IncidentFeedService, NormalizedIncident } from 'src/app/services/incident-feed.service';
import { PlatformMetricsService, PlatformMetrics, AdjusterMetric } from 'src/app/services/platform-metrics.service';
import { PlatformActivityService, PlatformActivityEvent } from 'src/app/services/platform-activity.service';
import { EstimatingService } from 'src/app/services/estimating.service';
import { ClaimRecoveryEngineService } from 'src/app/shared/services/claim-recovery-engine.service';
import { ClaimOpportunityEngineService } from 'src/app/shared/services/claim-opportunity-engine.service';
import { GovernanceTelemetryService, GovernanceTelemetry, VendorUsageRow, TopOperator } from 'src/app/services/governance-telemetry.service';
import { WalletTelemetryService, WalletTelemetry, TopSpender, DailyBurnPoint, MissionLogEvent, ReserveGrantSignal, RewardEvent } from 'src/app/services/wallet-telemetry.service';
import { AgentTelemetryService, AgentSnapshot } from 'src/app/services/agent-telemetry.service';
import { IncidentPriority, IncidentPriorityService } from 'src/app/services/incident-priority.service';
import { PotentialClaimRow, ClaimOpportunity, OpportunityMetrics, PRIORITY_META, ACTION_META, SCORING_FACTOR_META, DEFAULT_SCORING_WEIGHTS } from 'src/app/shared/models/claim-opportunity.model';
import { ClaimRecoveryRecord, RecoveryDashboardMetrics, RECOVERY_STATUS_META, RecoveryStatus } from 'src/app/shared/models/claim-recovery-metrics.model';
import { MatSnackBar } from '@angular/material/snack-bar';

interface TickerEvent { emoji: string; text: string; }
interface KpiCard { label: string; value: number; icon: string; trend: 'up' | 'down' | 'flat'; change: number; color: string; }

@Component({
  selector: 'app-global-command-center',
  templateUrl: './global-command-center.component.html',
  styleUrls: ['./global-command-center.component.scss'],
  standalone: false,
})
export class GlobalCommandCenterComponent implements OnInit, OnDestroy {

  private subs: Subscription[] = [];
  loading = true;
  loadError: string | null = null;
  lastUpdated = '';

  tickerEvents: TickerEvent[] = [];
  incidents: NormalizedIncident[] = [];
  selectedIncident: NormalizedIncident | null = null;
  kpiCards: KpiCard[] = [];
  adjusterRows: AdjusterMetric[] = [];
  adjLeadsToday = 0; adjCallsCompleted = 0; adjIntakes = 0; adjSigned = 0; adjConvRate = 0;
  totalClaimsOpen = 0; totalRecoveryValue = 0; carrierTotal = 0; aciTotal = 0; recoveryGap = 0;
  recoveryBarData: any[] = [];
  colorScheme = { domain: ['#ff6d00', '#00e5ff'] };
  activityFeed: PlatformActivityEvent[] = [];

  // Claim Recovery Dashboard
  recoveryClaims: ClaimRecoveryRecord[] = [];
  recoverySortField: keyof ClaimRecoveryRecord = 'totalRecoveryAboveCarrier';
  recoverySortDir: 'asc' | 'desc' = 'desc';
  recoveryStatusMeta = RECOVERY_STATUS_META;

  // High Probability Claims
  highProbClaims: PotentialClaimRow[] = [];
  oppMinScore = 60;
  oppLoading = false;
  private oppPollSub: Subscription | null = null;

  // Claim Opportunity Intelligence
  opportunities: ClaimOpportunity[] = [];
  opportunityMetrics: OpportunityMetrics | null = null;
  priorityMeta = PRIORITY_META;
  actionMeta = ACTION_META;
  showAllOpportunities = false;
  selectedOpp: ClaimOpportunity | null = null;

  // Governance + Cost Telemetry (enrichment pipeline)
  governance: GovernanceTelemetry | null = null;
  governanceStages: { stage: string; row: VendorUsageRow }[] = [];
  governanceTopOperators: TopOperator[] = [];

  // Wallet + Token Economy
  wallet: WalletTelemetry | null = null;

  // Phase 3A — Reserve grant celebration. When the telemetry service
  // emits a positive balance delta, we surface a transient chip + a
  // brief strip glow. Auto-dismisses after 6s; subsequent grants
  // re-arm cleanly. activeGrant is null at rest.
  activeGrant: ReserveGrantSignal | null = null;
  private grantDismissTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Phase 3B: role-aware Operational Reserve ───────────────────────
  //
  // The same wallet/usage_event substrate drives four UI shapes:
  //   master  – super-admin / admin: full treasury + governance
  //   cp      – Community Partner:   territory reserve manager
  //   rvp     – Regional VP:         team execution scope (own + direct agents)
  //   agent   – Agent:               simple credits + actions, NO governance language
  //
  // The view choice flows from the wallet.actor_role the backend
  // already returns on /v1/wallet/me — no separate role fetch needed.
  // We default to 'master' when role is missing so the legacy view
  // continues to render for developers debugging without a wallet.

  // ── Dev-only role preview switcher ─────────────────────────────────
  //
  // Local-development affordance: lets an operator preview the CP /
  // RVP / Agent views without touching the DB, auth, or wallet
  // records. The override is purely a frontend display flip — every
  // backend call still uses the real session role. The switcher UI
  // is gated to `!environment.production` so it cannot ship to prod.
  //
  // The choice persists to sessionStorage so a page reload keeps the
  // preview in place during a single browser session, and clears
  // automatically when the tab closes.
  devPreviewRole: 'master' | 'cp' | 'rvp' | 'agent' | null = null;

  /** True only when the build is non-production. Drives *ngIf on the
   *  switcher UI so it never renders in a production bundle. */
  showDevPreviewSwitcher(): boolean { return !environment.production; }

  setDevPreviewRole(role: 'master' | 'cp' | 'rvp' | 'agent' | null): void {
    this.devPreviewRole = role;
    try {
      if (role) sessionStorage.setItem('devPreviewRole', role);
      else      sessionStorage.removeItem('devPreviewRole');
    } catch { /* private mode etc. — non-fatal */ }
  }

  /** Returns the active reserve view shape for the current caller.
   *  Dev override checked first; falls through to the backend-provided
   *  actor_role, then wallet_kind, then defaults to 'master'. */
  reserveView(): 'master' | 'cp' | 'rvp' | 'agent' {
    if (this.devPreviewRole) return this.devPreviewRole;
    const role = (this.wallet?.myWallet?.actor_role || '').toLowerCase();
    if (role === 'super-admin' || role === 'admin') return 'master';
    if (role === 'cp') return 'cp';
    if (role === 'rvp') return 'rvp';
    if (role === 'agent') return 'agent';
    // Wallet kinds for org/house singletons map to master by convention.
    const kind = (this.wallet?.myWallet?.wallet_kind || '').toLowerCase();
    if (kind === 'house' || kind === 'organization') return 'master';
    if (kind === 'cp') return 'cp';
    if (kind === 'rvp') return 'rvp';
    if (kind === 'agent') return 'agent';
    return 'master';
  }

  viewIsMaster(): boolean { return this.reserveView() === 'master'; }
  viewIsCp():     boolean { return this.reserveView() === 'cp'; }
  viewIsRvp():    boolean { return this.reserveView() === 'rvp'; }
  viewIsAgent():  boolean { return this.reserveView() === 'agent'; }

  /**
   * Progressive-simplification vocabulary map. The user-facing
   * "Operational Reserve / Intelligence Credits / Team Credits /
   * Credits" gradient is configured exactly once here, and every
   * label in the panel reads through this lookup.
   */
  private static readonly VOCAB: Record<
    'master' | 'cp' | 'rvp' | 'agent',
    { eyebrow: string; credits: string; tier: string | null; modeLabel: string | null; missionTitle: string }
  > = {
    master: { eyebrow: 'Operational Reserve', credits: 'Intelligence Credits', tier: 'Member Tier', modeLabel: 'Operating Mode', missionTitle: 'Mission Log' },
    cp:     { eyebrow: 'Territory Reserve',   credits: 'Intelligence Credits', tier: 'CP Tier',     modeLabel: 'Operating Mode', missionTitle: 'Mission Log' },
    rvp:    { eyebrow: 'Team Credits',        credits: 'Team Credits',         tier: 'Team Tier',   modeLabel: null,             missionTitle: 'Recent Funded Actions' },
    agent:  { eyebrow: 'Credits',             credits: 'Credits',              tier: null,          modeLabel: null,             missionTitle: 'Recent Activity' },
  };

  vocabEyebrow():      string         { return GlobalCommandCenterComponent.VOCAB[this.reserveView()].eyebrow; }
  vocabCredits():      string         { return GlobalCommandCenterComponent.VOCAB[this.reserveView()].credits; }
  vocabTier():         string | null  { return GlobalCommandCenterComponent.VOCAB[this.reserveView()].tier; }
  vocabModeLabel():    string | null  { return GlobalCommandCenterComponent.VOCAB[this.reserveView()].modeLabel; }
  vocabMissionTitle(): string         { return GlobalCommandCenterComponent.VOCAB[this.reserveView()].missionTitle; }

  /**
   * Per-role visibility rules. Centralizing as boolean getters keeps
   * the template *ngIf cascade readable.
   */
  showStripTierChip():      boolean { return !this.viewIsAgent(); }
  showProjectedCard():      boolean { return this.viewIsMaster(); }
  showTopOperatorsCard():   boolean { return this.viewIsMaster(); }
  showProviderWarning():    boolean { return this.viewIsMaster() || this.viewIsCp(); }
  showModeChip():           boolean { return this.viewIsMaster() || this.viewIsCp(); }
  showMissionLog():         boolean { return !this.viewIsAgent(); }   // master/cp/rvp see it (rvp filtered to successful)
  showTierBlock():          boolean { return !this.viewIsAgent(); }
  showProjectedThroughput():boolean { return this.viewIsMaster(); }
  showSparkline():          boolean { return this.viewIsMaster() || this.viewIsCp(); }
  showDownlineCard():       boolean { return this.viewIsCp(); }
  showTeamAgentCard():      boolean { return this.viewIsRvp(); }
  showAgentActions():       boolean { return this.viewIsAgent(); }

  /** Master / CP narrative is unchanged. RVP only renders success rows.
   *  Agent doesn't see the log at all. */
  filteredMissionLog(): MissionLogEvent[] {
    const all = this.missionLogEvents();
    if (this.viewIsRvp()) {
      return all.filter(e => e.success === true || e.operation_type === 'RESERVE_GRANT');
    }
    return all;
  }

  // ── Phase 6: monthly rollup accessors ──────────────────────────────
  // Backed by GET /v1/wallet/me/monthly-summary. Helpers stay defensive
  // — every getter returns 0 / [] / "" rather than null so the template
  // can bind unconditionally without *ngIf gymnastics on each value.
  rewardsEarnedMonth(): number {
    return this.wallet?.monthly?.rewards_earned_month ?? 0;
  }
  usageSpentMonth(): number {
    return this.wallet?.monthly?.usage_spent_month ?? 0;
  }
  bonusCreditsMonth(): number {
    return this.wallet?.monthly?.bonus_credits_month ?? 0;
  }
  rewardEventsMonth(): RewardEvent[] {
    return this.wallet?.monthly?.reward_events_month || [];
  }
  /** Clarity polish: ceiling-style cap for the wallet (null when no
   *  cap is configured — free-tier / uncapped wallets). Sourced from
   *  monthly_reserve first (= hard_limit_tokens server-side), with a
   *  fallback to the direct myWallet field so the card surfaces a
   *  number on first paint before the monthly summary has landed. */
  monthlyReserveCap(): number | null {
    const fromMonthly = this.wallet?.monthly?.monthly_reserve;
    if (typeof fromMonthly === 'number') return fromMonthly;
    const fromWallet = this.wallet?.myWallet?.hard_limit_tokens;
    return typeof fromWallet === 'number' ? fromWallet : null;
  }
  rewardCatalogAmount(eventType: string): number {
    const catalog = this.wallet?.monthly?.reward_catalog || {};
    return Number(catalog[eventType] ?? 0);
  }
  /** Humanize the operation_type slug into a display name. */
  rewardEventLabel(operationType: string): string {
    const map: Record<string, string> = {
      'reward.onboarding_started':   'Onboarding Started',
      'reward.onboarding_completed': 'Onboarding Completed',
      'reward.claim_signed':         'Claim Signed',
      'reward.claim_closed':         'Claim Closed',
      'reward.recruit_paid':         'Recruit Activated',
      'reward.training_passed':      'Training Certified',
      'reward.monthly_goal_hit':     'Monthly Goal Achieved',
    };
    if (map[operationType]) return map[operationType];
    // Fallback: strip 'reward.' and Title Case the rest.
    return operationType
      .replace(/^reward\./, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  /** Rail color: admin-bonus is gold, reward-engine is teal. */
  rewardEventColor(evt: RewardEvent): string {
    return evt.vendor === 'admin' ? '#ffb300' : '#00e5ff';
  }
  /** Compact local time label for the achievements feed. */
  rewardEventTimeLabel(ts: string | null): string {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  // ── Phase 3B-3: mock downline/team data (replaced by API in 3B-5) ──
  // Static, role-flavored placeholders. Shape matches the future
  // GET /v1/wallet/me/downline-summary response so the swap is a
  // single fetch wire-up.
  mockDownlineRows(): { name: string; role: string; used: number; capacity: number; status: 'healthy' | 'warning' | 'low' }[] {
    return [
      { name: 'Maria Cruz',        role: 'RVP',   used:  9_200, capacity: 15_000, status: 'healthy' },
      { name: 'James Reyes',       role: 'RVP',   used: 13_400, capacity: 15_000, status: 'warning' },
      { name: 'Lisa Park',         role: 'AGENT', used:  4_100, capacity:  5_000, status: 'warning' },
      { name: 'Andre Thompson',    role: 'AGENT', used:  1_800, capacity:  5_000, status: 'healthy' },
      { name: 'Tara Whitfield',    role: 'AGENT', used:  4_950, capacity:  5_000, status: 'low' },
    ];
  }
  mockTeamAgentRows(): { name: string; used: number; capacity: number; funded_actions: number; leads_signed: number }[] {
    return [
      { name: 'Daniela Ortiz',   used: 3_800, capacity: 5_000, funded_actions: 142, leads_signed: 4 },
      { name: 'Marcus Lee',      used: 4_950, capacity: 5_000, funded_actions: 198, leads_signed: 7 },
      { name: 'Priya Shah',      used: 1_650, capacity: 5_000, funded_actions:  62, leads_signed: 1 },
      { name: 'Kevin Walters',   used: 2_400, capacity: 5_000, funded_actions:  98, leads_signed: 3 },
    ];
  }
  downlineStatusColor(s: 'healthy' | 'warning' | 'low'): string {
    if (s === 'low')     return '#ff8896';
    if (s === 'warning') return '#ffb300';
    return '#00e676';
  }
  pctUsed(used: number, cap: number): number {
    if (!cap) return 0;
    return Math.min(100, Math.round((used / cap) * 100));
  }

  // ── Phase 3B-4: agent action buttons (optimistic, no real dispatch) ──
  // Per product decision: portal must feel operational. Buttons are
  // wired with an optimistic "processing" → "completed" microflow that
  // briefly decrements the displayed balance + emits a synthetic
  // Mission-Log-style toast. NO real backend dispatch happens here;
  // that arrives in Phase 3C (wire to skip-trace / SMS / voice / email
  // endpoints with real wallet_check + debit_tokens).
  agentActions: { key: string; label: string; credits: number; icon: string; descriptor: string }[] = [
    { key: 'skip_trace',   label: 'Skip Trace',   credits: 1, icon: 'search',         descriptor: 'Find the owner of a property' },
    { key: 'sms',          label: 'SMS',          credits: 1, icon: 'sms',            descriptor: 'Send a single text to a lead' },
    { key: 'ai_voice',     label: 'AI Voice Call',credits: 5, icon: 'phone_in_talk',  descriptor: 'Place an AI-driven outreach call' },
    { key: 'email',        label: 'Email',        credits: 0, icon: 'mail',           descriptor: 'Send a quick email (no credits)' },
  ];
  /** Action key currently mid-dispatch, or null when idle. */
  agentActionInFlight: string | null = null;
  /** Last action result narrative, displayed briefly under the buttons. */
  agentActionFlash: { text: string; color: string } | null = null;
  private agentFlashTimer: ReturnType<typeof setTimeout> | null = null;

  agentBalance(): number {
    return this.wallet?.myWallet?.token_balance || 0;
  }
  /** True when the wallet can fund the action (or the action is free). */
  canAffordAgentAction(a: { credits: number }): boolean {
    return a.credits === 0 || this.agentBalance() >= a.credits;
  }

  /**
   * Phase 8 / Pass 2 — REAL action dispatch.
   *
   *   1. Block double-click via `agentActionInFlight`.
   *   2. Cheap client-side pre-check (visible wallet vs. cost) so we
   *      don't waste a roundtrip on obvious insufficient-credit cases.
   *   3. POST /v1/agents/me/actions/<slug>. The service normalizes
   *      success and 4xx/5xx into one chip shape — we never throw.
   *   4. Success: optimistically patch the visible wallet balance from
   *      the response, then force a wallet refresh to reconcile.
   *   5. Failure: surface the operational message verbatim. No fake
   *      success, no wallet debit (the backend never debited).
   */
  triggerAgentAction(action: { key: string; label: string; credits: number }): void {
    if (this.agentActionInFlight) return;
    if (!this.canAffordAgentAction(action)) {
      this.flashAgentAction(`Not enough credits for ${action.label}.`, '#ff8896');
      return;
    }
    const key = action.key as 'skip_trace' | 'sms' | 'ai_voice' | 'email';
    this.agentActionInFlight = action.key;
    this.agentTelemetry.triggerAction(key).subscribe(result => {
      this.agentActionInFlight = null;
      // Patch the visible balance immediately so the HUD reflects the
      // real outcome (debited on success, untouched on 503 / 402).
      if (typeof result.newBalance === 'number' && this.wallet?.myWallet) {
        this.wallet = {
          ...this.wallet,
          myWallet: { ...this.wallet.myWallet, token_balance: result.newBalance },
        };
      }
      if (result.ok) {
        this.flashAgentAction(result.message, '#00e676');
        // Reconcile via the canonical wallet endpoint and refresh
        // the agent snapshot so the new operation lands in cards.
        this.walletTelemetry.refresh();
        this.agentTelemetry.refresh();
        return;
      }
      // Honest failure narrative. The color hint differentiates
      // "provider offline" (yellow/amber) from "denied" (red).
      const isProviderOff = result.httpStatus === 503;
      const color = isProviderOff ? '#ffb300' : '#ff8896';
      this.flashAgentAction(result.message, color);
    });
  }

  private flashAgentAction(text: string, color: string): void {
    if (this.agentFlashTimer) clearTimeout(this.agentFlashTimer);
    this.agentActionFlash = { text, color };
    this.agentFlashTimer = setTimeout(() => {
      this.agentActionFlash = null;
      this.agentFlashTimer = null;
    }, 3500);
  }

  // Refresh timestamps for the executive treasury zone — replaces the
  // "Live" pulse chips with quiet "updated Ns ago" copy.
  governanceLastRefreshAt: number | null = null;
  walletLastRefreshAt: number | null = null;

  // ── Contextual focus state ───────────────────────────────────────
  // Bound to the root .gcc-dark via [class.gcc-dark--treasury-focus].
  // Driven by an IntersectionObserver over the .executive-suite
  // section: when the user scrolls the treasury into significant view
  // (≥40% visible) the dispatch chrome recedes; when they scroll past
  // it (≤15% visible) the page returns to operational command mode.
  // Hysteresis prevents flicker around the threshold.
  treasuryFocus = false;
  private treasuryObserver: IntersectionObserver | null = null;
  private treasuryEl: ElementRef | null = null;

  @ViewChild('executiveSuiteEl', { static: false })
  set executiveSuiteEl(el: ElementRef | undefined) {
    // *ngIf="governance || wallet" — element appears asynchronously
    // after the first poll. Setter fires when it does.
    if (!el) {
      this.treasuryEl = null;
      return;
    }
    this.treasuryEl = el;
    if (!this.treasuryObserver) this.attachTreasuryObserver();
  }

  // Incident priority filter chips — single source of truth that
  // governs map, ticker, KPI counts, and right-side feed.
  // Defaults: HIGH + MEDIUM on, LOW off (no dispatch noise).
  priorityFilters: { high: boolean; medium: boolean; low: boolean } = {
    high: true, medium: true, low: false,
  };
  filteredIncidents: NormalizedIncident[] = [];
  filteredActivityFeed: PlatformActivityEvent[] = [];
  priorityCounts: { high: number; medium: number; low: number; total: number } = { high: 0, medium: 0, low: 0, total: 0 };

  constructor(
    private incidentFeed: IncidentFeedService,
    private platformMetrics: PlatformMetricsService,
    private platformActivity: PlatformActivityService,
    private estimatingService: EstimatingService,
    private recoveryEngine: ClaimRecoveryEngineService,
    private claimOpportunity: ClaimOpportunityEngineService,
    private governanceTelemetry: GovernanceTelemetryService,
    private walletTelemetry: WalletTelemetryService,
    private incidentPriority: IncidentPriorityService,
    private agentTelemetry: AgentTelemetryService,
    private ngZone: NgZone,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  // ── Phase 8: real-data snapshot for the Agent Workspace ──────────
  //
  // Populated by AgentTelemetryService polling the 6 /v1/agents/me/*
  // endpoints. Component getters below read from this snapshot; when
  // a field is null OR has_data is false, the matching card renders
  // its empty-state in the template.
  agentSnapshot: AgentSnapshot | null = null;

  ngOnInit(): void {
    console.log('[GlobalCC] ngOnInit → starting services');
    // Restore any in-session dev-preview role override.
    try {
      const stored = sessionStorage.getItem('devPreviewRole');
      if (stored && ['master', 'cp', 'rvp', 'agent'].includes(stored)) {
        this.devPreviewRole = stored as 'master' | 'cp' | 'rvp' | 'agent';
      }
    } catch { /* non-fatal */ }

    // Restore the welcome-line dismiss state for this tab.
    this.ngOnInitWelcomeRestore();

    this.incidentFeed.startPolling(30000);
    this.platformMetrics.startPolling(30000);
    this.platformActivity.startPolling(10000);

    // Safety timeout: force loading=false after 12s to prevent endless spinner
    setTimeout(() => {
      if (this.loading) {
        console.warn('[GlobalCC] loading timeout — forcing ready state');
        this.loading = false;
        this.loadError = 'Data services are slow to respond. Some panels may show partial data.';
      }
    }, 12000);

    this.subs.push(this.incidentFeed.getIncidents().subscribe(incidents => {
      this.incidents = incidents;
      this.recomputeFilteredViews();
      this.lastUpdated = new Date().toLocaleTimeString();
      this.loading = false;
      this.loadError = null;
    }));

    this.subs.push(this.platformMetrics.getMetrics().subscribe(m => {
      this.kpiCards = this.buildKpiCards(m);
    }));

    this.subs.push(this.platformMetrics.getAdjusters().subscribe(adj => {
      this.adjusterRows = adj;
      this.adjLeadsToday = adj.reduce((s, a) => s + a.leads_assigned, 0);
      this.adjCallsCompleted = adj.reduce((s, a) => s + a.calls_completed, 0);
      this.adjIntakes = adj.reduce((s, a) => s + a.intakes_completed, 0);
      this.adjSigned = adj.reduce((s, a) => s + a.claims_signed, 0);
      this.adjConvRate = this.adjLeadsToday > 0 ? Math.round((this.adjSigned / this.adjLeadsToday) * 100) : 0;
    }));

    this.subs.push(this.platformActivity.getEvents().subscribe(events => {
      this.activityFeed = events;
      this.recomputeFilteredViews();
    }));

    this.loadRecovery();
    this.loadHighProbClaims();
    this.oppPollSub = interval(30000).subscribe(() => this.loadHighProbClaims());

    // Claim Opportunity Intelligence
    this.claimOpportunity.startPolling(60000);
    this.subs.push(
      this.claimOpportunity.getOpportunities().subscribe(opps => {
        this.opportunities = opps;
        this.opportunityMetrics = this.claimOpportunity.computeMetrics(opps);
      })
    );

    // Governance + Cost Telemetry — operator visibility into the
    // enrichment cost-governance gate (mode, daily budget, suppressed
    // counts, top spending operators). Auth-gated; while logged out
    // the panel renders as "Backend unreachable" and stays harmless.
    this.governanceTelemetry.startPolling(30000);
    this.subs.push(
      this.governanceTelemetry.getTelemetry().subscribe(t => {
        this.governance = t;
        this.governanceStages = Object.entries(t.vendor_usage_by_stage || {})
          .map(([stage, row]) => ({ stage, row }))
          .sort((a, b) => b.row.spend_cents - a.row.spend_cents);
        this.governanceTopOperators = t.top_operators || [];
        if (t.reachable) this.governanceLastRefreshAt = Date.now();
      })
    );

    // Wallet + Token Economy — caller's wallet snapshot plus admin
    // roll-ups (top spenders, daily burn, projected monthly). Admin
    // sections gracefully hide for non-admin viewers (403 → empty).
    this.walletTelemetry.startPolling(30000);
    this.subs.push(
      this.walletTelemetry.getTelemetry().subscribe(t => {
        this.wallet = t;
        if (t.reachable) this.walletLastRefreshAt = Date.now();
      })
    );
    // Phase 8 — Agent Workspace real-data poller. Fires immediately
    // and then every 30s. The endpoints 401-silently when logged out
    // so the panel just stays in its empty-state until auth lands.
    this.agentTelemetry.startPolling(30_000);
    this.subs.push(
      this.agentTelemetry.getSnapshot().subscribe(snap => {
        this.agentSnapshot = snap;
      })
    );

    // Phase 3A — listen for reserve-grant signals. The service emits
    // a non-null signal exactly when token_balance jumps upward
    // between two polls. We celebrate, then auto-dismiss after 6s.
    this.subs.push(
      this.walletTelemetry.getRecentGrant().subscribe(g => {
        if (!g) return;
        this.activeGrant = g;
        if (this.grantDismissTimer) clearTimeout(this.grantDismissTimer);
        this.grantDismissTimer = setTimeout(() => {
          this.activeGrant = null;
          this.walletTelemetry.acknowledgeGrant();
          this.grantDismissTimer = null;
        }, 6000);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.oppPollSub?.unsubscribe();
    this.incidentFeed.stopPolling();
    this.platformMetrics.stopPolling();
    this.platformActivity.stopPolling();
    this.claimOpportunity.stopPolling();
    this.governanceTelemetry.stopPolling();
    this.walletTelemetry.stopPolling();
    this.agentTelemetry.stopPolling();
    this.treasuryObserver?.disconnect();
    this.treasuryObserver = null;
    if (this.grantDismissTimer) {
      clearTimeout(this.grantDismissTimer);
      this.grantDismissTimer = null;
    }
    if (this.agentFlashTimer) {
      clearTimeout(this.agentFlashTimer);
      this.agentFlashTimer = null;
    }
  }

  /**
   * Stand up an IntersectionObserver on the executive-suite section.
   * Runs the visibility callback inside Angular's zone so the class
   * binding actually re-renders.
   *
   * Hysteresis — enter at 40% visible, exit at 15%. Multiple
   * thresholds let the observer fire frequently enough that the
   * transition matches the user's scroll position smoothly.
   */
  private attachTreasuryObserver(): void {
    if (!this.treasuryEl?.nativeElement) return;
    if (typeof IntersectionObserver === 'undefined') return;  // SSR / very old browser

    this.treasuryObserver = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        const ratio = entry?.intersectionRatio ?? 0;
        let next = this.treasuryFocus;
        if (this.treasuryFocus) {
          if (ratio < 0.15) next = false;
        } else {
          if (entry?.isIntersecting && ratio >= 0.40) next = true;
        }
        if (next === this.treasuryFocus) return;
        this.ngZone.run(() => { this.treasuryFocus = next; });
      },
      { threshold: [0, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0] },
    );
    this.treasuryObserver.observe(this.treasuryEl.nativeElement);
  }

  private loadRecovery(): void {
    this.estimatingService.getClaimRecoveryDashboard().subscribe({
      next: (data: any) => {
        if (data) {
          const e = this.recoveryEngine.enrichDashboardData(data);
          this.totalClaimsOpen = e.totalClaimsActive; this.totalRecoveryValue = e.totalRecovered;
          this.carrierTotal = e.totalCarrierEstimates; this.aciTotal = e.totalAciEstimates;
          this.recoveryClaims = e.claims;
        } else { this.setMockRecovery(); }
        this.recoveryGap = Math.max(this.aciTotal - this.carrierTotal, 0);
        this.recoveryBarData = [{ name: 'Carrier Estimate', value: this.carrierTotal }, { name: 'ACI Estimate', value: this.aciTotal }];
        this.sortRecoveryClaims();
      },
      error: () => { this.setMockRecovery(); this.recoveryBarData = [{ name: 'Carrier Estimate', value: 1890000 }, { name: 'ACI Estimate', value: 3240000 }]; this.sortRecoveryClaims(); },
    });
  }

  private setMockRecovery(): void {
    this.totalClaimsOpen = 34; this.totalRecoveryValue = 2840000; this.carrierTotal = 1890000; this.aciTotal = 3240000; this.recoveryGap = 1350000;
    this.recoveryClaims = this.getMockRecoveryClaims();
  }

  private getMockRecoveryClaims(): ClaimRecoveryRecord[] {
    return [
      { claimId: 'c1', projectId: 'p1', claimNumber: 'CLM-2025-0102', clientName: 'Robert Chen', carrierName: 'State Farm', assignedAdjusterId: 'a1', assignedAdjusterName: 'Mike Torres', carrierEstimateTotal: 42300, aciEstimateTotal: 68500, supplementRequestedTotal: 26200, supplementRecoveredTotal: 18400, carrierPaidTotal: 60700, totalRecoveryAboveCarrier: 18400, remainingRecoverable: 7800, recoveryPercent: 88.6, recoveryStatus: 'partial_payment', claimPhase: 'supplement_requested', createdAt: '2025-01-15T10:00:00Z', lastPaymentDate: '2025-03-01T14:00:00Z' },
      { claimId: 'c2', projectId: 'p2', claimNumber: 'CLM-2025-0118', clientName: 'Maria Gonzalez', carrierName: 'Allstate', assignedAdjusterId: 'a2', assignedAdjusterName: 'Sarah Kim', carrierEstimateTotal: 28900, aciEstimateTotal: 52400, supplementRequestedTotal: 23500, supplementRecoveredTotal: 0, carrierPaidTotal: 28900, totalRecoveryAboveCarrier: 0, remainingRecoverable: 23500, recoveryPercent: 55.2, recoveryStatus: 'supplement_requested', claimPhase: 'supplement_requested', createdAt: '2025-01-22T08:00:00Z', lastPaymentDate: null },
      { claimId: 'c3', projectId: 'p3', claimNumber: 'CLM-2025-0134', clientName: 'David Thompson', carrierName: 'USAA', assignedAdjusterId: 'a1', assignedAdjusterName: 'Mike Torres', carrierEstimateTotal: 85200, aciEstimateTotal: 124800, supplementRequestedTotal: 39600, supplementRecoveredTotal: 39600, carrierPaidTotal: 124800, totalRecoveryAboveCarrier: 39600, remainingRecoverable: 0, recoveryPercent: 100, recoveryStatus: 'fully_recovered', claimPhase: 'closed', createdAt: '2025-02-01T09:30:00Z', lastPaymentDate: '2025-03-10T11:00:00Z' },
      { claimId: 'c4', projectId: 'p4', claimNumber: 'CLM-2025-0147', clientName: 'Jennifer Adams', carrierName: 'Nationwide', assignedAdjusterId: 'a3', assignedAdjusterName: 'James Rivera', carrierEstimateTotal: 15600, aciEstimateTotal: 31200, supplementRequestedTotal: 15600, supplementRecoveredTotal: 8200, carrierPaidTotal: 23800, totalRecoveryAboveCarrier: 8200, remainingRecoverable: 7400, recoveryPercent: 76.3, recoveryStatus: 'negotiation', claimPhase: 'negotiation', createdAt: '2025-02-10T14:00:00Z', lastPaymentDate: '2025-03-05T16:00:00Z' },
      { claimId: 'c5', projectId: 'p5', claimNumber: 'CLM-2025-0156', clientName: 'Patricia Williams', carrierName: 'Progressive', assignedAdjusterId: 'a2', assignedAdjusterName: 'Sarah Kim', carrierEstimateTotal: 62400, aciEstimateTotal: 89600, supplementRequestedTotal: 27200, supplementRecoveredTotal: 27200, carrierPaidTotal: 89600, totalRecoveryAboveCarrier: 27200, remainingRecoverable: 0, recoveryPercent: 100, recoveryStatus: 'fully_recovered', claimPhase: 'closed', createdAt: '2025-02-15T11:30:00Z', lastPaymentDate: '2025-03-12T09:00:00Z' },
      { claimId: 'c6', projectId: 'p6', claimNumber: 'CLM-2025-0163', clientName: 'William Brown', carrierName: 'Farmers', assignedAdjusterId: 'a3', assignedAdjusterName: 'James Rivera', carrierEstimateTotal: 34800, aciEstimateTotal: 58900, supplementRequestedTotal: 24100, supplementRecoveredTotal: 0, carrierPaidTotal: 34800, totalRecoveryAboveCarrier: 0, remainingRecoverable: 24100, recoveryPercent: 59.1, recoveryStatus: 'carrier_review', claimPhase: 'carrier_review', createdAt: '2025-02-20T10:00:00Z', lastPaymentDate: null },
      { claimId: 'c7', projectId: 'p7', claimNumber: 'CLM-2025-0178', clientName: 'Amanda Rodriguez', carrierName: 'Liberty Mutual', assignedAdjusterId: 'a1', assignedAdjusterName: 'Mike Torres', carrierEstimateTotal: 21500, aciEstimateTotal: 45200, supplementRequestedTotal: 23700, supplementRecoveredTotal: 12800, carrierPaidTotal: 34300, totalRecoveryAboveCarrier: 12800, remainingRecoverable: 10900, recoveryPercent: 75.9, recoveryStatus: 'partial_payment', claimPhase: 'supplement_requested', createdAt: '2025-02-28T13:00:00Z', lastPaymentDate: '2025-03-14T15:00:00Z' },
      { claimId: 'c8', projectId: 'p8', claimNumber: 'CLM-2025-0189', clientName: 'Thomas Wright', carrierName: 'Travelers', assignedAdjusterId: 'a2', assignedAdjusterName: 'Sarah Kim', carrierEstimateTotal: 48700, aciEstimateTotal: 72100, supplementRequestedTotal: 23400, supplementRecoveredTotal: 0, carrierPaidTotal: 0, totalRecoveryAboveCarrier: 0, remainingRecoverable: 72100, recoveryPercent: 0, recoveryStatus: 'estimating', claimPhase: 'estimating', createdAt: '2025-03-05T08:00:00Z', lastPaymentDate: null },
    ];
  }

  private buildTicker(incidents: NormalizedIncident[]): TickerEvent[] {
    const em: Record<string, string> = { fire: '🔥', hail: '🧊', wind: '🌪', lightning: '⚡', crime: '🚓', tornado: '🌪', hurricane: '🌀' };
    // Prefer the real call_type_description (e.g. "Smoke Investigation")
    // over the family label so the ticker reads like the dispatch
    // record, not a cartoon.
    const familyLabel: Record<string, string> = { fire: 'Fire', hail: 'Hail Impact', wind: 'Wind Damage', lightning: 'Lightning Strike', crime: 'Break-in / Vandalism', tornado: 'Tornado', hurricane: 'Hurricane' };
    return incidents.slice(0, 20).map(i => {
      const label = i.call_type_description || familyLabel[i.type] || i.type;
      return {
        emoji: em[i.type] || '⚠️',
        text: `${label} – ${i.city || ''} ${i.state || ''} – ${this.timeAgo(i.timestamp)}`,
      };
    });
  }

  private buildKpiCards(m: PlatformMetrics): KpiCard[] {
    // "Property Fires Today" = HIGH-priority property-loss fires only.
    // We deliberately ignore m.fires_today (raw PulsePoint count) so
    // the KPI matches the same priority gate as the map / ticker / feed.
    const highFires = (this.incidents || []).filter(
      i => i.type === 'fire' && i.priority === 'high',
    ).length;
    // Refined palette — desaturated from the original neon. Still
    // distinguishable per KPI but less "casino" / "battle mode".
    return [
      { label: 'Property Fires Today', value: highFires,             icon: 'local_fire_department', trend: 'up', change: 3,  color: '#e11d48' },
      { label: 'Storm Damage Events',  value: m.storm_events_today,  icon: 'thunderstorm',          trend: 'up', change: 5,  color: '#3b82f6' },
      { label: 'Potential Claims',     value: m.potential_claims,    icon: 'bolt',                  trend: 'up', change: 8,  color: '#eab308' },
      { label: 'New Leads Generated',  value: m.new_leads_today,     icon: 'person_add',            trend: 'up', change: 12, color: '#10b981' },
      { label: 'Leads Contacted',      value: m.leads_contacted,     icon: 'phone_in_talk',         trend: 'up', change: 7,  color: '#22d3ee' },
      { label: 'Leads Converted',      value: m.leads_converted,     icon: 'verified',              trend: 'up', change: 4,  color: '#a855f7' },
    ];
  }

  // ── Priority filter chips (single source of truth) ─────────────
  togglePriority(p: 'high' | 'medium' | 'low'): void {
    this.priorityFilters[p] = !this.priorityFilters[p];
    // Disabling the last enabled chip would blank every panel; keep
    // at least one tier on at all times.
    if (!this.priorityFilters.high && !this.priorityFilters.medium && !this.priorityFilters.low) {
      this.priorityFilters[p] = true;
    }
    this.recomputeFilteredViews();
  }

  selectAllPriorities(): void {
    this.priorityFilters = { high: true, medium: true, low: true };
    this.recomputeFilteredViews();
  }

  isPriorityActive(p: 'high' | 'medium' | 'low'): boolean {
    return !!this.priorityFilters[p];
  }

  isAllActive(): boolean {
    return this.priorityFilters.high && this.priorityFilters.medium && this.priorityFilters.low;
  }

  private recomputeFilteredViews(): void {
    // ── Filter the incident set (drives map + ticker + KPI) ──
    this.filteredIncidents = this.incidentPriority.filterByPriority(
      this.incidents, this.priorityFilters,
    );

    // ── Refresh ticker from the filtered list ──
    this.tickerEvents = this.buildTicker(this.filteredIncidents);

    // ── Refresh KPI cards (Property Fires Today reads filtered) ──
    if (this.platformMetrics) {
      this.kpiCards = this.buildKpiCards(this.platformMetrics.getMetricsSnapshot());
    }

    // ── Filter the right-side activity feed ──
    // PlatformActivityEvent doesn't carry call_type; for fire_incident
    // events we infer priority from title/detail via the SAME
    // IncidentPriorityService. Non-incident events (lead_created,
    // claim_opened, voice_call, etc.) always pass through — they're
    // operational signal, not dispatch traffic.
    this.filteredActivityFeed = (this.activityFeed || []).filter(ev => {
      if (ev.event_type !== 'fire_incident'
          && ev.event_type !== 'storm_incident'
          && ev.event_type !== 'crime_incident') return true;
      const tier = this.incidentPriority.priorityFor({
        type: ev.event_type, title: ev.title, detail: ev.detail,
      });
      if (tier === 'high'    && this.priorityFilters.high)    return true;
      if (tier === 'medium'  && this.priorityFilters.medium)  return true;
      if (tier === 'low'     && this.priorityFilters.low)     return true;
      if (tier === 'unknown' && this.priorityFilters.low)     return true;
      return false;
    });

    // ── Update the chip-row counters ──
    const counts = { high: 0, medium: 0, low: 0, total: this.incidents.length };
    for (const i of this.incidents) {
      if (i.priority === 'high')   counts.high++;
      else if (i.priority === 'medium') counts.medium++;
      else counts.low++;
    }
    this.priorityCounts = counts;
  }

  priorityChipColor(p: 'high' | 'medium' | 'low'): string {
    return this.incidentPriority.colorFor(p);
  }

  selectIncident(m: NormalizedIncident): void { this.selectedIncident = m; }
  closeIncidentPanel(): void { this.selectedIncident = null; }
  getMarkerColor(type: string): string {
    const c: Record<string, string> = { fire: '#ff1744', hail: '#2979ff', wind: '#ff6d00', lightning: '#ffd600', tornado: '#ff1744', hurricane: '#7c4dff', crime: '#aa00ff' };
    return c[type] || '#00e5ff';
  }
  getLeadStatusLabel(s: string): string { return ({ not_contacted: 'Not Contacted', contacted: 'Contacted', converted: 'Converted' } as any)[s] || s; }
  getLeadStatusClass(s: string): string { return s === 'converted' ? 'status-converted' : s === 'contacted' ? 'status-contacted' : 'status-not-contacted'; }
  nav(route: string): void { this.router.navigate([route]); }
  fmtCurrency(v: number): string { return v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'K' : '$' + v.toLocaleString(); }
  timeAgo(ts: string): string { const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`; }

  navigateToEvent(item: PlatformActivityEvent): void {
    const routeMap: Record<string, string> = {
      fire_incident: '/app/fire-incidents',
      lead_created: '/app/leads',
      skip_trace_completed: '/app/leads',
      voice_call: '/app/voice-campaigns',
      claim_opened: '/app/claims',
    };
    const route = routeMap[item.event_type];
    if (route) { this.router.navigate([route]); }
  }

  // ── High Probability Claims ────────────────────────────────────
  loadHighProbClaims(): void {
    this.oppLoading = true;
    this.claimOpportunity.getHighProbabilityClaims(this.oppMinScore).subscribe({
      next: (claims) => { this.highProbClaims = claims; this.oppLoading = false; },
      error: () => { this.oppLoading = false; },
    });
  }

  onOppScoreChange(value: any): void {
    this.oppMinScore = +value;
    this.loadHighProbClaims();
  }

  generateLead(claimId: string): void {
    this.claimOpportunity.generateLead(claimId).subscribe({
      next: (res) => {
        this.highProbClaims = this.highProbClaims.filter(c => c.id !== claimId);
        this.snackBar.open(
          `Lead created — ${res.assigned_agents_count} agent(s) assigned in ${res.territory_name}`,
          'OK', { duration: 4000 }
        );
      },
      error: () => { this.snackBar.open('Failed to generate lead', 'OK', { duration: 3000 }); },
    });
  }

  dismissClaim(claimId: string): void {
    this.claimOpportunity.dismissClaim(claimId).subscribe({
      next: () => { this.highProbClaims = this.highProbClaims.filter(c => c.id !== claimId); },
      error: () => { this.snackBar.open('Failed to dismiss claim', 'OK', { duration: 3000 }); },
    });
  }

  getImpactColor(level: string): string {
    const m: Record<string, string> = { critical: '#ff1744', high: '#ff6d00', moderate: '#ffd600', low: '#00e5ff' };
    return m[level] || '#64748b';
  }

  getScoreBadgeClass(score: number): string {
    if (score >= 80) return 'score-critical';
    if (score >= 60) return 'score-high';
    if (score >= 40) return 'score-moderate';
    return 'score-low';
  }

  // ── Claim Opportunity Intelligence helpers ────────────────────
  getPriorityColor(priority: string): string {
    return (PRIORITY_META as any)[priority]?.color || '#64748b';
  }

  getPriorityIcon(priority: string): string {
    return (PRIORITY_META as any)[priority]?.icon || 'info';
  }

  getEventIcon(type: string): string {
    const icons: Record<string, string> = {
      fire: 'local_fire_department', hail: 'ac_unit', wind: 'air',
      lightning: 'bolt', tornado: 'tornado', hurricane: 'cyclone',
      crime: 'gavel', roof: 'roofing',
    };
    return icons[type] || 'warning';
  }

  getDisplayedOpportunities(): ClaimOpportunity[] {
    return this.showAllOpportunities ? this.opportunities : this.opportunities.slice(0, 5);
  }

  toggleOpportunityView(): void {
    this.showAllOpportunities = !this.showAllOpportunities;
  }

  getFactorBars(opp: ClaimOpportunity) {
    if (!opp.scoring_factors) return [];
    return SCORING_FACTOR_META.map(f => ({
      label: f.label,
      color: f.color,
      percent: Math.round((opp.scoring_factors as any)[f.key] * 100),
      weight: (DEFAULT_SCORING_WEIGHTS as any)[
        f.key === 'insurance_likelihood' ? 'insurance_probability'
        : f.key === 'claim_size_estimate' ? 'claim_size'
        : f.key
      ],
    }));
  }

  toggleScoreBreakdown(opp: ClaimOpportunity): void {
    this.selectedOpp = this.selectedOpp?.id === opp.id ? null : opp;
  }

  // ── Claim Recovery Dashboard helpers ──────────────────────────────
  sortRecoveryClaims(): void {
    this.recoveryClaims = [...this.recoveryClaims].sort((a, b) => {
      const aVal = a[this.recoverySortField];
      const bVal = b[this.recoverySortField];
      const aNum = typeof aVal === 'number' ? aVal : String(aVal || '').toLowerCase();
      const bNum = typeof bVal === 'number' ? bVal : String(bVal || '').toLowerCase();
      const cmp = aNum < bNum ? -1 : aNum > bNum ? 1 : 0;
      return this.recoverySortDir === 'asc' ? cmp : -cmp;
    });
  }

  onRecoverySort(field: keyof ClaimRecoveryRecord): void {
    if (this.recoverySortField === field) {
      this.recoverySortDir = this.recoverySortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.recoverySortField = field;
      this.recoverySortDir = 'desc';
    }
    this.sortRecoveryClaims();
  }

  getRecoverySortIcon(field: keyof ClaimRecoveryRecord): string {
    if (this.recoverySortField !== field) return 'unfold_more';
    return this.recoverySortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  getRecoveryStatusColor(status: RecoveryStatus): string {
    return RECOVERY_STATUS_META[status]?.color || '#9e9e9e';
  }

  getRecoveryStatusLabel(status: RecoveryStatus): string {
    return RECOVERY_STATUS_META[status]?.label || status;
  }

  getRecoveryStatusIcon(status: RecoveryStatus): string {
    return RECOVERY_STATUS_META[status]?.icon || 'info';
  }

  // ── Governance + Cost Telemetry helpers ────────────────────────
  fmtCents(cents: number): string {
    if (!cents || cents <= 0) return '$0';
    const dollars = cents / 100;
    if (dollars >= 1000) return '$' + Math.round(dollars).toLocaleString();
    return '$' + dollars.toFixed(2);
  }

  governanceSpendPct(): number {
    if (!this.governance || this.governance.daily_budget_cents <= 0) return 0;
    const pct = (this.governance.daily_spend_cents / this.governance.daily_budget_cents) * 100;
    return Math.min(Math.max(Math.round(pct), 0), 100);
  }

  governanceModeColor(): string {
    const mode = this.governance?.mode || 'conservative';
    const map: Record<string, string> = {
      paused:       '#9e9e9e',  // grey — kill switch on
      conservative: '#00e5ff',  // cyan — default safe state
      aggressive:   '#ff6d00',  // orange — accelerated spend
      disaster:     '#ff1744',  // red — operator override active
    };
    return map[mode] || '#64748b';
  }

  governanceModeLabel(): string {
    const mode = this.governance?.mode || 'conservative';
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  }

  governanceBudgetBarColor(): string {
    const pct = this.governanceSpendPct();
    if (pct >= 90) return '#ff1744';   // red — at-the-wall
    if (pct >= 70) return '#ff6d00';   // orange — warning
    return '#00e676';                   // green — healthy
  }

  shortOperatorId(opId: string): string {
    if (!opId) return '—';
    return opId.length > 12 ? opId.slice(0, 8) + '…' : opId;
  }

  // ── Live counter-strip helpers ─────────────────────────────────
  /** Render integer counter or em-dash when no real data has landed. */
  todayDisplayInt(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return Number(n) > 0 ? String(Math.round(Number(n))) : '—';
  }
  /** Render cents counter as $X.XX or em-dash when no real data has landed. */
  todayDisplayCents(c: number | null | undefined): string {
    if (c === null || c === undefined) return '—';
    return Number(c) > 0 ? this.fmtCents(Number(c)) : '—';
  }
  /** True when any of today's counters carry real activity. */
  hasAnyTodayActivity(): boolean {
    const t = this.wallet?.todaySnapshot;
    if (!t) return false;
    return (t.sms_sent_today > 0)
        || (t.estimated_spend_today_cents > 0)
        || (t.active_operators_today > 0);
  }

  // ── Wallet helpers ─────────────────────────────────────────────
  walletKindLabel(kind: string | undefined): string {
    if (!kind) return '—';
    const map: Record<string, string> = {
      organization: 'Organization',
      cp: 'Channel Partner',
      rvp: 'Regional VP',
      agent: 'Agent',
      house: 'House Reserve',
    };
    return map[kind] || kind;
  }

  walletModeColor(mode: string | undefined): string {
    const map: Record<string, string> = {
      paused:       '#9e9e9e',
      conservative: '#00e5ff',
      aggressive:   '#ff6d00',
      disaster:     '#ff1744',
    };
    return map[mode || 'conservative'] || '#64748b';
  }

  walletTokensFmt(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  }

  walletBurnSparkBars(): { date: string; pct: number; tokens: number }[] {
    const series = this.wallet?.dailyBurn || [];
    if (series.length === 0) return [];
    const max = Math.max(1, ...series.map(d => d.tokens));
    return series.map(d => ({
      date: d.date,
      tokens: d.tokens,
      pct: Math.max(2, Math.round((d.tokens / max) * 100)),
    }));
  }

  // ── Executive zone helpers (calm, no urgency cues) ─────────────
  /** "updated 12s ago" — soft tabular text for the governance card. */
  governanceTimeAgo(): string {
    return this.timeAgoSeconds(this.governanceLastRefreshAt);
  }
  walletTimeAgo(): string {
    return this.timeAgoSeconds(this.walletLastRefreshAt);
  }
  private timeAgoSeconds(ts: number | null): string {
    if (!ts) return '—';
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
  }

  walletProjectedRunway(): string {
    const w = this.wallet?.myWallet;
    if (!w) return '—';
    const dailyBurn = this.wallet?.dailyBurn || [];
    const recent = dailyBurn.slice(-7);
    if (recent.length === 0 || w.token_balance <= 0) return '—';
    const avgDaily = recent.reduce((s, d) => s + (d.tokens || 0), 0) / recent.length;
    if (avgDaily <= 0) return '∞';
    const days = Math.floor(w.token_balance / avgDaily);
    if (days >= 365) return '> 1 yr';
    if (days >= 30) return Math.floor(days / 30) + ' mo';
    if (days >= 7) return Math.floor(days / 7) + ' wk';
    return days + ' d';
  }

  // ── Operational Reserve helpers (Phase 1, observation-mode) ─────
  //
  // The wallet table is the system of record; these getters re-cast
  // existing fields into the Operational Reserve vocabulary without
  // altering any backend contract. Naming here matches what the
  // panel renders ("Reserve Capacity", "Deployed Today", etc.) so
  // future engineers searching for those phrases land in this file.

  /** True until at least one wallet has hard_limit_tokens set. The
   *  System 1 wallet is soft-by-default; no hard blocks happen
   *  unless the operator opts in. */
  reserveEnforcementMode(): 'observation' | 'enforced' {
    const hard = this.wallet?.myWallet?.hard_limit_tokens;
    return hard != null ? 'enforced' : 'observation';
  }

  reserveEnforcementLabel(): string {
    // Clarity polish (2026-05-16): the underlying mode is still
    // 'observation' / 'enforced' for backend parity, but the visible
    // label uses plain English so non-admin readers don't see
    // "Observation Mode" and wonder what is being observed.
    return this.reserveEnforcementMode() === 'enforced'
      ? 'Cap Active'
      : 'Tracking Only';
  }

  reserveEnforcementColor(): string {
    return this.reserveEnforcementMode() === 'enforced' ? '#ff6d00' : '#00e5ff';
  }

  /** Reserve Capacity = available Intelligence Reserve (token_balance
   *  minus reserved_tokens). When the wallet hasn't lazy-created,
   *  return null so the tile renders as awaiting-state. */
  reserveCapacity(): number | null {
    const w = this.wallet?.myWallet;
    if (!w) return null;
    return Math.max((w.token_balance || 0) - (w.reserved_tokens || 0), 0);
  }

  /** Deployed Today — cents spent against the caller's wallet today.
   *  Mirrors the wallet.daily_spend_cents field. */
  reserveDeployedTodayCents(): number {
    return this.wallet?.myWallet?.daily_spend_cents || 0;
  }

  /** Intelligence Operations Today — total billable ops the caller
   *  has executed today. Derived from Mission Log if available
   *  (filters to today via the created_at date prefix), otherwise
   *  falls back to platform-wide ops counter when admin view. */
  intelligenceOpsToday(): number {
    const today = new Date().toISOString().slice(0, 10);
    const log = this.wallet?.missionLog || [];
    const todays = log.filter(e => (e.created_at || '').slice(0, 10) === today);
    if (todays.length > 0) return todays.length;
    // Fallback for admin view: best-available "all today" signal.
    const snap = this.wallet?.todaySnapshot;
    if (snap) {
      return Math.max(
        snap.sms_sent_today | 0,
        snap.active_operators_today | 0,
      );
    }
    return 0;
  }

  /** Provider Cost Warning — surfaces only when governance reports
   *  ≥1 suppression in the last 24h OR when ≥70% of the daily budget
   *  has been spent. Returns null when no warning to render. */
  providerCostWarning(): { level: 'info' | 'warn' | 'critical'; text: string } | null {
    const g = this.governance;
    if (!g) return null;
    const pct = this.governanceSpendPct();
    if (pct >= 90) {
      return { level: 'critical', text: `${pct}% of daily provider budget consumed — paid stages will halt at the wall.` };
    }
    if (g.suppressed_count_24h && g.suppressed_count_24h > 0) {
      const level: 'warn' | 'critical' = pct >= 70 ? 'critical' : 'warn';
      return { level, text: `${g.suppressed_count_24h} provider call(s) suppressed in the last 24h.` };
    }
    if (pct >= 70) {
      return { level: 'warn', text: `${pct}% of daily provider budget consumed.` };
    }
    return null;
  }

  missionLogEvents(): MissionLogEvent[] {
    return this.wallet?.missionLog || [];
  }

  /** Display label for a Mission Log row. Maps SMS_SENT / SKIP_TRACE
   *  / AI_CALL_MINUTE / OPENAI_REQUEST to friendly names; falls back
   *  to the raw op type so new event kinds still render. */
  missionLogOpLabel(op: string): string {
    const map: Record<string, string> = {
      SMS_SENT: 'SMS Dispatched',
      AI_CALL_MINUTE: 'Voice Call Minute',
      SKIP_TRACE: 'Skip Trace',
      OPENAI_REQUEST: 'AI Inference',
    };
    return map[op] || op;
  }

  missionLogStatusColor(e: MissionLogEvent): string {
    if (e.suppression_reason) return '#9e9e9e';
    if (e.success === false) return '#ff1744';
    if (e.success === true) return '#00e676';
    return '#64748b';
  }

  // ── Phase 2: Operational Reserve VISUAL ECONOMY layer ──────────────
  // All getters below are pure visual. No state mutation, no API
  // contract change, no enforcement. Frontend-only.

  /**
   * UI-only credit-unit conversion. The wallet doesn't expose a
   * cents-to-credits ratio, so the Operational Reserve renders cents
   * 1:1 as "Intelligence Credits" — i.e. 125¢ → 125 credits. This
   * keeps the narrative consistent ("125 Credits deployed") without
   * coupling to vendor pricing. NOT used for billing math.
   */
  reserveCredits(cents: number | null | undefined): number {
    if (cents == null) return 0;
    return Math.max(0, Math.round(Number(cents)));
  }

  /** Operations Today — count of caller's usage_event rows since UTC
   *  midnight, from Mission Log. Always a clean integer for the
   *  top-strip odometer. */
  operationsTodayCount(): number {
    const today = new Date().toISOString().slice(0, 10);
    const log = this.wallet?.missionLog || [];
    return log.filter(e => (e.created_at || '').slice(0, 10) === today).length;
  }

  /** Earned Today (credits) — placeholder hook for Phase 3 monthly
   *  allowance / reserve grants. In Phase 2 it returns 0 until a
   *  RESERVE_GRANT op_type lands in usage_event. Render is suppressed
   *  via *ngIf when value is 0. */
  earnedTodayCredits(): number {
    const log = this.wallet?.missionLog || [];
    const today = new Date().toISOString().slice(0, 10);
    return log
      .filter(e => (e.created_at || '').slice(0, 10) === today)
      .filter(e => e.operation_type === 'RESERVE_GRANT')
      .reduce((s, e) => s + (e.token_debit || 0), 0);
  }

  // ── Reserve Gauge math ─────────────────────────────────────────────
  //
  // The gauge represents the wallet's "Mission Range" — a projected
  // runway saturation in 0..100. With no hard_limit_tokens set
  // (observation mode), there is no absolute denominator, so the
  // gauge uses days-of-runway as its scale:
  //   ≥30 days  → 100% (green, "Operational Capacity")
  //    7-30 days → linear band (amber, "Mission Range")
  //    <7 days   → red ("Reserve Low")
  // When a hard_limit_tokens is set in the future, the gauge flips to
  // exact balance/limit math (see reserveGaugePctEnforced).

  reserveGaugePct(): number {
    const w = this.wallet?.myWallet;
    if (!w) return 0;
    if (w.hard_limit_tokens && w.hard_limit_tokens > 0) {
      return Math.min(100, Math.round((w.token_balance / w.hard_limit_tokens) * 100));
    }
    // Observation mode — saturate over 30 days of runway.
    const dailyBurn = this.wallet?.dailyBurn || [];
    const recent = dailyBurn.slice(-7);
    if (recent.length === 0) return w.token_balance > 0 ? 100 : 0;
    const avgDaily = recent.reduce((s, d) => s + (d.tokens || 0), 0) / recent.length;
    if (avgDaily <= 0) return w.token_balance > 0 ? 100 : 0;
    const days = w.token_balance / avgDaily;
    if (days >= 30) return 100;
    if (days >= 7) return Math.round(((days - 7) / 23) * 70 + 30); // 30..100 band
    return Math.max(2, Math.round((days / 7) * 30));               // 0..30 band
  }

  reserveGaugeBand(): 'healthy' | 'warning' | 'critical' {
    const pct = this.reserveGaugePct();
    if (pct < 30) return 'critical';
    if (pct < 70) return 'warning';
    return 'healthy';
  }

  reserveGaugeBandLabel(): string {
    const band = this.reserveGaugeBand();
    if (band === 'critical') return 'Reserve Low';
    if (band === 'warning')  return 'Mission Range';
    return 'Operational Capacity';
  }

  reserveGaugeColor(): string {
    const band = this.reserveGaugeBand();
    if (band === 'critical') return '#ff1744';
    if (band === 'warning')  return '#ffb300';
    return '#00e676';
  }

  reserveGaugeGlow(): string {
    return this.reserveGaugeColor();
  }

  /** Arc dashoffset for the gauge SVG. The gauge sweeps 270°; the
   *  underlying circle has circumference 2πr — see HTML for the
   *  exact values. */
  reserveGaugeDashOffset(): number {
    const circumference = 2 * Math.PI * 60;      // r=60
    const visibleArc = circumference * (270 / 360);
    const pct = this.reserveGaugePct() / 100;
    return visibleArc * (1 - pct);
  }

  reserveGaugeArcLength(): number {
    return 2 * Math.PI * 60 * (270 / 360);
  }

  // ── CP Tier (visual only, no enforcement) ──────────────────────────
  //
  // Premium tier ribbon derived from lifetime_spend_cents on the
  // caller's wallet. Thresholds are placeholders — the tier system
  // is a Phase-3 commercial construct; today the badge is pure
  // theatre and has no effect on access, governance, or billing.
  // The wallet is unaware these tiers exist.

  private static readonly TIERS: { name: string; min: number; color: string; glow: string }[] = [
    { name: 'Bronze',        min: 0,         color: '#b08049', glow: 'rgba(176, 128,  73, 0.45)' },
    { name: 'Silver',        min: 100_000,   color: '#c0c4cc', glow: 'rgba(192, 196, 204, 0.45)' },
    { name: 'Gold',          min: 500_000,   color: '#ffc857', glow: 'rgba(255, 200,  87, 0.55)' },
    { name: 'Platinum',      min: 2_000_000, color: '#9ad9ea', glow: 'rgba(154, 217, 234, 0.55)' },
    { name: 'Black Reserve', min: 10_000_000, color: '#f0f0f0', glow: 'rgba(255, 255, 255, 0.30)' },
  ];

  cpTier(): { name: string; color: string; glow: string } {
    const lifetime = this.wallet?.myWallet?.lifetime_spend_cents || 0;
    let chosen = GlobalCommandCenterComponent.TIERS[0];
    for (const t of GlobalCommandCenterComponent.TIERS) {
      if (lifetime >= t.min) chosen = t;
    }
    return { name: chosen.name, color: chosen.color, glow: chosen.glow };
  }

  /** Progress to next tier, 0..100. For Black Reserve, returns 100. */
  cpTierProgressPct(): number {
    const lifetime = this.wallet?.myWallet?.lifetime_spend_cents || 0;
    const tiers = GlobalCommandCenterComponent.TIERS;
    for (let i = 0; i < tiers.length - 1; i++) {
      const cur = tiers[i].min;
      const next = tiers[i + 1].min;
      if (lifetime >= cur && lifetime < next) {
        return Math.round(((lifetime - cur) / (next - cur)) * 100);
      }
    }
    return 100;
  }

  cpTierNext(): string | null {
    const lifetime = this.wallet?.myWallet?.lifetime_spend_cents || 0;
    const tiers = GlobalCommandCenterComponent.TIERS;
    for (let i = 0; i < tiers.length - 1; i++) {
      if (lifetime < tiers[i + 1].min) return tiers[i + 1].name;
    }
    return null;
  }

  // ── Phase 4: Prestige Rank ─────────────────────────────────────────
  //
  // Five-step operator progression visible on every role. Distinct from
  // the wallet-driven `cpTier()` colorway (Bronze/Silver/Gold/etc.) —
  // those measure financial throughput; prestige measures field
  // execution. Scoring is intentionally simple in this phase: a
  // per-role demo seed plus a small modulation from monthly activity
  // when a wallet is present, so each role view shows a plausible
  // current rank + visible progress to the next one. Real scoring
  // (calls / signs / time-in-role) lands in a later phase.

  private static readonly PRESTIGE_RANKS: { name: string; min: number; color: string; glow: string }[] = [
    { name: 'Operator',           min:   0, color: '#9aa6b2', glow: 'rgba(154, 166, 178, 0.40)' },
    { name: 'Senior Operator',    min:  25, color: '#00e5ff', glow: 'rgba(  0, 229, 255, 0.50)' },
    { name: 'Lead Operator',      min:  50, color: '#7c4dff', glow: 'rgba(124,  77, 255, 0.55)' },
    { name: 'Executive Operator', min:  75, color: '#ffc857', glow: 'rgba(255, 200,  87, 0.55)' },
    { name: 'Apex Operator',      min: 100, color: '#f0f0f0', glow: 'rgba(240, 240, 240, 0.40)' },
  ];

  /** Score 0..120 — per-role demo seed plus light modulation from
   *  monthly wallet spend when available. Visual only. */
  prestigeScore(): number {
    const base: Record<'master' | 'cp' | 'rvp' | 'agent', number> = {
      master: 92, cp: 71, rvp: 54, agent: 38,
    };
    const seed = base[this.reserveView()];
    const monthly = this.wallet?.myWallet?.monthly_spend_cents || 0;
    const lift = Math.min(20, Math.round(monthly / 50_000));
    return Math.min(120, seed + lift);
  }

  prestigeRank(): { name: string; color: string; glow: string } {
    const s = this.prestigeScore();
    let chosen = GlobalCommandCenterComponent.PRESTIGE_RANKS[0];
    for (const r of GlobalCommandCenterComponent.PRESTIGE_RANKS) {
      if (s >= r.min) chosen = r;
    }
    return { name: chosen.name, color: chosen.color, glow: chosen.glow };
  }

  prestigeNextRank(): string | null {
    const s = this.prestigeScore();
    const ranks = GlobalCommandCenterComponent.PRESTIGE_RANKS;
    for (let i = 0; i < ranks.length - 1; i++) {
      if (s < ranks[i + 1].min) return ranks[i + 1].name;
    }
    return null;
  }

  prestigeProgressPct(): number {
    const s = this.prestigeScore();
    const ranks = GlobalCommandCenterComponent.PRESTIGE_RANKS;
    for (let i = 0; i < ranks.length - 1; i++) {
      const cur = ranks[i].min;
      const next = ranks[i + 1].min;
      if (s >= cur && s < next) {
        return Math.round(((s - cur) / (next - cur)) * 100);
      }
    }
    return 100;
  }

  /** Placeholder leaderboard position per role. Scope label adapts so
   *  the line reads naturally regardless of role. */
  leaderboardPosition(): { rank: number; total: number; scope: string } {
    const map: Record<'master' | 'cp' | 'rvp' | 'agent', { rank: number; total: number; scope: string }> = {
      master: { rank:  1, total:   1, scope: 'organization' },
      cp:     { rank:  4, total:  28, scope: 'territories'  },
      rvp:    { rank:  7, total:  42, scope: 'regions'      },
      agent:  { rank: 14, total: 312, scope: 'agents'       },
    };
    return map[this.reserveView()];
  }

  // ── Lightweight leaderboard demo data ──────────────────────────────
  mockTopAgents(): { name: string; team: string; signed: number; ops: number }[] {
    return [
      { name: 'Marcus Lee',     team: 'Houston North',  signed: 14, ops: 412 },
      { name: 'Daniela Ortiz',  team: 'Dallas Metro',   signed: 12, ops: 388 },
      { name: 'Tara Whitfield', team: 'Austin Central', signed: 11, ops: 366 },
      { name: 'Andre Thompson', team: 'San Antonio S',  signed:  9, ops: 304 },
      { name: 'Priya Shah',     team: 'Fort Worth W',   signed:  8, ops: 281 },
    ];
  }
  mockTopTeams(): { name: string; lead: string; signed: number; ops: number }[] {
    return [
      { name: 'Houston North',  lead: 'M. Cruz',    signed: 47, ops: 1_412 },
      { name: 'Dallas Metro',   lead: 'J. Reyes',   signed: 41, ops: 1_204 },
      { name: 'Austin Central', lead: 'L. Park',    signed: 36, ops: 1_088 },
      { name: 'Fort Worth W',   lead: 'K. Walters', signed: 31, ops:   972 },
    ];
  }
  mockTopTerritories(): { name: string; signed: number; recovery_cents: number }[] {
    return [
      { name: 'Texas Gulf',    signed: 128, recovery_cents:  3_140_000 },
      { name: 'North Texas',   signed: 112, recovery_cents:  2_680_000 },
      { name: 'Central Texas', signed:  94, recovery_cents:  2_190_000 },
      { name: 'Florida Coast', signed:  88, recovery_cents:  2_040_000 },
    ];
  }

  // ── Phase 4: refined governance visibility per role ───────────────
  /** Render the governance container at all — hidden for agent. */
  showGovernanceSection():    boolean { return !this.viewIsAgent(); }
  /** Full multi-card governance grid — master + cp only. */
  showGovernanceFullGrid():   boolean { return this.viewIsMaster() || this.viewIsCp(); }
  /** Compact one-line summary — rvp only (team-focused framing). */
  showGovernanceCompactBar(): boolean { return this.viewIsRvp(); }

  /** Header label for the embedded governance panel per role. */
  governancePanelTitle(): string {
    // Clarity polish (2026-05-16): admin-oriented title now reads as a
    // companion to the user-facing Rewards Wallet panel that sits above
    // it. RVPs keep their team framing.
    if (this.viewIsRvp()) return 'Team Performance';
    return 'Admin · Governance & Cost Controls';
  }

  /** Eyebrow for the executive-suite section header per role. */
  suiteSectionEyebrow(): string {
    if (this.viewIsAgent()) return 'Your Workspace';
    if (this.viewIsRvp())   return 'Team Performance';
    // Clarity polish (2026-05-16): the wallet is the headline now, so
    // the section eyebrow leads with rewards rather than governance.
    return 'Rewards Wallet & Operational Reserve';
  }

  /** Page header title — agent gets a tactical workspace title; every
   *  other role keeps the national command-center framing. */
  gccHeaderTitle(): string {
    if (this.viewIsAgent()) return 'Agent Workspace';
    return 'Global Intelligence Command Center';
  }
  gccHeaderSubtitle(): string {
    if (this.viewIsAgent()) return 'Your leads. Your pipeline. Your wins.';
    return 'Real-time national incident monitoring, lead generation intelligence, and claim recovery analytics.';
  }

  // ── Phase 8: Agent Workspace REAL-DATA getters ─────────────────────
  //
  // Mock returns were replaced with snapshot-backed reads against
  // /v1/agents/me/*. When the snapshot is null (pre-first-poll) or
  // has_data is false (zero state), the template renders premium
  // empty-state messaging instead of fake zeros. Pipeline stage
  // colors stay as visual config; counts come from the wire.

  private static readonly AGENT_PIPELINE_COLORS: Record<string, string> = {
    new:       '#00e5ff',
    contacted: '#2979ff',
    working:   '#ffc857',
    qualified: '#7c4dff',
    signed:    '#00e676',
  };

  /** Pipeline stages strip. Returns live counts from the snapshot;
   *  falls back to a zero-shape when the snapshot hasn't landed yet. */
  agentMyPipeline(): { key: string; label: string; count: number; color: string }[] {
    const live = this.agentSnapshot?.pipeline?.stages;
    if (live && live.length > 0) {
      return live.map(s => ({
        key: s.key,
        label: s.label,
        count: s.count,
        color: GlobalCommandCenterComponent.AGENT_PIPELINE_COLORS[s.key] || '#9aa6b2',
      }));
    }
    return [
      { key: 'new',       label: 'New',             count: 0, color: '#00e5ff' },
      { key: 'contacted', label: 'Contacted',       count: 0, color: '#2979ff' },
      { key: 'working',   label: 'Active Leads',    count: 0, color: '#ffc857' },
      { key: 'qualified', label: 'Qualified Leads', count: 0, color: '#7c4dff' },
      { key: 'signed',    label: 'Claims Signed',   count: 0, color: '#00e676' },
    ];
  }
  agentHasPipelineData(): boolean { return !!this.agentSnapshot?.pipeline?.has_data; }

  /** My Leads summary — live counts. */
  agentMyLeads(): { total: number; new_today: number; working: number } {
    const l = this.agentSnapshot?.leads;
    return {
      total:     l?.total     ?? 0,
      new_today: l?.new_today ?? 0,
      working:   l?.working   ?? 0,
    };
  }
  agentHasLeadsData(): boolean { return !!this.agentSnapshot?.leads?.has_data; }

  /** Top tasks from live follow-up rollup. */
  agentMyTasks(): { label: string; due: string; kind: string; lead_id?: string }[] {
    const rows = this.agentSnapshot?.tasks?.tasks || [];
    return rows.map(t => ({
      label: t.label,
      due: this.formatTaskDue(t.due_at),
      kind: t.kind,
      lead_id: t.lead_id,
    }));
  }
  agentHasTasksData(): boolean { return !!this.agentSnapshot?.tasks?.has_data; }

  /** Outreach summary — live counts. response_rate_pct may be null
   *  (no response-tracking event yet) — template renders "—". */
  agentMyOutreach(): { sent_today: number; sent_week: number; response_rate_pct: number | null } {
    const o = this.agentSnapshot?.outreach;
    return {
      sent_today:        o?.sent_today        ?? 0,
      sent_week:         o?.sent_week         ?? 0,
      response_rate_pct: o?.response_rate_pct ?? null,
    };
  }
  agentHasOutreachData(): boolean { return !!this.agentSnapshot?.outreach?.has_data; }

  /** Conversion percentage — derived from live pipeline counts
   *  (signed / total). Returns null when there's no pipeline data to
   *  divide. */
  agentConversion(): { pct: number | null; delta_pct: number | null; window: string } {
    const p = this.agentSnapshot?.pipeline;
    if (!p || p.total <= 0) return { pct: null, delta_pct: null, window: 'no data yet' };
    const signed = p.stages.find(s => s.key === 'signed')?.count ?? 0;
    return {
      pct: Math.round((signed / p.total) * 100),
      delta_pct: null,      // honest: no historical comparison wired yet
      window: 'lifetime to-date',
    };
  }
  agentHasConversionData(): boolean {
    return (this.agentSnapshot?.pipeline?.total ?? 0) > 0;
  }

  /** Recent signed leads. */
  agentRecentWins(): { client: string; when: string; peril: string | null; lead_id?: string }[] {
    const rows = this.agentSnapshot?.wins?.wins || [];
    return rows.map(w => ({
      client: w.client,
      when: w.when ? this.timeAgo(w.when) : '—',
      peril: w.peril,
      lead_id: w.lead_id,
    }));
  }
  agentHasWinsData(): boolean { return !!this.agentSnapshot?.wins?.has_data; }

  /** Streak chips — live. Empty when has_data is false. */
  agentStreaks(): { label: string; value: string; sub: string; color: string }[] {
    const rows = this.agentSnapshot?.streaks?.streaks || [];
    const palette = ['#00e5ff', '#00e676', '#ffc857'];
    return rows.map((s, i) => ({
      label: s.label,
      value: s.value,
      sub: s.sub,
      color: palette[i % palette.length],
    }));
  }
  agentHasStreaksData(): boolean { return !!this.agentSnapshot?.streaks?.has_data; }

  /** HUD micro-counters. ops_today derives from existing wallet
   *  telemetry (intelligenceOpsToday is real wallet activity count).
   *  signed_today / streak_days come from live agent snapshot. */
  agentDailyActivity(): { ops_today: number; signed_today: number; streak_days: number } {
    const wins = this.agentSnapshot?.wins?.wins || [];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const signedToday = wins.filter(w => {
      const t = w.when ? new Date(w.when).getTime() : 0;
      return t >= todayStart.getTime();
    }).length;
    return {
      ops_today:    this.intelligenceOpsToday() || 0,
      signed_today: signedToday,
      streak_days:  this.agentSnapshot?.streaks?.contact_streak_days ?? 0,
    };
  }

  /** Recent action ledger rows — last 8 wallet-debiting actions. */
  agentRecentActions(): { label: string; cost: number; state: string; when: string; lead_label: string | null }[] {
    const rows = this.agentSnapshot?.recent?.rows || [];
    return rows.map(r => ({
      label: r.label,
      cost: r.cost,
      state: r.state,
      when: r.when ? this.formatHourMinute(r.when) : '—',
      lead_label: r.lead_label,
    }));
  }
  agentHasRecentActions(): boolean { return !!this.agentSnapshot?.recent?.has_data; }

  /** Status dot color for a recent-action state. */
  agentRecentStateColor(state: string): string {
    const s = (state || '').toLowerCase();
    if (s === 'completed') return '#00e676';
    if (s === 'failed')    return '#ff8896';
    if (s === 'processing' || s === 'queued') return '#ffc857';
    return '#9aa6b2';
  }

  /** True until the very first /v1/agents/me poll has returned. */
  agentLoading(): boolean { return !this.agentSnapshot || this.agentSnapshot.fetchedAt === 0; }

  // ── Phase 9 · First-session detection ───────────────────────────────
  //
  // "First session" = backend reachable, agent authenticated, but no
  // pipeline / leads / outreach / streaks / recent actions yet. We use
  // this to soften the prestige rank narrative, surface a one-line
  // operational welcome line, and gate the Skip Trace button so a
  // brand-new agent never hits the "all leads already traced" dead-end.

  agentIsFirstSession(): boolean {
    const s = this.agentSnapshot;
    if (!s || s.fetchedAt === 0) return false;       // still loading
    if (!s.reachable) return false;                  // logged out / unreachable
    return !s.hasAnyData;                            // reached + zero data
  }

  /** Honest rank line shown in the HUD. For brand-new agents we
   *  suppress the leaderboard position ("Position #14 of 312") since
   *  it's seeded demo data and reads as dishonest at zero-activity. */
  agentRankSubline(): string {
    if (this.agentIsFirstSession()) {
      return 'Earn your first signed claim to begin ranking';
    }
    const pos = this.leaderboardPosition();
    return `Position #${pos.rank} of ${pos.total} agents`;
  }

  // Welcome line — premium, single-line, dismissible. SessionStorage
  // so a tab close clears it; production-safe.
  welcomeDismissed = false;
  ngOnInitWelcomeRestore(): void {
    try {
      this.welcomeDismissed = sessionStorage.getItem('agentWelcomeDismissed') === '1';
    } catch { /* private mode — non-fatal */ }
  }
  showAgentWelcome(): boolean {
    return this.viewIsAgent() && this.agentIsFirstSession() && !this.welcomeDismissed;
  }
  dismissAgentWelcome(): void {
    this.welcomeDismissed = true;
    try { sessionStorage.setItem('agentWelcomeDismissed', '1'); } catch { /* ignore */ }
  }

  /** Skip Trace can't usefully execute when the agent has no leads.
   *  We disable the button with an honest tooltip instead of letting
   *  the click 400 with "all leads already have contact info." */
  isAgentActionBlockedByNoLeads(action: { key: string }): boolean {
    if (action.key !== 'skip_trace') return false;
    if (!this.agentSnapshot || this.agentSnapshot.fetchedAt === 0) return false;
    return (this.agentSnapshot.leads?.total ?? 0) === 0;
  }

  /** Tiny HH:MM helper used by the ledger strip. */
  private formatHourMinute(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Render a live timestamp as a human "due" label. */
  private formatTaskDue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
    const pad = (n: number) => String(n).padStart(2, '0');
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (d >= today && d < tomorrow)     return `today · ${hm}`;
    if (d >= tomorrow && d < dayAfter)  return `tomorrow · ${hm}`;
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} · ${hm}`;
  }

  /** Quick navigation actions on the HUD (NOT credit-costing). */
  agentQuickActions(): { label: string; icon: string; route: string }[] {
    return [
      { label: 'New Lead',    icon: 'person_add', route: '/app/rotation-leads' },
      { label: 'My Pipeline', icon: 'view_kanban',route: '/app/workflow-queues' },
      { label: 'Outreach',    icon: 'campaign',   route: '/app/outreach-campaigns' },
      { label: 'Skip Trace',  icon: 'travel_explore', route: '/app/skip-trace' },
    ];
  }

  /** My territory + my position in it. */
  agentTerritoryRank(): { territory: string; my_rank: number; total: number; signed_this_month: number } {
    return { territory: 'Houston North', my_rank: 4, total: 18, signed_this_month: 7 };
  }

  /** Task pill color/icon mapping. */
  agentTaskIcon(kind: string): string {
    if (kind === 'callback')   return 'phone_callback';
    if (kind === 'doc')        return 'description';
    if (kind === 'inspection') return 'home_work';
    return 'send';
  }
  agentTaskColor(kind: string): string {
    if (kind === 'callback')   return '#00e5ff';
    if (kind === 'doc')        return '#ffc857';
    if (kind === 'inspection') return '#7c4dff';
    return '#00e676';
  }

  /** Meta items beside the suite eyebrow per role. Empty for agent. */
  suiteSectionMeta(): { icon: string; label: string }[] {
    if (this.viewIsAgent()) return [{ icon: 'bolt', label: 'Field operations' }];
    if (this.viewIsRvp())   return [
      { icon: 'groups',   label: 'Team production' },
      { icon: 'insights', label: 'This month'      },
    ];
    return [
      { icon: 'visibility', label: 'Operator activity' },
      { icon: 'shield_moon', label: 'Credit pool'      },
      { icon: 'insights',    label: 'Spend visibility' },
    ];
  }

  /** One-line operational guidance shown under the suite eyebrow.
   *  Premium onboarding — tells a first-time viewer what this section
   *  is *for* without a tour or popup. */
  suiteSectionSubtitle(): string {
    if (this.viewIsAgent()) return 'Your credits, rank, and actions at a glance.';
    if (this.viewIsRvp())   return 'Your team’s production this month at a glance.';
    if (this.viewIsCp())    return 'Territory credit pool and team execution at a glance.';
    return 'Credit pool, operator activity, and spend at a glance.';
  }

  // ── Mission Log narrative phrasing ────────────────────────────────
  //
  // Replaces the dry "SMS_SENT · twilio · $0.45 · 2 min ago" row with
  // a Bloomberg-style narrative ("SMS wave launched · 220 Credits
  // deployed · 2 min ago"). Pure formatting — same usage_event data.

  missionLogNarrative(e: MissionLogEvent): string {
    const credits = this.reserveCredits(e.actual_cost_cents ?? e.estimated_cost_cents);

    // Suppression / failure paths first — never sugarcoat real ops failures.
    if (e.suppression_reason) {
      if (e.suppression_reason === 'provider_unavailable') {
        return `Provider unavailable · ${e.vendor || 'upstream provider'}`;
      }
      if (e.suppression_reason === 'non_property_address') {
        return `Operation skipped · non-property address`;
      }
      if (e.suppression_reason === 'empty_or_invalid_address') {
        return `Operation skipped · invalid address`;
      }
      return `Operation suppressed by governance`;
    }
    if (e.success === false) {
      return `${this.missionLogOpLabel(e.operation_type)} · no result returned`;
    }

    switch (e.operation_type) {
      case 'SKIP_TRACE':
        return `Skip Sherpa engaged · ${credits.toLocaleString()} Credits deployed`;
      case 'SMS_SENT':
        return `SMS wave launched · ${credits.toLocaleString()} Credits deployed`;
      case 'AI_CALL_MINUTE':
        return `AI Voice Agent engaged · ${credits.toLocaleString()} Credits deployed`;
      case 'OPENAI_REQUEST':
        return `AI Inference deployed · ${credits.toLocaleString()} Credits deployed`;
      case 'RESERVE_GRANT': {
        // Grants carry the credited amount in `quantity` (not cents),
        // so prefer that over the cost-based credits derivation.
        const amount = e.quantity != null ? Math.round(e.quantity) : credits;
        return `Monthly Reserve Allocation received · ${amount.toLocaleString()} Credits granted`;
      }
      default:
        return `${this.missionLogOpLabel(e.operation_type)} · ${credits.toLocaleString()} Credits deployed`;
    }
  }

  /** Live-pulse class — toggled by hasAnyTodayActivity to suggest
   *  a heartbeat when ops are landing. CSS handles the keyframe. */
  livePulseActive(): boolean {
    return this.hasAnyTodayActivity();
  }

  // ── Polish pass: terminal-style timestamps + sparkline grounding ─

  /**
   * Bloomberg-style HH:MM:SS timestamp for the Mission Log. Reads as
   * an operational dispatch log rather than a notification stream.
   * Returns the time-of-day in 24h local format; on rows older than
   * today, falls back to a date prefix.
   */
  missionLogStamp(e: MissionLogEvent): string {
    if (!e.created_at) return '--:--:--';
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) return '--:--:--';
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const sameDay = d.toDateString() === today.toDateString();
    const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    if (sameDay) return hms;
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hms}`;
  }

  /** Sparkline annotations: latest value and 14-day peak. Used by the
   *  Intelligence Throughput card to ground the bars in real numbers. */
  sparklineTodayValue(): number {
    const series = this.wallet?.dailyBurn || [];
    if (series.length === 0) return 0;
    return series[series.length - 1]?.tokens || 0;
  }

  sparklinePeakValue(): number {
    const series = this.wallet?.dailyBurn || [];
    if (series.length === 0) return 0;
    return Math.max(...series.map(d => d.tokens || 0));
  }

  /** Latest day vs. previous day delta on the sparkline — used for the
   *  ▲ / ▼ chip beside the today value. */
  sparklineDeltaPct(): number {
    const series = this.wallet?.dailyBurn || [];
    if (series.length < 2) return 0;
    const today = series[series.length - 1]?.tokens || 0;
    const prev = series[series.length - 2]?.tokens || 0;
    if (prev <= 0) return today > 0 ? 100 : 0;
    return Math.round(((today - prev) / prev) * 100);
  }

  sparklineDeltaSymbol(): string {
    const d = this.sparklineDeltaPct();
    if (d > 0) return '▲';
    if (d < 0) return '▼';
    return '·';
  }

  sparklineDeltaColor(): string {
    const d = this.sparklineDeltaPct();
    if (d > 0) return '#00e676';
    if (d < 0) return '#ff8896';
    return '#7e8a9c';
  }

  /** Projected vs. last month — month-over-month delta for the
   *  Projected Monthly Throughput card. Uses the 14d burn average
   *  scaled to 30 days as a proxy for "this month's pace" when
   *  prior-month data isn't available. Visual only. */
  projectedMoMDelta(): { pct: number; symbol: string; color: string } {
    const proj = this.wallet?.projected;
    if (!proj || !proj.projected_cents) {
      return { pct: 0, symbol: '·', color: '#7e8a9c' };
    }
    // Use MTD vs. (projected / 30 * elapsed) — when ahead of pace,
    // the trajectory implies a higher run-rate vs. status quo.
    // For Phase 2 visual purposes, compare the projection to MTD * 4
    // (≈ the rough month-long extrapolation) so the arrow has
    // honest direction even without a prior-month anchor.
    const projected = proj.projected_cents;
    const mtdEx = (proj.mtd_cents || 0) * 4;
    if (mtdEx <= 0) return { pct: 0, symbol: '·', color: '#7e8a9c' };
    const pct = Math.round(((projected - mtdEx) / mtdEx) * 100);
    if (pct > 2)  return { pct, symbol: '▲', color: '#ff8896' };  // burning HOTTER than steady → caution color
    if (pct < -2) return { pct, symbol: '▼', color: '#00e676' };  // burning cooler → healthy
    return { pct, symbol: '·', color: '#7e8a9c' };
  }

  // ── Real-Time Activity Feed helpers ─────────────────────────────
  getActivityColor(eventType: string): string {
    const map: Record<string, string> = {
      fire_incident: '#ff1744',
      storm_incident: '#2979ff',
      crime_incident: '#aa00ff',
      lead_created: '#00e676',
      skip_trace_completed: '#00e5ff',
      voice_call: '#00e676',
      claim_opened: '#ff6d00',
      new_lead: '#00e676',
      claim_created: '#ff6d00',
      supplement_sent: '#ff6d00',
      payment_recorded: '#00e676',
      ai_call_completed: '#00e676',
      document_uploaded: '#2979ff',
    };
    return map[eventType] || '#64748b';
  }

  getActivityIcon(eventType: string): string {
    const map: Record<string, string> = {
      fire_incident: 'local_fire_department',
      storm_incident: 'thunderstorm',
      crime_incident: 'gavel',
      lead_created: 'person_add',
      skip_trace_completed: 'search',
      voice_call: 'phone_in_talk',
      claim_opened: 'assignment',
      new_lead: 'person_add',
      claim_created: 'assignment',
      supplement_sent: 'send',
      payment_recorded: 'payments',
      ai_call_completed: 'phone_in_talk',
      document_uploaded: 'upload_file',
    };
    return map[eventType] || 'notifications';
  }

  getActivityLabel(eventType: string): string {
    const map: Record<string, string> = {
      fire_incident: 'Fire Incident',
      storm_incident: 'Storm Event',
      crime_incident: 'Crime Report',
      lead_created: 'Lead Created',
      skip_trace_completed: 'Skip Trace',
      voice_call: 'Voice Call',
      claim_opened: 'Claim Opened',
      new_lead: 'Lead Created',
      claim_created: 'Claim Opened',
      supplement_sent: 'Supplement',
      payment_recorded: 'Payment',
      ai_call_completed: 'Voice Call',
      document_uploaded: 'Document',
    };
    return map[eventType] || eventType;
  }
}
