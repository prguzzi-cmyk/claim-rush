/**
 * Treasury Operations Console — Phase 3A
 *
 * Admin-only surface at /app/admin/treasury. First slice exposes the
 * live Pricing Editor backed by /v1/admin/treasury/pricing. Later
 * slices (3B–3D) will add Allocations, Reward Catalog, Grants,
 * Analytics, Vendor Split, and Reversal sections to the same shell —
 * each rendered as a peer card inside the .treasury-console layout.
 *
 * Design intent: enterprise mission-control feel that matches the
 * Operational Reserve panel on /app/dashboard/intelligence. NO admin
 * CRUD table look. Numbers in monospace, glow accents, calm tone.
 */

import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

interface PricingItem {
  key: string;
  label: string;
  live_value: number;
  fallback_value: number;
  source: 'db' | 'fallback';
}

interface AllocationItem {
  slug: string;
  label: string;
  role_kinds: string[];
  live_value: number;
  fallback_value: number;
  source: 'db' | 'fallback';
  active_user_count: number;
  projected_monthly_issuance: number;
}

interface AllocationsResponse {
  items: AllocationItem[];
  count: number;
  total_active_users: number;
  total_projected_monthly_issuance: number;
}

interface RewardItem {
  key: string;
  label: string;
  live_value: number;
  fallback_value: number;
  source: 'db' | 'fallback';
}

interface AnalyticsTopRow {
  operation_type: string;
  event_count: number;
  credits_generated?: number;
  credits_consumed?: number;
}

interface TreasuryAnalytics {
  window_days: number;
  total_reserve_generated_window: number;
  total_reserve_consumed_window: number;
  top_reserve_generating_events: AnalyticsTopRow[];
  top_burn_operations: AnalyticsTopRow[];
  estimated_monthly_treasury_exposure: number;
  schema_pending: boolean;
}

interface TopSpender {
  actor_user_id: string;
  actor_role: string | null;
  tokens: number;
  cents: number;
  calls: number;
}
interface DailyBurnPoint {
  date: string;
  tokens: number;
  cents: number;
  events: number;
}
interface ProjectedMonthly {
  mtd_tokens: number;
  projected_tokens: number;
}

interface AuditRow {
  id: string;
  config_key: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string | null;
  note: string | null;
}

@Component({
  selector: 'app-treasury-operations',
  templateUrl: './treasury-operations.component.html',
  styleUrls: ['./treasury-operations.component.scss'],
  standalone: false,
})
export class TreasuryOperationsComponent implements OnInit {

  loading = true;
  loadError: string | null = null;

  /** Live pricing rows from the backend (current effective values + provenance). */
  pricing: PricingItem[] = [];

  /** Editor state — per-row staged input. Mirrors `pricing` 1:1 on load. */
  editValues: Record<string, number> = {};

  /** Note attached to the next Save click — surfaces in the audit log. */
  saveNote = '';

  /** True while the save round-trip is in flight. */
  saving = false;

  /** Recent treasury edits, newest first. Refreshed after every save. */
  audit: AuditRow[] = [];

  // ── Phase 3B — Monthly Reserve Allocations ─────────────────────────
  allocations: AllocationItem[] = [];
  allocationsTotalActiveUsers = 0;
  allocationsTotalProjectedIssuance = 0;
  editAllocations: Record<string, number> = {};
  allocationsSaveNote = '';
  savingAllocations = false;

  // ── Phase 3C — Production Reward Catalog ───────────────────────────
  rewards: RewardItem[] = [];
  editRewards: Record<string, number> = {};
  rewardsSaveNote = '';
  savingRewards = false;

  // ── Phase 3C — Treasury Analytics ──────────────────────────────────
  analytics: TreasuryAnalytics | null = null;
  topSpenders: TopSpender[] = [];
  dailyBurn: DailyBurnPoint[] = [];
  projected: ProjectedMonthly | null = null;

