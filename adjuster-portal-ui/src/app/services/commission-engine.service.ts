import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActiveClaimContribution,
  AdminOverviewView,
  AgentSimpleEarningsView,
  ClaimEarningsRow,
  EarningsTrendView,
  FinancialDetailView,
  NextExpectedPayoutView,
  RecentActivityItem,
  StatementPeriod,
  StatementPeriodType,
  StatementView,
  Taxable1099View,
} from '../models/commission-engine.model';
import { CommissionEngineDataService } from './commission-engine-data.service';

/**
 * Commission engine selector surface.
 *
 * Each selector delegates to CommissionEngineDataService (HTTP-backed
 * against /v1/commission). The backend holds the authoritative ledger and
 * does the split math; this service is a thin pass-through so the engine
 * interface the components import stays stable as we swap transports.
 *
 * The only synchronous helper here is `buildPeriod()` — the statement
 * dialog's period-picker is UI-only and doesn't need a round-trip to build
 * a StatementPeriod object.
 */
@Injectable({ providedIn: 'root' })
export class CommissionEngineService {
  constructor(private readonly data: CommissionEngineDataService) {}

  // ─── Per-agent selectors ──────────────────────────────────────────────

  getAgentSimpleEarnings(userId: string): Observable<AgentSimpleEarningsView> {
    return this.data.getAgentSimpleEarnings$(userId);
  }

  getEarningsTrend(userId: string): Observable<EarningsTrendView> {
    return this.data.getEarningsTrend$(userId);
  }

  getRecentActivity(userId: string, limit: number = 6): Observable<RecentActivityItem[]> {
    return this.data.getRecentActivity$(userId, limit);
  }

  getActiveClaimContributions(userId: string): Observable<ActiveClaimContribution[]> {
    return this.data.getActiveClaimContributions$(userId);
  }

  getClaimEarningsTable(userId: string): Observable<ClaimEarningsRow[]> {
    return this.data.getClaimEarningsTable$(userId);
  }

  getNextExpectedPayout(userId: string): Observable<NextExpectedPayoutView> {
    return this.data.getNextExpectedPayout$(userId);
  }

  getTaxable1099YTD(userId: string, year?: number): Observable<Taxable1099View> {
    return this.data.getTaxable1099YTD$(userId, year);
  }

  getStatement(userId: string, period: StatementPeriod): Observable<StatementView> {
    return this.data.getStatement$(userId, period);
  }

  getFinancialDetail(userId: string): Observable<FinancialDetailView> {
    return this.data.getFinancialDetail$(userId);
  }

  // ─── Admin ────────────────────────────────────────────────────────────

  getAdminOverview(): Observable<AdminOverviewView> {
    return this.data.getAdminOverview$();
  }

  // ─── Synchronous helpers (UI-only; no backend) ────────────────────────

  /**
   * Build a canonical StatementPeriod from a type + anchor date. Used by the
   * statement dialog's period picker — no backend call involved.
   */
  buildPeriod(
    type: StatementPeriodType,
    anchorIso: string,
    customStart?: string,
    customEnd?: string,
  ): StatementPeriod {
    const anchor = new Date(anchorIso);
    let start: Date, end: Date, label: string;

    if (type === 'week') {
      const d = new Date(anchor);
      const day = d.getUTCDay();
      const diffToMon = (day + 6) % 7;
      start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMon));
      end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6, 23, 59, 59));
      label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
    } else if (type === 'month') {
      start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
      end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 23, 59, 59));
      label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    } else if (type === 'year') {
      start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
      end = new Date(Date.UTC(anchor.getUTCFullYear(), 11, 31, 23, 59, 59));
      label = String(anchor.getUTCFullYear());
    } else {
      start = new Date(customStart!);
      end = new Date(customEnd!);
      label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
    }

    return { type, start: start.toISOString(), end: end.toISOString(), label };
  }
}
