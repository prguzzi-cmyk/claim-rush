import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { Claim } from 'src/app/models/claim.model';
import { ClaimService } from 'src/app/services/claim.service';
import { ClaimFinancialEngineService } from './claim-financial-engine.service';
import { ClaimRecoveryEngineService } from './claim-recovery-engine.service';
import { RecoveryStatus } from '../models/claim-recovery-metrics.model';
import { EngagementStatus } from '../models/claim-engagement.model';
import {
  ClaimActionStatus,
  ACTION_STATUS_META,
  ClaimActivitySignals,
  CommandCenterClaimView,
  ActionQueue,
  CommandCenterMetrics,
  CommandCenterFilter,
} from '../models/command-center.model';

/**
 * CommandCenterEngine
 *
 * Aggregates claim workflow state, tasks, communications, financial data,
 * and engagement status into actionable queues and metrics.
 *
 * Integrates with (does NOT duplicate):
 * - ClaimService (claim list, tasks, payments, communications, timeline)
 * - ClaimFinancialEngine (per-claim financial math)
 * - ClaimRecoveryEngine (recovery status classification)
 * - ClaimStatusEngine (phase normalization — consumed indirectly)
 * - ClaimEngagementEngine (engagement status — consumed indirectly)
 *
 * Fetches raw data from ClaimService, delegates computation to engines,
 * and assembles the unified command center view.
 */
@Injectable({ providedIn: 'root' })
export class CommandCenterEngineService {

