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
      'admin/treasury/audit-log?section=pricing&limit=20',
    ).subscribe({
      next: (resp) => { this.audit = resp.items || []; },
      error: () => { /* audit log is supplementary — don't tank the page */ },
    });
  }

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
    return k.replace(/^pricing\./, '');
  }
}
