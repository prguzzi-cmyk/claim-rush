import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import {
  ActiveClaimContribution,
  AgentSimpleEarningsView,
  ClaimEarningsRow,
  ClaimStage,
  EarningsTrendView,
  LedgerTransactionType,
  NextExpectedPayoutView,
  RecentActivityItem,
  Taxable1099View,
} from 'src/app/models/commission-engine.model';
import { CommissionEngineService } from 'src/app/services/commission-engine.service';
import { FinancialDetailDialogComponent } from './financial-detail-dialog/financial-detail-dialog.component';
import { CommissionStatementDialogComponent } from './commission-statement-dialog/commission-statement-dialog.component';

@Component({
  selector: 'app-earnings-tab',
  templateUrl: './earnings-tab.component.html',
  styleUrls: ['./earnings-tab.component.scss'],
  standalone: false,
})
export class EarningsTabComponent implements OnInit, OnChanges {
  @Input() userId!: string;
  @Input() userDisplayName?: string;

  earnings$!: Observable<AgentSimpleEarningsView>;
  trend$!: Observable<EarningsTrendView>;
  activity$!: Observable<RecentActivityItem[]>;
  activeClaims$!: Observable<ActiveClaimContribution[]>;
  claimTable$!: Observable<ClaimEarningsRow[]>;
  nextPayout$!: Observable<NextExpectedPayoutView>;
  tax1099$!: Observable<Taxable1099View>;

  readonly TX = LedgerTransactionType;

  constructor(
    private readonly engine: CommissionEngineService,
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void { this.refresh(); }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] && !changes['userId'].firstChange) this.refresh();
  }

  private refresh(): void {
    if (!this.userId) return;
    this.earnings$ = this.engine.getAgentSimpleEarnings(this.userId);
    this.trend$ = this.engine.getEarningsTrend(this.userId);
    this.activity$ = this.engine.getRecentActivity(this.userId, 6);
    this.activeClaims$ = this.engine.getActiveClaimContributions(this.userId);
    this.claimTable$ = this.engine.getClaimEarningsTable(this.userId);
    this.nextPayout$ = this.engine.getNextExpectedPayout(this.userId);
    this.tax1099$ = this.engine.getTaxable1099YTD(this.userId);
  }

  openFinancialDetail(): void {
    this.dialog.open(FinancialDetailDialogComponent, {
      width: '960px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'dark-dialog-panel',
      data: { userId: this.userId, userDisplayName: this.userDisplayName },
      autoFocus: false,
    });
  }

  openStatement(): void {
    this.dialog.open(CommissionStatementDialogComponent, {
      width: '1080px',
      maxWidth: '98vw',
      maxHeight: '94vh',
      panelClass: 'statement-dialog-panel',
      data: { userId: this.userId, userDisplayName: this.userDisplayName },
      autoFocus: false,
    });
  }

  /** Build the SVG polyline for the 6-month trend. viewBox is 240 x 60. */
  trendPolyline(points: { earned: number }[]): string {
    if (!points || points.length === 0) return '';
    const w = 240, h = 60, padX = 4, padY = 8;
    const max = Math.max(...points.map(p => p.earned), 1);
    const stepX = (w - padX * 2) / (points.length - 1);
    return points
      .map((p, i) => {
        const x = padX + i * stepX;
        const y = h - padY - (p.earned / max) * (h - padY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  trendArea(points: { earned: number }[]): string {
    if (!points || points.length === 0) return '';
    const w = 240, h = 60, padX = 4, padY = 8;
    const max = Math.max(...points.map(p => p.earned), 1);
    const stepX = (w - padX * 2) / (points.length - 1);
    const coords = points.map((p, i) => {
      const x = padX + i * stepX;
      const y = h - padY - (p.earned / max) * (h - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `${padX},${h - padY} ${coords.join(' ')} ${w - padX},${h - padY}`;
  }

  activityIcon(type: LedgerTransactionType): string {
    switch (type) {
      case LedgerTransactionType.COMMISSION_EARNED: return 'trending_up';
      case LedgerTransactionType.PAYOUT_ISSUED: return 'payments';
      case LedgerTransactionType.ADVANCE_ISSUED: return 'account_balance_wallet';
      case LedgerTransactionType.INTEREST_APPLIED: return 'percent';
      case LedgerTransactionType.REPAYMENT_OFFSET: return 'swap_horiz';
      case LedgerTransactionType.ADJUSTMENT: return 'edit';
    }
  }

  activityTone(type: LedgerTransactionType): string {
    switch (type) {
      case LedgerTransactionType.COMMISSION_EARNED: return 'tone-earned';
      case LedgerTransactionType.PAYOUT_ISSUED: return 'tone-paid';
      case LedgerTransactionType.ADVANCE_ISSUED: return 'tone-advance';
      case LedgerTransactionType.INTEREST_APPLIED: return 'tone-interest';
      case LedgerTransactionType.REPAYMENT_OFFSET: return 'tone-offset';
      case LedgerTransactionType.ADJUSTMENT: return 'tone-adjust';
    }
  }

  activityLabel(type: LedgerTransactionType): string {
    switch (type) {
      case LedgerTransactionType.COMMISSION_EARNED: return 'Earned';
      case LedgerTransactionType.PAYOUT_ISSUED: return 'Payout';
      case LedgerTransactionType.ADVANCE_ISSUED: return 'Advance';
      case LedgerTransactionType.INTEREST_APPLIED: return 'Interest';
      case LedgerTransactionType.REPAYMENT_OFFSET: return 'Offset';
      case LedgerTransactionType.ADJUSTMENT: return 'Adjustment';
    }
  }

  stageTone(stage: ClaimStage): string {
    switch (stage) {
      case ClaimStage.INTAKE_SIGNED:
      case ClaimStage.INSPECTION_SCHEDULED:
      case ClaimStage.INSPECTION_COMPLETED:
        return 'stage-early';
      case ClaimStage.ESTIMATE_IN_PROGRESS:
      case ClaimStage.ESTIMATE_SUBMITTED:
        return 'stage-estimate';
      case ClaimStage.CARRIER_REVIEW:
      case ClaimStage.NEGOTIATION:
      case ClaimStage.SUPPLEMENT_SUBMITTED:
        return 'stage-carrier';
      case ClaimStage.APPRAISAL:
      case ClaimStage.LITIGATION:
        return 'stage-escalated';
      case ClaimStage.SETTLEMENT_REACHED:
      case ClaimStage.PAID:
        return 'stage-settled';
      default:
        return 'stage-early';
    }
  }
}
