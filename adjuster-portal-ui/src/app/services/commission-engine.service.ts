import { Injectable } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ActiveClaimContribution,
  AdminAggregateRow,
  AdminOverviewView,
  AdvanceSupportView,
  AgentSimpleEarningsView,
  BalanceCardView,
  CLAIM_STAGE_LABELS,
  CLAIM_STAGE_ORDER,
  Claim,
  ClaimEarningsRow,
  ClaimStage,
  ClaimTwoSectionBreakdown,
  CommissionBucket,
  EarningsSummaryView,
  EarningsTrendPoint,
  EarningsTrendView,
  FinancialDetailRow,
  FinancialDetailView,
  LedgerTransaction,
  LedgerTransactionType,
  MonthlyTarget,
  NextExpectedPayoutView,
  OrgRole,
  RecentActivityItem,
  StageCard,
  StatementClaimDetail,
  StatementPeriod,
  StatementPeriodType,
  StatementTransactionRow,
  StatementView,
  Taxable1099View,
  TERMINAL_STAGES,
  User,
} from '../models/commission-engine.model';
import { CommissionEngineMockService } from './commission-engine-mock.service';

/**
 * Unified commission engine.
 *
 * Pure-function selectors on top of the ledger. Same math serves every role.
 * Role-specific views are built by filtering what is *returned* from these methods —
 * never by running different calculations.
 *
 * All money amounts are in USD numeric (backend will use Decimal).
 *
 * Current month is derived from `new Date()` — MTD calcs filter ledger by timestamp.
 */
@Injectable({ providedIn: 'root' })
export class CommissionEngineService {
  constructor(private readonly data: CommissionEngineMockService) {}

  /* ------------------------------------------------------------------
   * AGENT / WRITING-AGENT VIEWS
   * ------------------------------------------------------------------ */

  getBalanceCard(writingAgentId: string): Observable<BalanceCardView> {
    return this.data.getLedger().pipe(
      map(ledger => this.computeBalance(ledger, writingAgentId)),
    );
  }

  /**
   * Agent-facing simple view: earned / paid / remaining only.
   * Used on the main Earnings tab. Full bucket breakdown is deliberately absent here —
   * it belongs in the Financial Detail modal.
   */
  getAgentSimpleEarnings(userId: string): Observable<AgentSimpleEarningsView> {
    return this.data.getLedger().pipe(
      map(ledger => this.computeAgentSimpleEarnings(ledger, userId)),
    );
  }

  /** 6-month earnings trend for the agent (writing-agent share). */
  getEarningsTrend(userId: string): Observable<EarningsTrendView> {
    return this.data.getLedger().pipe(
      map(ledger => this.computeEarningsTrend(ledger, userId)),
    );
  }

  /** Latest N ledger events for this user, newest first. */
  getRecentActivity(userId: string, limit: number = 6): Observable<RecentActivityItem[]> {
    return combineLatest([this.data.getLedger(), this.data.getClaims()]).pipe(
      map(([ledger, claims]) => this.computeRecentActivity(ledger, claims, userId, limit)),
    );
  }

  /** Claims in flight where this user is the writing agent, with projected agent share. */
  getActiveClaimContributions(userId: string): Observable<ActiveClaimContribution[]> {
    return this.data.getClaims().pipe(
      map(claims => this.computeActiveClaimContributions(claims, userId)),
    );
  }

  /** Per-claim earned/paid/remaining for the table row. */
  getClaimEarningsTable(userId: string): Observable<ClaimEarningsRow[]> {
    return combineLatest([this.data.getLedger(), this.data.getClaims()]).pipe(
      map(([ledger, claims]) => this.computeClaimEarningsTable(ledger, claims, userId)),
    );
  }

  /**
   * Placeholder for "Next Expected Payout" — in mock mode we project a payout at the next
   * end-of-month if remaining_balance > 0. Real implementation will query the payout pipeline.
   */
  getNextExpectedPayout(userId: string): Observable<NextExpectedPayoutView> {
    return this.data.getLedger().pipe(
      map(ledger => this.computeNextExpectedPayout(ledger, userId)),
    );
  }

