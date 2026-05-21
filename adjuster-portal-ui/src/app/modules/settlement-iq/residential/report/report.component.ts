import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  FindingPublic,
  FindingSeverity,
  Peril,
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
 * the forensic teardown.
 *
 * Two render paths:
 *
 *   1. Standard forensic verdicts (strong/possible/weak/open/released/
 *      expired) — recovery range + findings list + boilerplate WHAT THIS
 *      MEANS + generic consultation CTA.
 *
 *   2. Limited-analysis verdict — carrier settlement totals + server-
 *      generated narrative paragraphs + "From your summary, we can
 *      identify:" bullets + optional carrier-specific note + WHY A
 *      PUBLIC ADJUSTER section + new CTAs.
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

  // Tenant defaults. Build-to-sell: founder intends to white-label this
  // surface for partner firms (e.g., Pax Equitas), so brand identity
  // lives in named variables that can be swapped via config later.
  readonly tenantFirmName = 'ACI Adjustment Group';
  readonly tenantFirmDescriptor = 'a national licensed public adjusting firm';

  // Rep contact channels — hardcoded ACI defaults for the only currently
  // configured rep (Tim Clauss). Phase 1.5 plan in
  // ~/upa-portal-backend/app/app/services/settlement_iq/roadmap.md:
  // replace with a `reps` table joined by rep_slug. Per-tenant override
  // pattern already in place for tenantFirmName/Descriptor; same pattern
  // applies when the reps table lands. Null-handling rule applies:
  // suppress any CTA whose backing field is null.
  readonly tenantConsultationPhone: string | null = '+18008094303';
  readonly tenantConsultationEmailPrimary: string | null = 'tclauss@upaclaim.org';
  readonly tenantConsultationEmailCC: string | null = 'pguzzi@upaclaim.org';

  readonly consultationChannelHelperText =
    'Text reaches our team fastest. Calls connect you directly to an ' +
    'adjuster. Emails reach intake for non-urgent inquiries.';

  readonly uploadFullEstimateTooltip =
    'If you can obtain the carrier\'s full itemized estimate from your ' +
    'insurance company, upload it here for a complete forensic review.';

  private static readonly SEVERITY_ORDER: Record<FindingSeverity, number> = {
    major: 0,
    moderate: 1,
    minor: 2,
  };

  // Perils we render in the Document Summary. 'other' and null are
  // suppressed — the carrier's loss-type classification is often
  // disputed and showing "Other" reads as either broken or as
  // endorsement of a label that may be wrong.
  private static readonly PERILS_WITH_DISPLAY: ReadonlySet<Peril> = new Set<Peril>([
    'hail',
    'wind',
    'water',
    'fire',
    'theft',
  ]);

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

  get isLimitedAnalysis(): boolean {
    return this.report?.verdict === 'limited_analysis';
  }

  get showPerilRow(): boolean {
    const p = this.report?.peril;
    return !!p && ReportComponent.PERILS_WITH_DISPLAY.has(p);
  }

  /** sms: deep link to the rep's phone. INBOUND only — opens the
   *  homeowner's own Messages app composing to the rep's number. Does
   *  NOT trigger any outbound Twilio path from our server; the TWILIO_
   *  HALTED kill switch is irrelevant here. Body pre-fills the scan ID
   *  so the rep has context immediately. */
  get consultationSmsUrl(): string | null {
    if (!this.tenantConsultationPhone) return null;
    const parts = ["Hi, I'd like a forensic settlement consultation."];
    if (this.scanId) parts.push(`Scan ID: ${this.scanId}`);
    const body = parts.join(' ');
    return `sms:${this.tenantConsultationPhone}?body=${encodeURIComponent(body)}`;
  }

  /** tel: deep link — opens the homeowner's dialer pre-populated with
   *  the rep's number. They press call to connect. */
  get consultationTelUrl(): string | null {
    if (!this.tenantConsultationPhone) return null;
    return `tel:${this.tenantConsultationPhone}`;
  }

  /** mailto: URL for the email channel. Pre-fills To: (primary rep),
   *  Cc: (ACI intake), subject (with scan ID), and body (with carrier /
   *  state / loss date / scan ID context). Homeowner reviews and clicks
   *  Send in their own mail client; nothing is sent from our server. */
  get consultationMailtoUrl(): string | null {
    if (!this.tenantConsultationEmailPrimary) return null;
    const subjectBase = 'Forensic Settlement Consultation';
    const subject = this.scanId
      ? `${subjectBase} — Scan ${this.scanId}`
      : subjectBase;
    const lines: string[] = [
      'Hello,',
      '',
      'I would like to request a free consultation about my insurance settlement.',
      '',
    ];
    if (this.report?.carrier_name) lines.push(`Carrier: ${this.report.carrier_name}`);
    if (this.report?.state) lines.push(`State: ${this.report.state}`);
    if (this.report?.loss_date) lines.push(`Loss date: ${this.report.loss_date}`);
    if (this.scanId) lines.push(`Settlement IQ Scan ID: ${this.scanId}`);
    lines.push('');
    lines.push('Please reach out with next steps.');
    lines.push('');
    lines.push('Thanks');
    const body = lines.join('\r\n');

    const params: string[] = [];
    if (this.tenantConsultationEmailCC) {
      params.push(`cc=${encodeURIComponent(this.tenantConsultationEmailCC)}`);
    }
    params.push(`subject=${encodeURIComponent(subject)}`);
    params.push(`body=${encodeURIComponent(body)}`);
    return `mailto:${this.tenantConsultationEmailPrimary}?${params.join('&')}`;
  }

  /** True when at least one consultation channel is configured. Used
   *  to suppress the helper text when all three channels happen to be
   *  null on some hypothetical future tenant. */
  get hasAnyConsultationChannel(): boolean {
    return !!(this.consultationSmsUrl || this.consultationTelUrl || this.consultationMailtoUrl);
  }

  /**
   * Format the "Carrier Paid" line for the limited_analysis path.
   * Returns null when no carrier-side dollar fields are present; the
   * template then falls back to the legacy settlement_amount_cents
   * row, and ultimately to "Not specified in the document we received".
   */
  get carrierSettlementLine(): string | null {
    if (!this.report) return null;
    const parts: string[] = [];
    const fmt = (cents: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
        .format(cents / 100);
    if (this.report.carrier_rcv_cents != null) {
      parts.push(`${fmt(this.report.carrier_rcv_cents)} RCV`);
    }
    if (this.report.carrier_acv_cents != null) {
      parts.push(`${fmt(this.report.carrier_acv_cents)} ACV`);
    }
    if (this.report.carrier_net_remaining_cents != null) {
      parts.push(`${fmt(this.report.carrier_net_remaining_cents)} net remaining`);
    }
    return parts.length ? parts.join(' · ') : null;
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
