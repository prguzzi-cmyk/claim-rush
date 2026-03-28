import { Injectable } from '@angular/core';

import { ClaimFinancialEngineService } from './claim-financial-engine.service';
import { ClaimFinancialSnapshot, PaymentSummaryPayload } from '../models/claim-financials.model';
import {
  RecoveryStatus,
  RECOVERY_STATUS_META,
  ClaimRecoveryRecord,
  RecoveryDashboardMetrics,
  AdjusterPerformanceMetrics,
  MonthlyRecoveryTrend,
  DashboardFilter,
} from '../models/claim-recovery-metrics.model';

/**
 * ClaimRecoveryEngine
 *
 * Aggregation and computation engine for the recovery dashboard.
 * Builds on the existing ClaimFinancialEngine (per-claim calculations)
 * to produce dashboard-level aggregates, adjuster performance metrics,
 * and recovery status classifications.
 *
 * Does NOT duplicate:
 * - ClaimFinancialEngine (delegates per-claim math to it)
 * - Backend getClaimRecoveryDashboard() (consumes its response)
 * - Payment tracking (reads payment data, doesn't manage it)
 *
 * This is a pure computation service — no HTTP calls.
 */
@Injectable({ providedIn: 'root' })
export class ClaimRecoveryEngineService {

  constructor(private financialEngine: ClaimFinancialEngineService) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. Recovery Status Classification
  // ═══════════════════════════════════════════════════════════════

  /**
   * Classify the recovery status of a claim from its financial snapshot
   * and workflow phase.
   *
   * Reuses existing ClaimFinancialEngine for the underlying numbers.
   */
  classifyRecoveryStatus(
    financials: ClaimFinancialSnapshot,
    claimPhase: string | null,
    hasSupplementRequested: boolean = false,
  ): RecoveryStatus {
    const phase = (claimPhase || '').toLowerCase().replace(/[\s_-]+/g, '_');

    // Terminal states
    if (phase === 'closed' || phase === 'claim_closed' || phase === 'client_cancelled') {
      return 'closed';
    }

    // Fully recovered
    if (financials.paidToDate > 0 && financials.recoveryPercent >= 95) {
      return 'fully_recovered';
    }

    // Partial payment
    if (financials.paidToDate > 0 && financials.paidToDate < financials.aciEstimateTotal) {
      return 'partial_payment';
    }

    // Negotiation
    if (phase.includes('negotiation') || phase.includes('appraisal') || phase.includes('umpire')) {
      return 'negotiation';
    }

    // Supplement requested
    if (hasSupplementRequested || phase.includes('supplement')) {
      return 'supplement_requested';
    }

    // Carrier review
    if (phase.includes('carrier') || phase.includes('review') || phase.includes('insurance_company')) {
      return 'carrier_review';
    }

    // Default: estimating
    return 'estimating';
  }

