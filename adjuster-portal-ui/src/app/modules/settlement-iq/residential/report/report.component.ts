import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  FindingPublic,
  FindingSeverity,
  ReportPayload,
} from '../../core/settlement-iq.models';
import { SettlementIqService } from '../../core/settlement-iq.service';
import { FindingCardComponent } from '../../shared/finding-card/finding-card.component';
import { RecoveryRangeDisplayComponent } from '../../shared/recovery-range-display/recovery-range-display.component';
import { VerdictBadgeComponent } from '../../shared/verdict-badge/verdict-badge.component';

/**
 * Settlement IQ — Report (screen 3).
 *
 * Fetches /v1/settlement-iq/scan/{scanId}/report on init and renders
 * the forensic teardown. Findings are sorted major → moderate → minor
 * within the component; the backend's `sort_order` is preserved within
 * a severity bucket.
 */
@Component({
  selector: 'si-report',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    VerdictBadgeComponent,
    RecoveryRangeDisplayComponent,
    FindingCardComponent,
  ],
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss'],
})
export class ReportComponent implements OnInit {
  scanId: string | null = null;
  report: ReportPayload | null = null;
  loading = true;
  errorMessage: string | null = null;

  private static readonly SEVERITY_ORDER: Record<FindingSeverity, number> = {
    major: 0,
    moderate: 1,
    minor: 2,
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly service: SettlementIqService,
  ) {}

  ngOnInit(): void {
    this.scanId = this.route.snapshot.paramMap.get('scanId');
    if (!this.scanId) {
      this.loading = false;
      this.errorMessage = 'No scan ID was provided in the URL.';
      return;
    }
    this.service.fetchReport(this.scanId).subscribe({
      next: (report) => {
        this.report = report;
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        if (err.status === 404) {
          this.errorMessage = 'No report was found for this scan ID.';
        } else if (err.status === 409) {
          this.errorMessage = 'This scan has not finished processing yet. Refresh the page in a moment.';
        } else if (err.status === 410) {
          this.errorMessage = 'This scan\'s data has been removed in accordance with the 30-day retention policy.';
        } else {
          this.errorMessage = 'Could not load the report. The issue has been logged on our side.';
        }
      },
    });
  }

  get sortedFindings(): FindingPublic[] {
    if (!this.report) return [];
    return [...this.report.findings].sort((a, b) => {
      const sevA = ReportComponent.SEVERITY_ORDER[a.severity];
      const sevB = ReportComponent.SEVERITY_ORDER[b.severity];
      if (sevA !== sevB) return sevA - sevB;
      return a.sort_order - b.sort_order;
    });
  }

  get formattedLossDate(): string | null {
    return this.formatDate(this.report?.loss_date);
  }
  get formattedSettlementDate(): string | null {
    return this.formatDate(this.report?.settlement_date);
  }
  get formattedSettlementAmount(): string | null {
    const cents = this.report?.settlement_amount_cents;
    if (cents == null) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }
  get locationDisplay(): string | null {
    if (!this.report) return null;
    const parts: string[] = [];
    if (this.report.county) parts.push(this.report.county);
    if (this.report.state) parts.push(this.report.state);
    return parts.length ? parts.join(', ') : null;
  }

  get printFriendlyUrl(): string | null {
    if (!this.scanId) return null;
    const url = this.service.reportHtmlUrl(this.scanId);
    // Demo mode returns an empty string — hide the link rather than
    // surface a broken anchor.
    return url || null;
  }

  private formatDate(isoDate: string | null | undefined): string | null {
    if (!isoDate) return null;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  }
}