  constructor(
    private http: HttpClient,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.loadError = null;

    this.http.get<{ items: PricingItem[] }>('admin/treasury/pricing').subscribe({
      next: (resp) => {
        this.pricing = resp.items || [];
        this.editValues = {};
        for (const p of this.pricing) {
          this.editValues[p.key] = p.live_value;
        }
        this.loading = false;
      },
      error: (err) => {
        const code = err?.status || 0;
        if (code === 403) {
          this.loadError = 'Treasury Operations Console requires an admin role.';
        } else {
          this.loadError = `Could not load treasury pricing (HTTP ${code}).`;
        }
        this.loading = false;
      },
    });

    this.http.get<{ items: AuditRow[] }>(
      'admin/treasury/audit-log?limit=30',
    ).subscribe({
      next: (resp) => { this.audit = resp.items || []; },
      error: () => { /* audit log is supplementary — don't tank the page */ },
    });

    // Phase 3B — Monthly Reserve Allocations.
    this.http.get<AllocationsResponse>('admin/treasury/allocations').subscribe({
      next: (resp) => {
        this.allocations = resp.items || [];
        this.allocationsTotalActiveUsers = resp.total_active_users || 0;
        this.allocationsTotalProjectedIssuance = resp.total_projected_monthly_issuance || 0;
        this.editAllocations = {};
        for (const a of this.allocations) {
          this.editAllocations[a.slug] = a.live_value;
        }
      },
      error: () => { /* allocations card stays in loading state if it 4xx's */ },
    });

    // Phase 3C — Production Reward Catalog.
    this.http.get<{ items: RewardItem[] }>('admin/treasury/rewards').subscribe({
      next: (resp) => {
        this.rewards = resp.items || [];
        this.editRewards = {};
        for (const r of this.rewards) {
          this.editRewards[r.key] = r.live_value;
        }
      },
      error: () => { /* rewards card stays in loading state if it 4xx's */ },
    });

    // Phase 3C — Treasury Analytics (one new endpoint + 3 existing).
    this.http.get<TreasuryAnalytics>('admin/treasury/analytics?days=30').subscribe({
      next: (resp) => { this.analytics = resp; },
      error: () => { /* analytics card shows empty state */ },
    });
    this.http.get<{ items: TopSpender[] }>('admin/usage/top-spenders?hours=720&limit=8').subscribe({
      next: (resp) => { this.topSpenders = resp.items || []; },
      error: () => {},
    });
    this.http.get<{ series: DailyBurnPoint[] }>('admin/usage/daily-burn?days=14').subscribe({
      next: (resp) => { this.dailyBurn = resp.series || []; },
      error: () => {},
    });
    this.http.get<ProjectedMonthly>('admin/usage/projected-monthly').subscribe({
      next: (resp) => { this.projected = resp; },
      error: () => {},
    });
  }

  // ── Pricing save helpers (already present, untouched) ────────────

  /** True if any input value differs from the live server value. */
  hasUnsavedChanges(): boolean {
    return this.pricing.some(p => this.editValues[p.key] !== p.live_value);
  }

  /** Returns just the operations whose value changed. */
  private changedKeys(): string[] {
    return this.pricing
      .filter(p => this.editValues[p.key] !== p.live_value)
      .map(p => p.key);
  }

  /** Bulk save — single round-trip, single audit batch. */
  save(): void {
    if (!this.hasUnsavedChanges() || this.saving) return;

    const updates: Record<string, number> = {};
    const changed = this.changedKeys();

    for (const key of changed) {
      const value = Number(this.editValues[key]);
      if (!Number.isFinite(value) || value < 0) {
        this.snack.open(
          `Invalid value for ${key}. Treasury values must be ≥ 0.`,
          'Dismiss',
          { duration: 5000 },
        );
        return;
      }
      updates[key] = Math.round(value);
    }

    // Confirmation prompt for materially large jumps. Safety net so a
    // mis-typed extra digit doesn't ship straight through.
    const bigJump = changed.find(k => {
      const live = this.pricing.find(p => p.key === k)?.live_value ?? 0;
      const next = updates[k];
      return live > 0 && (next > live * 5 || next < live / 5);
    });
    if (bigJump) {
      const ok = window.confirm(
        `One or more prices change by more than 5×. ` +
        `Please confirm you want to apply this edit.`,
      );
      if (!ok) return;
    }

    this.saving = true;
    this.http.put<{ applied: any[] }>('admin/treasury/pricing', {
      updates,
      note: this.saveNote?.trim() || null,
    }).subscribe({
      next: (resp) => {
        this.saving = false;
        this.snack.open(
          `Treasury pricing updated · ${resp.applied?.length || 0} key(s) live.`,
          'OK',
          { duration: 4000 },
        );
        this.saveNote = '';
        this.refresh();
      },
      error: (err) => {
        this.saving = false;
        const detail = err?.error?.detail || err?.statusText || `HTTP ${err?.status}`;
        this.snack.open(`Treasury update failed: ${detail}`, 'Dismiss', { duration: 6000 });
      },
    });
  }