  /**
   * 1099 YTD (taxable disbursements this calendar year).
   * Business rule: ADVANCES COUNT AS TAXABLE PAYOUTS. So 1099 YTD sums
   * both ADVANCE_ISSUED and PAYOUT_ISSUED entries in the writing_agent
   * bucket for the current calendar year. Not based on earned commission
   * or remaining balance.
   */
  getTaxable1099YTD(userId: string, year?: number): Observable<Taxable1099View> {
    return this.data.getLedger().pipe(
      map(ledger => this.computeTaxable1099YTD(ledger, userId, year)),
    );
  }

  /**
   * Build a full statement for a date range. Pure — derives everything from the ledger.
   */
  getStatement(userId: string, period: StatementPeriod): Observable<StatementView> {
    return combineLatest([
      this.data.getLedger(),
      this.data.getClaims(),
      this.data.getUsers(),
    ]).pipe(
      map(([ledger, claims, users]) => this.computeStatement(ledger, claims, users, userId, period)),
    );
  }

  /** Helper: build a canonical StatementPeriod from a simple type + anchor date. */
  buildPeriod(type: StatementPeriodType, anchorIso: string, customStart?: string, customEnd?: string): StatementPeriod {
    const anchor = new Date(anchorIso);
    let start: Date, end: Date, label: string;

    if (type === 'week') {
      // Week = Mon 00:00 through Sun 23:59:59 containing the anchor.
      const d = new Date(anchor);
      const day = d.getUTCDay(); // 0=Sun..6=Sat
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

  getEarningsSummary(userId: string): Observable<EarningsSummaryView> {
    return combineLatest([
      this.data.getLedger(),
      this.data.getClaims(),
      this.data.getMonthlyTargets(),
    ]).pipe(
      map(([ledger, claims, targets]) => this.computeEarningsSummary(ledger, claims, targets, userId)),
    );
  }

  getClaimsByStage(writingAgentId: string): Observable<StageCard[]> {
    return this.data.getClaims().pipe(
      map(claims => this.computeStageCards(claims.filter(c => c.writing_agent_id === writingAgentId))),
    );
  }

  getAdvanceSupport(writingAgentId: string): Observable<AdvanceSupportView> {
    return this.data.getLedger().pipe(
      map(ledger => this.computeAdvanceSupport(ledger, writingAgentId)),
    );
  }

  getFinancialDetail(writingAgentId: string): Observable<FinancialDetailView> {
    return combineLatest([this.data.getLedger(), this.data.getClaims()]).pipe(
      map(([ledger, claims]) => this.computeFinancialDetail(ledger, claims, writingAgentId)),
    );
  }

  /* ------------------------------------------------------------------
   * ADMIN / HOUSE VIEW
   * ------------------------------------------------------------------ */

  getAdminOverview(): Observable<AdminOverviewView> {
    return combineLatest([
      this.data.getLedger(),
      this.data.getClaims(),
      this.data.getUsers(),
    ]).pipe(
      map(([ledger, claims, users]) => this.computeAdminOverview(ledger, claims, users)),
    );
  }

  /* ------------------------------------------------------------------
   * PURE COMPUTATION
   * ------------------------------------------------------------------ */

  private computeAgentSimpleEarnings(ledger: LedgerTransaction[], userId: string): AgentSimpleEarningsView {
    const mine = ledger.filter(
      t => t.user_id === userId && t.bucket === CommissionBucket.WRITING_AGENT,
    );
    const earned = round(sum(
      mine.filter(t => t.type === LedgerTransactionType.COMMISSION_EARNED).map(t => t.amount),
    ));
    const paid = round(Math.abs(sum(
      mine.filter(t => t.type === LedgerTransactionType.PAYOUT_ISSUED).map(t => t.amount),
    )));
    const remaining = Math.max(0, round(earned - paid));
    return { user_id: userId, total_earned: earned, paid_to_date: paid, remaining_balance: remaining };
  }

  private computeBalance(ledger: LedgerTransaction[], writingAgentId: string): BalanceCardView {
    const mine = ledger.filter(t => t.user_id === writingAgentId && t.bucket === CommissionBucket.WRITING_AGENT);

    const advances = sum(mine.filter(t => t.type === LedgerTransactionType.ADVANCE_ISSUED).map(t => t.amount));
    const offsets = Math.abs(sum(mine.filter(t => t.type === LedgerTransactionType.REPAYMENT_OFFSET).map(t => t.amount)));
    const interest = sum(mine.filter(t => t.type === LedgerTransactionType.INTEREST_APPLIED).map(t => t.amount));
    const adjustments = sum(mine.filter(t => t.type === LedgerTransactionType.ADJUSTMENT).map(t => t.amount));

    const remaining = advances + interest + adjustments - offsets;

    return {
      writing_agent_id: writingAgentId,
      total_advance_support_received: advances,
      total_recovered_from_earnings: offsets,
      remaining_balance: Math.max(0, round(remaining)),
    };
  }

  private computeEarningsSummary(
    ledger: LedgerTransaction[],
    claims: Claim[],
    targets: MonthlyTarget[],
    userId: string,
  ): EarningsSummaryView {
    // Personal earnings — user's rows in any bucket type of COMMISSION_EARNED.
    const earned = ledger.filter(
      t => t.user_id === userId && t.type === LedgerTransactionType.COMMISSION_EARNED,
    );
    const commissionsEarned = round(sum(earned.map(t => t.amount)));

    // Net payout = commissions earned − repayment offsets carried by this user (as writing agent)
    const offsets = Math.abs(sum(
      ledger
        .filter(t => t.user_id === userId && t.type === LedgerTransactionType.REPAYMENT_OFFSET)
        .map(t => t.amount),
    ));
    const netPayout = round(commissionsEarned - offsets);

    // Active claims = claims where this user is writing_agent and stage is not terminal.
    const myWritingClaims = claims.filter(c => c.writing_agent_id === userId);
    const activeClaims = myWritingClaims.filter(c => !TERMINAL_STAGES.has(c.stage));

    // Future pipeline = writing-agent share of gross on active claims (motivational projection).
    const futurePipeline = round(sum(activeClaims.map(c =>
      c.gross_fee
      * (c.commission_structure.master_split.field_percent / 100)
      * (c.commission_structure.field_allocation.writing_agent_percent / 100),
    )));

    // Monthly target + month-to-date progress.
    const target = targets.find(t => t.user_id === userId)?.effective ?? 0;
    const mtdEarned = round(sum(
      earned.filter(t => isCurrentMonth(t.timestamp)).map(t => t.amount),
    ));
    const progress = target > 0 ? Math.min(100, (mtdEarned / target) * 100) : 0;

    return {
      user_id: userId,
      commissions_earned: commissionsEarned,
      net_payout: netPayout,
      active_claims_count: activeClaims.length,
      future_pipeline_value: futurePipeline,
      monthly_target: target,
      month_to_date_earned: mtdEarned,
      progress_percent: round(progress),
    };
  }

  private computeStageCards(claims: Claim[]): StageCard[] {
    return CLAIM_STAGE_ORDER.filter(s => !TERMINAL_STAGES.has(s)).map(stage => {
      const inStage = claims.filter(c => c.stage === stage);
      const projected = sum(inStage.map(c =>
        c.gross_fee
        * (c.commission_structure.master_split.field_percent / 100)
        * (c.commission_structure.field_allocation.writing_agent_percent / 100),
      ));
      return {
        stage,
        label: CLAIM_STAGE_LABELS[stage],
        claim_count: inStage.length,
        projected_field_value: round(projected),
      };
    });
  }

  private computeAdvanceSupport(ledger: LedgerTransaction[], writingAgentId: string): AdvanceSupportView {
    const mine = ledger.filter(t => t.user_id === writingAgentId && t.bucket === CommissionBucket.WRITING_AGENT);

    const activeAdvanceClaimIds = new Set(
      mine.filter(t => t.type === LedgerTransactionType.ADVANCE_ISSUED).map(t => t.claim_id),
    );
    const advancesAmt = sum(mine.filter(t => t.type === LedgerTransactionType.ADVANCE_ISSUED).map(t => t.amount));
    const offsetsAmt = Math.abs(sum(mine.filter(t => t.type === LedgerTransactionType.REPAYMENT_OFFSET).map(t => t.amount)));
    const interestAmt = sum(mine.filter(t => t.type === LedgerTransactionType.INTEREST_APPLIED).map(t => t.amount));
    const adjustmentsAmt = sum(mine.filter(t => t.type === LedgerTransactionType.ADJUSTMENT).map(t => t.amount));
    const outstanding = Math.max(0, round(advancesAmt + interestAmt + adjustmentsAmt - offsetsAmt));

    let label = 'Neutral';
    let tone: AdvanceSupportView['account_position_tone'] = 'neutral';
    if (outstanding === 0) { label = 'Fully recovered'; tone = 'positive'; }
    else if (outstanding < 1000) { label = 'On track'; tone = 'positive'; }
    else if (outstanding < 3000) { label = 'Normal range'; tone = 'neutral'; }
    else { label = 'Monitor'; tone = 'caution'; }

    return {
      writing_agent_id: writingAgentId,
      active_advance_count: activeAdvanceClaimIds.size,
      total_outstanding: outstanding,
      account_position_label: label,
      account_position_tone: tone,
    };
  }

  private computeFinancialDetail(
    ledger: LedgerTransaction[],
    claims: Claim[],
    writingAgentId: string,
  ): FinancialDetailView {
    const claimByid = new Map(claims.map(c => [c.id, c]));

    const mineWriting = ledger
      .filter(t => t.user_id === writingAgentId && t.bucket === CommissionBucket.WRITING_AGENT)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    let running = 0;
    const rows: FinancialDetailRow[] = mineWriting.map(t => {
      // Running balance reflects what the agent owes (positive) vs what's been recovered (offsets reduce).
      if (t.type === LedgerTransactionType.ADVANCE_ISSUED) running += t.amount;
      else if (t.type === LedgerTransactionType.INTEREST_APPLIED) running += t.amount;
      else if (t.type === LedgerTransactionType.REPAYMENT_OFFSET) running += t.amount; // already signed negative
      else if (t.type === LedgerTransactionType.ADJUSTMENT) running += t.amount;
      // COMMISSION_EARNED does not affect the debit balance directly; it is paid out.
      return {
        date: t.timestamp,
        claim_ref: claimByid.get(t.claim_id)?.ref_string ?? t.claim_id,
        type: t.type,
        bucket: t.bucket,
        amount: t.amount,
        memo: t.memo,
        running_balance: round(Math.max(0, running)),
      };
    });

    const advances = sum(mineWriting.filter(t => t.type === LedgerTransactionType.ADVANCE_ISSUED).map(t => t.amount));
    const offsets = Math.abs(sum(mineWriting.filter(t => t.type === LedgerTransactionType.REPAYMENT_OFFSET).map(t => t.amount)));
    const interest = sum(mineWriting.filter(t => t.type === LedgerTransactionType.INTEREST_APPLIED).map(t => t.amount));
    const adjustments = sum(mineWriting.filter(t => t.type === LedgerTransactionType.ADJUSTMENT).map(t => t.amount));
    const remaining = Math.max(0, round(advances + interest + adjustments - offsets));

    // Two-section breakdown per claim. House is isolated; field is normalized to 100%.
    const myClaims = claims.filter(c => c.writing_agent_id === writingAgentId);
    const bucketBreakdownByClaim = myClaims.map(c => this.bucketTwoSectionBreakdown(c));

    return {
      writing_agent_id: writingAgentId,
      advances_total: round(advances),
      offsets_total: round(offsets),
      interest_total: round(interest),
      adjustments_total: round(adjustments),
      remaining_balance: remaining,
      rows,
      bucket_breakdown_by_claim: bucketBreakdownByClaim,
    };
  }

  /**
   * Two-section commission breakdown. Only way the UI should present structure:
   *   A) House (master split)
   *   B) Field (normalized to 100% across writing_agent / rvp / cp)
   * House is deliberately NOT part of the field bucket list.
   */
  bucketTwoSectionBreakdown(claim: Claim): ClaimTwoSectionBreakdown {
    const { gross_fee, master_split, field_allocation } = claim.commission_structure;

    const houseAmt = round(gross_fee * master_split.house_percent / 100);
    const fieldAmt = round(gross_fee * master_split.field_percent / 100);

    const fieldPercentOfGross = (pOfField: number) => master_split.field_percent * pOfField / 100;

    const field_buckets = [
      {
        bucket: CommissionBucket.WRITING_AGENT,
        label: 'Writing Agent',
        percent_of_field: field_allocation.writing_agent_percent,
        percent_of_gross: fieldPercentOfGross(field_allocation.writing_agent_percent),
        amount: round(gross_fee * fieldPercentOfGross(field_allocation.writing_agent_percent) / 100),
        recipient_user_id: claim.writing_agent_id,
      },
      {
        bucket: CommissionBucket.RVP_OVERRIDE,
        label: 'RVP Override',
        percent_of_field: field_allocation.rvp_override_percent,
        percent_of_gross: fieldPercentOfGross(field_allocation.rvp_override_percent),
        amount: round(gross_fee * fieldPercentOfGross(field_allocation.rvp_override_percent) / 100),
        recipient_user_id: claim.rvp_override_user_id,
      },
      {
        bucket: CommissionBucket.CP_OVERRIDE,
        label: 'CP Override',
        percent_of_field: field_allocation.cp_override_percent,
        percent_of_gross: fieldPercentOfGross(field_allocation.cp_override_percent),
        amount: round(gross_fee * fieldPercentOfGross(field_allocation.cp_override_percent) / 100),
        recipient_user_id: claim.cp_override_user_id,
      },
    ].filter(b => b.percent_of_field > 0);

    return {
      claim_id: claim.id,
      claim_ref: claim.ref_string,
      gross_fee,
      house: { percent_of_gross: master_split.house_percent, amount: houseAmt },
      field_total: { percent_of_gross: master_split.field_percent, amount: fieldAmt },
      field_buckets,
    };
  }

  private computeEarningsTrend(ledger: LedgerTransaction[], userId: string): EarningsTrendView {
    const earned = ledger.filter(
      t => t.user_id === userId
        && t.bucket === CommissionBucket.WRITING_AGENT
        && t.type === LedgerTransactionType.COMMISSION_EARNED,
    );

    const now = new Date();
    const points: EarningsTrendPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      const amount = round(sum(
        earned
          .filter(t => {
            const td = new Date(t.timestamp);
            return td.getUTCFullYear() === d.getUTCFullYear() && td.getUTCMonth() === d.getUTCMonth();
          })
          .map(t => t.amount),
      ));
      points.push({ month_label: label, month_key: key, earned: amount, is_current: i === 0 });
    }

    const currentMonth = points[points.length - 1].earned;
    const priorMonth = points[points.length - 2].earned;
    const delta = priorMonth > 0 ? round(((currentMonth - priorMonth) / priorMonth) * 100) : 0;

    return { user_id: userId, points, current_month: currentMonth, prior_month: priorMonth, delta_percent: delta };
  }

  private computeRecentActivity(
    ledger: LedgerTransaction[],
    claims: Claim[],
    userId: string,
    limit: number,
  ): RecentActivityItem[] {
    const claimByid = new Map(claims.map(c => [c.id, c]));
    return ledger
      .filter(t => t.user_id === userId && t.bucket === CommissionBucket.WRITING_AGENT)
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit)
      .map(t => ({
        id: t.id,
        type: t.type,
        bucket: t.bucket,
        claim_ref: claimByid.get(t.claim_id)?.ref_string,
        amount: t.amount,
        timestamp: t.timestamp,
        memo: t.memo,
      }));
  }