  constructor(
    private claimService: ClaimService,
    private financialEngine: ClaimFinancialEngineService,
    private recoveryEngine: ClaimRecoveryEngineService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. Build Command Center View from Claims
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build a CommandCenterClaimView from a Claim and its aggregated data.
   * This is the core transformation — one claim becomes one actionable row.
   */
  buildClaimView(
    claim: Claim,
    paymentSummary: any,
    tasks: any[],
    communications: any[],
    timeline: any[],
  ): CommandCenterClaimView {
    // Financial snapshot via shared engine
    const financials = this.financialEngine.compute({
      aci_estimate_total: paymentSummary?.aci_estimate_total || 0,
      carrier_estimate_total: paymentSummary?.carrier_estimate_total || 0,
      total_paid: paymentSummary?.total_paid || 0,
    });

    // Task summary
    const overdueTasks = tasks.filter(t =>
      t.status === 'pending' && t.due_date && new Date(t.due_date) < new Date()
    ).length;
    const pendingTasks = tasks.filter(t =>
      t.status === 'pending' || t.status === 'in-progress'
    ).length;

    // Communication summary
    const unread = communications.filter((c: any) =>
      c.direction === 'inbound' && !c.is_read
    ).length;
    const lastComm = communications.length > 0 ? communications[0]?.created_at : null;

    // Activity signals
    const lastActivity = timeline.length > 0 ? timeline[0]?.timestamp : null;
    const daysSinceActivity = lastActivity
      ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const hasNewPayment = timeline.some((e: any) =>
      e.activity_type === 'payment-issued' && this.isWithinDays(e.timestamp, 3)
    );
    const hasNewCarrier = timeline.some((e: any) =>
      e.activity_type === 'carrier-estimate-received' && this.isWithinDays(e.timestamp, 7)
    );

    const signals: ClaimActivitySignals = {
      hasUnreadCommunications: unread > 0,
      hasOverdueTasks: overdueTasks > 0,
      isStalled: daysSinceActivity !== null && daysSinceActivity > 14,
      hasNewPayment,
      hasNewCarrierResponse: hasNewCarrier,
      daysSinceLastActivity: daysSinceActivity,
    };

    // Action status classification
    const actionStatus = this.classifyActionStatus(
      claim, financials, tasks, timeline, signals
    );

    // Recovery status
    const recoveryStatus = this.recoveryEngine.classifyRecoveryStatus(
      financials,
      claim.current_phase || null,
      financials.supplementOpportunity,
    );

    // Engagement status (simplified — full computation requires engagement engine)
    const engagementStatus = this.inferEngagementStatus(signals, daysSinceActivity);

    // Adjuster info
    const adjusterName = claim.assigned_user
      ? `${claim.assigned_user.first_name || ''} ${claim.assigned_user.last_name || ''}`.trim()
      : null;

    // Property address
    const address = [claim.address_loss, claim.city_loss, claim.state_loss].filter(Boolean).join(', ');

    return {
      claimId: claim.id,
      claimNumber: claim.claim_number || '',
      refString: claim.ref_string || '',
      clientName: claim.client?.full_name || '',
      carrierName: claim.insurance_company || '',
      propertyAddress: address,
      assignedAdjusterId: claim.assigned_to || null,
      assignedAdjusterName: adjusterName,

      currentPhase: claim.current_phase || '',
      actionStatus,
      recoveryStatus,
      engagementStatus,

      aciEstimate: financials.aciEstimateTotal,
      carrierEstimate: financials.carrierEstimateTotal,
      supplementTotal: financials.recoverableGap,
      totalPaid: financials.paidToDate,
      recoveryPercent: financials.recoveryPercent,

      totalTasks: tasks.length,
      overdueTasks,
      pendingTasks,

      unreadCount: unread,
      lastCommunicationDate: lastComm,

      signals,

      createdAt: claim.created_at ? new Date(claim.created_at).toISOString() : '',
      lastActivityDate: lastActivity,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Action Status Classification
  // ═══════════════════════════════════════════════════════════════

  private classifyActionStatus(
    claim: Claim,
    financials: any,
    tasks: any[],
    timeline: any[],
    signals: ClaimActivitySignals,
  ): ClaimActionStatus {
    const phase = (claim.current_phase || '').toLowerCase();

    // Terminal
    if (phase.includes('closed') || phase.includes('cancelled')) {
      return 'claim_closed';
    }

    // Payment received recently
    if (signals.hasNewPayment && financials.recoveryPercent >= 95) {
      return 'payment_received';
    }

    // Awaiting payment
    if (financials.supplementOpportunity && financials.paidToDate > 0 && financials.paidToDate < financials.aciEstimateTotal) {
      return 'awaiting_payment';
    }

    // Supplement submitted — waiting for carrier
    const hasSupplementEmail = timeline.some((e: any) => e.activity_type === 'supplement-email-sent');
    if (hasSupplementEmail && !signals.hasNewPayment) {
      return 'supplement_submitted';
    }

    // Supplement required — ACI > carrier but not yet sent
    if (financials.supplementOpportunity && financials.carrierEstimateTotal > 0 && !hasSupplementEmail) {
      return 'supplement_required';
    }

    // Awaiting carrier response — carrier estimate submitted, waiting for reply
    if (phase.includes('carrier') || phase.includes('review') || phase.includes('insurance')) {
      return 'awaiting_carrier_response';
    }

    // Needs estimate
    if (financials.aciEstimateTotal === 0 || phase.includes('intake') || phase.includes('inspection') || phase.includes('estimate')) {
      return 'needs_estimate';
    }

    // Default: awaiting carrier
    return 'awaiting_carrier_response';
  }

  private inferEngagementStatus(
    signals: ClaimActivitySignals,
    daysSince: number | null,
  ): EngagementStatus {
    if (signals.isStalled) return 'stalled';
    if (signals.hasOverdueTasks) return 'escalation_pending';
    if (signals.hasUnreadCommunications) return 'waiting_on_client';
    if (daysSince !== null && daysSince <= 3) return 'responsive';
    if (daysSince !== null && daysSince <= 7) return 'active';
    return 'waiting_on_client';
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Action Queues
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build action queues from a list of claim views.
   */
  buildActionQueues(claims: CommandCenterClaimView[]): ActionQueue[] {
    const queueMap = new Map<ClaimActionStatus, CommandCenterClaimView[]>();

    for (const c of claims) {
      if (!queueMap.has(c.actionStatus)) queueMap.set(c.actionStatus, []);
      queueMap.get(c.actionStatus)!.push(c);
    }

    const queues: ActionQueue[] = [];
    for (const [status, meta] of Object.entries(ACTION_STATUS_META)) {
      const items = queueMap.get(status as ClaimActionStatus) || [];
      queues.push({
        actionStatus: status as ClaimActionStatus,
        label: meta.queueName,
        icon: meta.icon,
        color: meta.color,
        claims: items.sort((a, b) => (a.signals.daysSinceLastActivity || 0) - (b.signals.daysSinceLastActivity || 0)),
        count: items.length,
      });
    }

    return queues.sort((a, b) =>
      ACTION_STATUS_META[a.actionStatus].priority - ACTION_STATUS_META[b.actionStatus].priority
    );
  }

  /**
   * Get specific focused queues (non-empty, non-closed).
   */
  getActiveQueues(queues: ActionQueue[]): ActionQueue[] {
    return queues.filter(q => q.count > 0 && q.actionStatus !== 'claim_closed');
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Dashboard Metrics
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compute command center metrics from claim views.
   */
  computeMetrics(claims: CommandCenterClaimView[]): CommandCenterMetrics {
    const today = new Date().toISOString().split('T')[0];
    const byAction: Record<ClaimActionStatus, number> = {
      needs_estimate: 0, awaiting_carrier_response: 0,
      supplement_required: 0, supplement_submitted: 0,
      awaiting_payment: 0, payment_received: 0, claim_closed: 0,
    };

    let activeClaims = 0;
    let needingAction = 0;
    let supplementsPending = 0;
    let paymentsToday = 0;
    let totalRecovered = 0;
    let overdueTasks = 0;
    let stalledClaims = 0;
    let unreadComms = 0;

    for (const c of claims) {
      byAction[c.actionStatus]++;
      totalRecovered += c.totalPaid;

      if (c.actionStatus !== 'claim_closed') {
        activeClaims++;
      }

      if (c.actionStatus === 'needs_estimate' || c.actionStatus === 'supplement_required') {
        needingAction++;
      }

      if (c.actionStatus === 'supplement_required' || c.actionStatus === 'supplement_submitted') {
        supplementsPending++;
      }

      if (c.signals.hasNewPayment && c.lastActivityDate?.startsWith(today)) {
        paymentsToday++;
      }

      overdueTasks += c.overdueTasks;
      if (c.signals.isStalled) stalledClaims++;
      unreadComms += c.unreadCount;
    }

    return {
      activeClaims,
      claimsNeedingAction: needingAction,
      supplementsPending,
      paymentsIssuedToday: paymentsToday,
      totalRecovered,
      byActionStatus: byAction,
      overdueTaskCount: overdueTasks,
      stalledClaimCount: stalledClaims,
      unreadCommunicationCount: unreadComms,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Role-Based Filtering
  // ═══════════════════════════════════════════════════════════════

  /**
   * Filter claim views by role and optional filters.
   */
  applyFilter(
    claims: CommandCenterClaimView[],
    filter: CommandCenterFilter,
  ): CommandCenterClaimView[] {
    let filtered = [...claims];

    if (filter.role === 'agent' && filter.adjusterId) {
      filtered = filtered.filter(c => c.assignedAdjusterId === filter.adjusterId);
    } else if (filter.role === 'rvp' && filter.teamIds.length > 0) {
      const teamSet = new Set(filter.teamIds);
      filtered = filtered.filter(c => c.assignedAdjusterId && teamSet.has(c.assignedAdjusterId));
    }

    if (filter.actionStatus) {
      filtered = filtered.filter(c => c.actionStatus === filter.actionStatus);
    }

    if (filter.phase) {
      filtered = filtered.filter(c =>
        c.currentPhase.toLowerCase().includes(filter.phase!.toLowerCase())
      );
    }

    return filtered;
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Signal-Based Highlighting
  // ═══════════════════════════════════════════════════════════════

  /** Get claims with unread communications. */
  getClaimsWithUnread(claims: CommandCenterClaimView[]): CommandCenterClaimView[] {
    return claims.filter(c => c.signals.hasUnreadCommunications);
  }

  /** Get claims with overdue tasks. */
  getClaimsWithOverdueTasks(claims: CommandCenterClaimView[]): CommandCenterClaimView[] {
    return claims.filter(c => c.signals.hasOverdueTasks);
  }

  /** Get stalled claims. */
  getStalledClaims(claims: CommandCenterClaimView[]): CommandCenterClaimView[] {
    return claims.filter(c => c.signals.isStalled);
  }

  /** Get claims with new payments. */
  getClaimsWithNewPayments(claims: CommandCenterClaimView[]): CommandCenterClaimView[] {
    return claims.filter(c => c.signals.hasNewPayment);
  }

  // ═══════════════════════════════════════════════════════════════
  // Private Utilities
  // ═══════════════════════════════════════════════════════════════

  private isWithinDays(dateStr: string, days: number): boolean {
    if (!dateStr) return false;
    const diff = Date.now() - new Date(dateStr).getTime();
    return diff <= days * 24 * 60 * 60 * 1000;
  }
}