  /**
   * Map raw backend recovery status strings to the normalized enum.
   */
  normalizeRecoveryStatus(raw: string): RecoveryStatus {
    const normalized = (raw || '').toLowerCase().replace(/[\s_-]+/g, '_');
    const mapping: Record<string, RecoveryStatus> = {
      open: 'estimating',
      estimating: 'estimating',
      carrier_review: 'carrier_review',
      supplement_sent: 'supplement_requested',
      supplement_requested: 'supplement_requested',
      negotiation: 'negotiation',
      partial_payment: 'partial_payment',
      paid_closed: 'fully_recovered',
      fully_recovered: 'fully_recovered',
      closed: 'closed',
    };
    return mapping[normalized] || 'estimating';
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Dashboard Aggregation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Transform raw backend dashboard data into the enriched metrics model.
   * Computes additional fields the backend doesn't provide.
   */
  enrichDashboardData(raw: any): RecoveryDashboardMetrics {
    const claims: ClaimRecoveryRecord[] = (raw.claims || []).map((c: any) =>
      this.buildRecoveryRecord(c)
    );

    const activeClaims = claims.filter(
      c => c.recoveryStatus !== 'closed' && c.recoveryStatus !== 'fully_recovered'
    );

    const totalRecovered = claims.reduce((s, c) => s + c.carrierPaidTotal, 0);
    const totalAci = claims.reduce((s, c) => s + c.aciEstimateTotal, 0);
    const totalCarrier = claims.reduce((s, c) => s + c.carrierEstimateTotal, 0);

    const totalSuppsRequested = claims.filter(
      c => c.supplementRequestedTotal > 0
    ).length;
    const totalSuppsRecovered = claims.filter(
      c => c.supplementRecoveredTotal > 0
    ).length;

    const avgRecovery = claims.length > 0 ? totalRecovered / claims.length : 0;
    const recoveryVsCarrier = totalCarrier > 0
      ? ((totalRecovered - totalCarrier) / totalCarrier) * 100
      : 0;

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    for (const c of claims) {
      statusCounts[c.recoveryStatus] = (statusCounts[c.recoveryStatus] || 0) + 1;
    }

    return {
      totalClaimsActive: activeClaims.length,
      totalCarrierEstimates: totalCarrier,
      totalAciEstimates: totalAci,
      totalSupplementsRequested: totalSuppsRequested,
      totalSupplementsRecovered: totalSuppsRecovered,
      averageRecoveryPerClaim: avgRecovery,
      recoveryPercentVsCarrier: recoveryVsCarrier,

      // Preserved for compatibility with existing template
      totalClaims: raw.total_claims || claims.length,
      totalAciValue: raw.total_aci_value || totalAci,
      totalCarrierValue: raw.total_carrier_value || totalCarrier,
      totalRecoverable: raw.total_recoverable || 0,
      totalRecovered: raw.total_recovered || totalRecovered,
      avgRecoveryPct: raw.avg_recovery_pct || 0,

      statusCounts,
      claims,
    };
  }

  /**
   * Build a per-claim recovery record from raw backend data.
   */
  private buildRecoveryRecord(raw: any): ClaimRecoveryRecord {
    const aciTotal = raw.aci_total || 0;
    const carrierTotal = raw.carrier_total || 0;
    const recovered = raw.recovered_amount || 0;
    const recoverable = raw.recoverable_amount || 0;

    // Use the shared financial engine for consistent calculations
    const snapshot = this.financialEngine.compute({
      aci_estimate_total: aciTotal,
      carrier_estimate_total: carrierTotal,
      total_paid: recovered,
    });

    const supplementRequested = Math.max(aciTotal - carrierTotal, 0);
    const supplementRecovered = recovered > carrierTotal
      ? Math.min(recovered - carrierTotal, supplementRequested)
      : 0;

    return {
      claimId: raw.claim_id || '',
      projectId: raw.project_id || '',
      claimNumber: raw.claim_number || raw.project_name || '',
      clientName: raw.client_name || '',
      carrierName: raw.carrier_name || '',
      assignedAdjusterId: raw.assigned_adjuster_id || null,
      assignedAdjusterName: raw.assigned_adjuster_name || null,

      carrierEstimateTotal: carrierTotal,
      aciEstimateTotal: aciTotal,
      supplementRequestedTotal: supplementRequested,
      supplementRecoveredTotal: supplementRecovered,
      carrierPaidTotal: recovered,
      totalRecoveryAboveCarrier: Math.max(recovered - carrierTotal, 0),
      remainingRecoverable: raw.remaining_recoverable || snapshot.unpaidGap,
      recoveryPercent: snapshot.recoveryPercent,

      recoveryStatus: this.normalizeRecoveryStatus(raw.recovery_status || ''),
      claimPhase: raw.claim_phase || null,
      createdAt: raw.created_at || null,
      lastPaymentDate: raw.last_payment_date || null,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Adjuster Performance Metrics
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compute per-adjuster performance metrics from claim records.
   */
  computeAdjusterMetrics(claims: ClaimRecoveryRecord[]): AdjusterPerformanceMetrics[] {
    const byAdjuster = new Map<string, ClaimRecoveryRecord[]>();

    for (const c of claims) {
      const id = c.assignedAdjusterId || 'unassigned';
      if (!byAdjuster.has(id)) byAdjuster.set(id, []);
      byAdjuster.get(id)!.push(c);
    }

    const metrics: AdjusterPerformanceMetrics[] = [];
    for (const [adjusterId, adjClaims] of byAdjuster) {
      if (adjusterId === 'unassigned') continue;

      const totalRecovery = adjClaims.reduce((s, c) => s + c.carrierPaidTotal, 0);
      const supplementsSubmitted = adjClaims.filter(c => c.supplementRequestedTotal > 0).length;
      const supplementsRecovered = adjClaims.filter(c => c.supplementRecoveredTotal > 0).length;
      const supplementSuccessRate = supplementsSubmitted > 0
        ? (supplementsRecovered / supplementsSubmitted) * 100
        : 0;

      // Estimate cycle time from created → last payment
      const cycleDays: number[] = [];
      for (const c of adjClaims) {
        if (c.createdAt && c.lastPaymentDate) {
          const start = new Date(c.createdAt);
          const end = new Date(c.lastPaymentDate);
          const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0) cycleDays.push(days);
        }
      }
      const avgCycle = cycleDays.length > 0
        ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
        : null;

      metrics.push({
        adjusterId,
        adjusterName: adjClaims[0]?.assignedAdjusterName || 'Unknown',
        claimsHandled: adjClaims.length,
        totalRecovery,
        averageRecoveryPerClaim: adjClaims.length > 0 ? totalRecovery / adjClaims.length : 0,
        supplementSuccessRate,
        avgClaimCycleDays: avgCycle,
        supplementsSubmitted,
        supplementsRecovered,
      });
    }

    // Sort by total recovery descending
    return metrics.sort((a, b) => b.totalRecovery - a.totalRecovery);
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Monthly Trend Computation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compute monthly recovery trends from claim records.
   */
  computeMonthlyTrends(claims: ClaimRecoveryRecord[]): MonthlyRecoveryTrend[] {
    const byMonth = new Map<string, MonthlyRecoveryTrend>();

    for (const c of claims) {
      const date = c.lastPaymentDate || c.createdAt;
      if (!date) continue;
      const month = date.substring(0, 7); // YYYY-MM

      if (!byMonth.has(month)) {
        byMonth.set(month, {
          month,
          recovered: 0,
          supplementsSubmitted: 0,
          supplementsRecovered: 0,
          claimsClosed: 0,
        });
      }
      const entry = byMonth.get(month)!;
      entry.recovered += c.carrierPaidTotal;
      if (c.supplementRequestedTotal > 0) entry.supplementsSubmitted++;
      if (c.supplementRecoveredTotal > 0) entry.supplementsRecovered++;
      if (c.recoveryStatus === 'fully_recovered' || c.recoveryStatus === 'closed') {
        entry.claimsClosed++;
      }
    }

    return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Role-Based Filtering
  // ═══════════════════════════════════════════════════════════════

  /**
   * Filter claims based on the user's role and filter settings.
   */
  applyRoleFilter(
    claims: ClaimRecoveryRecord[],
    filter: DashboardFilter,
  ): ClaimRecoveryRecord[] {
    let filtered = [...claims];

    // Role filter
    if (filter.role === 'agent' && filter.adjusterId) {
      filtered = filtered.filter(c => c.assignedAdjusterId === filter.adjusterId);
    } else if (filter.role === 'rvp' && filter.teamIds.length > 0) {
      const teamSet = new Set(filter.teamIds);
      filtered = filtered.filter(c => c.assignedAdjusterId && teamSet.has(c.assignedAdjusterId));
    }
    // 'owner' sees all — no filter

    // Status filter
    if (filter.recoveryStatus) {
      filtered = filtered.filter(c => c.recoveryStatus === filter.recoveryStatus);
    }

    // Date range filter
    if (filter.dateRange) {
      const start = new Date(filter.dateRange.start).getTime();
      const end = new Date(filter.dateRange.end).getTime();
      filtered = filtered.filter(c => {
        const d = c.createdAt ? new Date(c.createdAt).getTime() : 0;
        return d >= start && d <= end;
      });
    }

    return filtered;
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Chart Data Builders
  // ═══════════════════════════════════════════════════════════════

  /** Build ngx-charts data for recovery by adjuster. */
  buildAdjusterChartData(metrics: AdjusterPerformanceMetrics[]): any[] {
    return metrics.slice(0, 10).map(m => ({
      name: m.adjusterName,
      value: m.totalRecovery,
    }));
  }

  /** Build ngx-charts data for monthly recovery trend. */
  buildMonthlyChartData(trends: MonthlyRecoveryTrend[]): any[] {
    return trends.map(t => ({
      name: t.month,
      value: t.recovered,
    }));
  }

  /** Build ngx-charts data for supplement success rate. */
  buildSupplementSuccessData(metrics: AdjusterPerformanceMetrics[]): any[] {
    const totalSubmitted = metrics.reduce((s, m) => s + m.supplementsSubmitted, 0);
    const totalRecovered = metrics.reduce((s, m) => s + m.supplementsRecovered, 0);
    const totalFailed = totalSubmitted - totalRecovered;
    return [
      { name: 'Recovered', value: totalRecovered },
      { name: 'Pending/Failed', value: Math.max(totalFailed, 0) },
    ];
  }

  /** Build ngx-charts data for recovery status distribution. */
  buildStatusChartData(statusCounts: Record<string, number>): any[] {
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: RECOVERY_STATUS_META[status as RecoveryStatus]?.label || status,
      value: count,
    }));
  }
}