  private computeActiveClaimContributions(claims: Claim[], userId: string): ActiveClaimContribution[] {
    return claims
      .filter(c => c.writing_agent_id === userId && !TERMINAL_STAGES.has(c.stage))
      .map(c => ({
        claim_id: c.id,
        claim_ref: c.ref_string,
        client_name: c.client_name,
        stage: c.stage,
        stage_label: CLAIM_STAGE_LABELS[c.stage],
        projected_agent_share: round(
          c.gross_fee
          * (c.commission_structure.master_split.field_percent / 100)
          * (c.commission_structure.field_allocation.writing_agent_percent / 100),
        ),
      }));
  }

  private computeClaimEarningsTable(
    ledger: LedgerTransaction[],
    claims: Claim[],
    userId: string,
  ): ClaimEarningsRow[] {
    const mine = claims.filter(c => c.writing_agent_id === userId);
    return mine.map(c => {
      const rows = ledger.filter(
        t => t.claim_id === c.id && t.user_id === userId && t.bucket === CommissionBucket.WRITING_AGENT,
      );
      const earned = round(sum(
        rows.filter(r => r.type === LedgerTransactionType.COMMISSION_EARNED).map(r => r.amount),
      ));
      const paid = round(Math.abs(sum(
        rows.filter(r => r.type === LedgerTransactionType.PAYOUT_ISSUED).map(r => r.amount),
      )));
      const remaining = Math.max(0, round(earned - paid));
      return {
        claim_id: c.id,
        claim_ref: c.ref_string,
        client_name: c.client_name,
        stage: c.stage,
        stage_label: CLAIM_STAGE_LABELS[c.stage],
        earned,
        paid,
        remaining,
      };
    });
  }