  /** Reset all rows to their live server values. */
  cancelEdits(): void {
    for (const p of this.pricing) {
      this.editValues[p.key] = p.live_value;
    }
    this.saveNote = '';
  }

  /** Helper for the template — Δ from live, signed. */
  deltaFor(row: PricingItem): number {
    return (this.editValues[row.key] ?? row.live_value) - row.live_value;
  }
  deltaPercent(row: PricingItem): number {
    if (!row.live_value) return 0;
    return Math.round((this.deltaFor(row) / row.live_value) * 100);
  }

  /** Audit row helper — humanize timestamp + key. */
  fmtTimestamp(ts: string | null): string {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
    } catch { return ''; }
  }
  fmtKey(k: string): string {
    return k.replace(/^pricing\./, '').replace(/^allocation\./, '');
  }

  // ── Phase 3B Allocation helpers ────────────────────────────────────

  hasAllocationChanges(): boolean {
    return this.allocations.some(a => this.editAllocations[a.slug] !== a.live_value);
  }

  private changedAllocationSlugs(): string[] {
    return this.allocations
      .filter(a => this.editAllocations[a.slug] !== a.live_value)
      .map(a => a.slug);
  }

  saveAllocations(): void {
    if (!this.hasAllocationChanges() || this.savingAllocations) return;

    const updates: Record<string, number> = {};
    for (const slug of this.changedAllocationSlugs()) {
      const value = Number(this.editAllocations[slug]);
      if (!Number.isFinite(value) || value < 0) {
        this.snack.open(
          `Invalid value for ${slug}. Allocation must be ≥ 0.`,
          'Dismiss',
          { duration: 5000 },
        );
        return;
      }
      updates[slug] = Math.round(value);
    }

    // 5× confirmation prompt — same protection as pricing.
    const bigJump = this.changedAllocationSlugs().find(s => {
      const live = this.allocations.find(a => a.slug === s)?.live_value ?? 0;
      const next = updates[s];
      return live > 0 && (next > live * 5 || next < live / 5);
    });
    if (bigJump) {
      const ok = window.confirm(
        `One or more allocations change by more than 5×. ` +
        `Please confirm before applying.`,
      );
      if (!ok) return;
    }

    this.savingAllocations = true;
    this.http.put<{ applied: any[] }>('admin/treasury/allocations', {
      updates,
      note: this.allocationsSaveNote?.trim() || null,
    }).subscribe({
      next: (resp) => {
        this.savingAllocations = false;
        this.snack.open(
          `Allocations updated · ${resp.applied?.length || 0} tier(s) live.`,
          'OK',
          { duration: 4000 },
        );
        this.allocationsSaveNote = '';
        this.refresh();
      },
      error: (err) => {
        this.savingAllocations = false;
        const detail = err?.error?.detail || err?.statusText || `HTTP ${err?.status}`;
        this.snack.open(`Allocation update failed: ${detail}`, 'Dismiss', { duration: 6000 });
      },
    });
  }

  cancelAllocationEdits(): void {
    for (const a of this.allocations) {
      this.editAllocations[a.slug] = a.live_value;
    }
    this.allocationsSaveNote = '';
  }

  allocationDelta(row: AllocationItem): number {
    return (this.editAllocations[row.slug] ?? row.live_value) - row.live_value;
  }
  allocationDeltaPct(row: AllocationItem): number {
    if (!row.live_value) return 0;
    return Math.round((this.allocationDelta(row) / row.live_value) * 100);
  }

  /** Projected issuance using the STAGED edit value × current active count.
   *  Lets the admin preview "if I save this, treasury will issue ~$X next cycle". */
  stagedProjectedIssuance(row: AllocationItem): number {
    const staged = this.editAllocations[row.slug] ?? row.live_value;
    return staged * row.active_user_count;
  }

  // ── Phase 3C Reward catalog helpers ─────────────────────────────────

  hasRewardChanges(): boolean {
    return this.rewards.some(r => this.editRewards[r.key] !== r.live_value);
  }
  private changedRewardKeys(): string[] {
    return this.rewards
      .filter(r => this.editRewards[r.key] !== r.live_value)
      .map(r => r.key);
  }
  rewardDelta(row: RewardItem): number {
    return (this.editRewards[row.key] ?? row.live_value) - row.live_value;
  }
  rewardDeltaPct(row: RewardItem): number {
    if (!row.live_value) return 0;
    return Math.round((this.rewardDelta(row) / row.live_value) * 100);
  }
  saveRewards(): void {
    if (!this.hasRewardChanges() || this.savingRewards) return;

    const updates: Record<string, number> = {};
    for (const key of this.changedRewardKeys()) {
      const value = Number(this.editRewards[key]);
      if (!Number.isFinite(value) || value < 0) {
        this.snack.open(
          `Invalid value for ${key}. Reward must be ≥ 0.`,
          'Dismiss',
          { duration: 5000 },
        );
        return;
      }
      updates[key] = Math.round(value);
    }
    const bigJump = this.changedRewardKeys().find(k => {
      const live = this.rewards.find(r => r.key === k)?.live_value ?? 0;
      const next = updates[k];
      return live > 0 && (next > live * 5 || next < live / 5);
    });
    if (bigJump) {
      const ok = window.confirm(
        `One or more reward amounts change by more than 5×. Confirm to apply.`,
      );
      if (!ok) return;
    }
    this.savingRewards = true;
    this.http.put<{ applied: any[] }>('admin/treasury/rewards', {
      updates,
      note: this.rewardsSaveNote?.trim() || null,
    }).subscribe({
      next: (resp) => {
        this.savingRewards = false;
        this.snack.open(
          `Reward catalog updated · ${resp.applied?.length || 0} event(s) live.`,
          'OK',
          { duration: 4000 },
        );
        this.rewardsSaveNote = '';
        this.refresh();
      },
      error: (err) => {
        this.savingRewards = false;
        const detail = err?.error?.detail || err?.statusText || `HTTP ${err?.status}`;
        this.snack.open(`Reward update failed: ${detail}`, 'Dismiss', { duration: 6000 });
      },
    });
  }
  cancelRewardEdits(): void {
    for (const r of this.rewards) {
      this.editRewards[r.key] = r.live_value;
    }
    this.rewardsSaveNote = '';
  }
  /** Strip the "reward." prefix for compact display. */
  rewardShortKey(k: string): string {
    return k.replace(/^reward\./, '');
  }

  // ── Phase 3C Analytics helpers ──────────────────────────────────────

  /** Humanize a reward operation_type into the same label the editor uses. */
  rewardLabelFor(operationType: string): string {
    const r = this.rewards.find(x => x.key === operationType);
    if (r) return r.label;
    // Treasury grants come through as "treasury.<kind>".
    if (operationType.startsWith('treasury.')) {
      return 'Treasury Grant · ' + operationType.replace(/^treasury\./, '');
    }
    return operationType;
  }

  /** Reuse the pricing label when known; else fall through to op_type. */
  pricingLabelFor(operationType: string): string {
    const p = this.pricing.find(x => x.key === operationType);
    return p ? p.label : operationType;
  }

  /** Peak daily burn in the last 14 days — used to scale the sparkline. */
  dailyBurnPeak(): number {
    if (!this.dailyBurn.length) return 0;
    return Math.max(...this.dailyBurn.map(d => d.tokens || 0));
  }

  /** Render a single sparkline bar height (0–100). */
  dailyBurnBarHeight(point: DailyBurnPoint): number {
    const peak = this.dailyBurnPeak();
    if (!peak || !point.tokens) return 2;
    return Math.max(4, Math.round((point.tokens / peak) * 100));
  }

  /** Compact "May 17" stamp for sparkline tick labels. */
  dailyBurnLabel(point: DailyBurnPoint): string {
    if (!point?.date) return '';
    try {
      return new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return point.date; }
  }
}