  private computeNextExpectedPayout(ledger: LedgerTransaction[], userId: string): NextExpectedPayoutView {
    const mine = ledger.filter(t => t.user_id === userId && t.bucket === CommissionBucket.WRITING_AGENT);
    const earned = round(sum(
      mine.filter(t => t.type === LedgerTransactionType.COMMISSION_EARNED).map(t => t.amount),
    ));
    const paid = round(Math.abs(sum(
      mine.filter(t => t.type === LedgerTransactionType.PAYOUT_ISSUED).map(t => t.amount),
    )));
    const remaining = Math.max(0, round(earned - paid));

    if (remaining <= 0) {
      return { estimated_date: '', estimated_amount: 0, status_label: 'No payout pending', has_pending: false };
    }
    const now = new Date();
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return {
      estimated_date: endOfMonth.toISOString(),
      estimated_amount: remaining,
      status_label: 'Processing',
      has_pending: true,
    };
  }

  /**
   * 1099 YTD — canonical definition:
   *   sum of all PAYOUT_ISSUED transactions for this writing agent in the given
   *   calendar year (defaults to current UTC year).
   *
   * Advances are tracked separately for transparency (advance_total) but are
   * NOT rolled into ytd_total. The rule is intentionally just PAYOUT_ISSUED
   * because that is the single source of truth for "funds disbursed to the
   * agent under payout" — what the 1099 reports.
   */
  private computeTaxable1099YTD(
    ledger: LedgerTransaction[],
    userId: string,
    year?: number,
  ): Taxable1099View {
    const y = year ?? new Date().getUTCFullYear();
    const mine = ledger.filter(
      t => t.user_id === userId
        && t.bucket === CommissionBucket.WRITING_AGENT
        && new Date(t.timestamp).getUTCFullYear() === y,
    );

    const payoutRows = mine.filter(t => t.type === LedgerTransactionType.PAYOUT_ISSUED);
    const advanceRows = mine.filter(t => t.type === LedgerTransactionType.ADVANCE_ISSUED);

    const payoutTotal = round(Math.abs(sum(payoutRows.map(t => t.amount))));
    const advanceTotal = round(Math.abs(sum(advanceRows.map(t => t.amount))));

    return {
      user_id: userId,
      year: y,
      ytd_total: payoutTotal,            // PAYOUT_ISSUED only
      payout_total: payoutTotal,
      advance_total: advanceTotal,       // informational; not rolled into ytd_total
      transaction_count: payoutRows.length,
    };
  }

  private computeStatement(
    ledger: LedgerTransaction[],
    claims: Claim[],
    users: User[],
    userId: string,
    period: StatementPeriod,
  ): StatementView {
    const user = users.find(u => u.id === userId);
    const claimByid = new Map(claims.map(c => [c.id, c]));

    const startMs = new Date(period.start).getTime();
    const endMs = new Date(period.end).getTime();

    const mine = ledger.filter(
      t => t.user_id === userId && t.bucket === CommissionBucket.WRITING_AGENT,
    );
    const before = mine.filter(t => new Date(t.timestamp).getTime() < startMs);
    const throughEnd = mine.filter(t => new Date(t.timestamp).getTime() <= endMs);
    const inPeriod = mine
      .filter(t => {
        const ts = new Date(t.timestamp).getTime();
        return ts >= startMs && ts <= endMs;
      })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Opening balance = cumulative (earned − paid + adjustments) for all activity BEFORE the period.
    const openingEarned = sum(before.filter(t => t.type === LedgerTransactionType.COMMISSION_EARNED).map(t => t.amount));
    const openingPaid = Math.abs(sum(before.filter(t => t.type === LedgerTransactionType.PAYOUT_ISSUED).map(t => t.amount)));
    const openingAdjust = sum(before.filter(t => t.type === LedgerTransactionType.ADJUSTMENT).map(t => t.amount));
    const openingBalance = round(openingEarned - openingPaid + openingAdjust);

    // Statement summary totals = CUMULATIVE through period end (same source as the dashboard
    // earnings card). This is what "Total Earned / Total Paid / Closing Balance" mean on a
    // commission statement — the same way a bank statement reports lifetime balance as-of a
    // date, not just the delta during the window. In-period activity is surfaced separately
    // via Claim Detail + Transaction History below.
    const totalEarned = round(sum(
      throughEnd.filter(t => t.type === LedgerTransactionType.COMMISSION_EARNED).map(t => t.amount),
    ));
    const totalPaid = round(Math.abs(sum(
      throughEnd.filter(t => t.type === LedgerTransactionType.PAYOUT_ISSUED).map(t => t.amount),
    )));
    const totalAdvances = round(Math.abs(sum(
      throughEnd.filter(t => t.type === LedgerTransactionType.ADVANCE_ISSUED).map(t => t.amount),
    )));
    const totalAdjust = round(sum(
      throughEnd.filter(t => t.type === LedgerTransactionType.ADJUSTMENT).map(t => t.amount),
    ));

    // Closing balance = Earned − Paid (same formula as dashboard remaining, clamped ≥ 0 to
    // match `AgentSimpleEarningsView.remaining_balance`). Advance-type ADJUSTMENT entries live
    // in the advance subsystem and are tracked in advances_issued, not closing.
    const closingBalance = Math.max(0, round(totalEarned - totalPaid));
    void totalAdjust;

    // Cumulative 1099 YTD as of period end = sum of PAYOUT_ISSUED in the period's calendar year.
    const periodYear = new Date(period.end).getUTCFullYear();
    const yearRows = mine.filter(t => {
      const d = new Date(t.timestamp);
      return d.getUTCFullYear() === periodYear && d.getTime() <= endMs;
    });
    const taxable1099Ytd = round(Math.abs(sum(
      yearRows.filter(t => t.type === LedgerTransactionType.PAYOUT_ISSUED).map(t => t.amount),
    )));

    // Per-claim summary in period (claims for which this user is writing_agent).
    const periodClaimIds = Array.from(new Set(inPeriod.map(t => t.claim_id)));
    const claimDetails: StatementClaimDetail[] = periodClaimIds
      .map(id => {
        const c = claimByid.get(id);
        if (!c) return null;
        const rows = inPeriod.filter(t => t.claim_id === id);
        return {
          claim_id: id,
          claim_ref: c.ref_string,
          client_name: c.client_name,
          stage_label: CLAIM_STAGE_LABELS[c.stage],
          earned_in_period: round(sum(rows.filter(r => r.type === LedgerTransactionType.COMMISSION_EARNED).map(r => r.amount))),
          paid_in_period: round(Math.abs(sum(rows.filter(r => r.type === LedgerTransactionType.PAYOUT_ISSUED).map(r => r.amount)))),
          advances_in_period: round(Math.abs(sum(rows.filter(r => r.type === LedgerTransactionType.ADVANCE_ISSUED).map(r => r.amount)))),
        };
      })
      .filter((x): x is StatementClaimDetail => x !== null);

    // Transaction rows for the ledger section of the statement.
    const transactions: StatementTransactionRow[] = inPeriod.map(t => ({
      id: t.id,
      date: t.timestamp,
      claim_ref: claimByid.get(t.claim_id)?.ref_string,
      type: t.type,
      type_label: this.txTypeLabel(t.type),
      amount: t.amount,
      memo: t.memo,
    }));

    return {
      user_id: userId,
      user_name: user ? user.name : userId,
      user_role: user ? user.org_role : '',
      period,
      generated_at: new Date().toISOString(),
      opening_balance: openingBalance,
      total_earned: totalEarned,          // cumulative through period end (matches dashboard)
      total_paid: totalPaid,              // cumulative through period end (matches dashboard)
      advances_issued: totalAdvances,     // cumulative through period end
      closing_balance: closingBalance,    // Earned − Paid + Adjustments (all cumulative)
      taxable_1099_ytd: taxable1099Ytd,
      claim_details: claimDetails,
      transactions,
    };
  }

  private txTypeLabel(t: LedgerTransactionType): string {
    switch (t) {
      case LedgerTransactionType.COMMISSION_EARNED: return 'Commission Earned';
      case LedgerTransactionType.PAYOUT_ISSUED: return 'Payout Issued';
      case LedgerTransactionType.ADVANCE_ISSUED: return 'Advance Issued';
      case LedgerTransactionType.INTEREST_APPLIED: return 'Interest Applied';
      case LedgerTransactionType.REPAYMENT_OFFSET: return 'Repayment Offset';
      case LedgerTransactionType.ADJUSTMENT: return 'Adjustment';
    }
  }

  private computeAdminOverview(
    ledger: LedgerTransaction[],
    claims: Claim[],
    users: User[],
  ): AdminOverviewView {
    const mtdEarned = ledger.filter(t => t.type === LedgerTransactionType.COMMISSION_EARNED && isCurrentMonth(t.timestamp));

    const totalGross = sum(
      claims
        .filter(c => c.stage === ClaimStage.PAID && isCurrentMonth(ledgerSettledAt(ledger, c.id) ?? '1970-01-01T00:00:00Z'))
        .map(c => c.gross_fee),
    );

    const byBucket = (b: CommissionBucket) => sum(mtdEarned.filter(t => t.bucket === b).map(t => t.amount));

    const rows: AdminAggregateRow[] = users
      .filter(u => u.org_role !== OrgRole.ADMIN)
      .map(u => {
        const myEarned = round(sum(
          ledger
            .filter(t => t.user_id === u.id && t.type === LedgerTransactionType.COMMISSION_EARNED && isCurrentMonth(t.timestamp))
            .map(t => t.amount),
        ));
        const balance = this.computeBalance(ledger, u.id);
        const myClaimsActive = claims.filter(c => c.writing_agent_id === u.id && !TERMINAL_STAGES.has(c.stage)).length;
        const y1099 = this.computeTaxable1099YTD(ledger, u.id);
        return {
          user_id: u.id,
          user_name: u.name,
          org_role: u.org_role,
          commissions_earned_mtd: myEarned,
          advances_outstanding: balance.remaining_balance,
          remaining_balance: balance.remaining_balance,
          active_claims: myClaimsActive,
          taxable_1099_ytd: y1099.ytd_total,
        };
      });

    return {
      total_gross_fee_mtd: round(totalGross),
      house_share_mtd: round(byBucket(CommissionBucket.HOUSE)),
      field_share_mtd: round(
        byBucket(CommissionBucket.WRITING_AGENT)
        + byBucket(CommissionBucket.RVP_OVERRIDE)
        + byBucket(CommissionBucket.CP_OVERRIDE)
        + byBucket(CommissionBucket.RESERVE),
      ),
      reserve_mtd: round(byBucket(CommissionBucket.RESERVE)),
      outstanding_advances_total: round(sum(rows.map(r => r.advances_outstanding))),
      rows,
    };
  }
}

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */

function sum(arr: number[]): number { return arr.reduce((a, b) => a + b, 0); }
function round(n: number): number { return Math.round(n * 100) / 100; }

function isCurrentMonth(isoTs: string): boolean {
  const d = new Date(isoTs);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

function ledgerSettledAt(ledger: LedgerTransaction[], claimId: string): string | undefined {
  return ledger.find(t => t.claim_id === claimId && t.type === LedgerTransactionType.COMMISSION_EARNED)?.timestamp;
}
