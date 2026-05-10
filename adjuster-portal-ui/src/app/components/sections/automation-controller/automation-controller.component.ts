import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import {
  AutomationStatus,
  DecisionLogRow,
  DryRunResult,
  LegalWindow,
  OutreachAutomationService,
  OutreachHoursConfig,
} from 'src/app/services/outreach-automation.service';
import { UpaOutreachService } from 'src/app/services/upa-outreach.service';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

@Component({
  selector: 'app-automation-controller',
  templateUrl: './automation-controller.component.html',
  styleUrls: ['./automation-controller.component.scss'],
  standalone: false,
})
export class AutomationControllerComponent implements OnInit {
  weekdayLabels = WEEKDAY_LABELS;

  status: AutomationStatus | null = null;
  legalWindow: LegalWindow | null = null;
  hoursConfigs: OutreachHoursConfig[] = [];
  decisionLog: DecisionLogRow[] = [];
  lastDryRun: DryRunResult | null = null;

  // Form state for creating a new hours config
  scopeKind: 'global' | 'company' | 'territory' | 'user' = 'territory';
  scopeId = 'NY';
  startTime = '09:00';
  endTime = '20:00';
  selectedWeekdays = new Set<number>([0, 1, 2, 3, 4]);
  timezone = 'America/New_York';
  dailyCapSms = 3;
  dailyCapVoice = 2;
  channelSequence = 'skip_trace,sms,voice';
  isActive = true;

  // Validation feedback
  legalRejection: string | null = null;
  // The UI saves are blocked while this is non-null.

  constructor(
    private svc: OutreachAutomationService,
    private upaSvc: UpaOutreachService,
    private snack: MatSnackBar,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit(): void {
    this.refreshStatus();
    this.refreshHoursConfigs();
    this.refreshLegalWindow();
    this.refreshDecisionLog();
  }

  // ── Refreshers ──────────────────────────────────────────────
  refreshStatus(): void {
    this.svc.status().subscribe({
      next: (s) => (this.status = s),
      error: () => this.snack.open('Failed to load automation status', 'OK', { duration: 4000 }),
    });
  }

  refreshHoursConfigs(): void {
    this.svc.listHoursConfigs().subscribe({
      next: (xs) => (this.hoursConfigs = xs),
      error: () => this.snack.open('Failed to load hours configs', 'OK', { duration: 4000 }),
    });
  }

  refreshLegalWindow(): void {
    const state = this.scopeKind === 'territory' ? this.scopeId : null;
    this.svc.legalWindow(state).subscribe({
      next: (w) => {
        this.legalWindow = w;
        this.revalidate();
      },
      error: () => this.snack.open('Failed to load legal window', 'OK', { duration: 4000 }),
    });
  }

  refreshDecisionLog(): void {
    this.svc.decisionLog({ limit: 50 }).subscribe({
      next: (xs) => (this.decisionLog = xs),
      error: () => this.snack.open('Failed to load decision log', 'OK', { duration: 4000 }),
    });
  }

  // ── Form helpers ────────────────────────────────────────────
  toggleWeekday(d: number): void {
    if (this.selectedWeekdays.has(d)) this.selectedWeekdays.delete(d);
    else this.selectedWeekdays.add(d);
    this.revalidate();
  }

  weekdayMaskFromSet(): number {
    let mask = 0;
    this.selectedWeekdays.forEach((d) => (mask |= 1 << d));
    return mask;
  }

  revalidate(): void {
    if (!this.legalWindow) return;
    const days = Array.from(this.selectedWeekdays).sort();
    this.legalRejection = this.svc.validateAgainstLegalFloor(
      this.legalWindow,
      this.startTime,
      this.endTime,
      days,
    );
  }

  // ── Save / activate / disable ───────────────────────────────
  saveConfig(): void {
    this.revalidate();
    if (this.legalRejection) {
      this.snack.open(`Cannot save: ${this.legalRejection}`, 'OK', { duration: 6000 });
      return;
    }
    const payload: OutreachHoursConfig = {
      scope_kind: this.scopeKind,
      scope_id: this.scopeKind === 'global' ? null : this.scopeId,
      weekday_mask: this.weekdayMaskFromSet(),
      start_time: `${this.startTime}:00`,
      end_time: `${this.endTime}:00`,
      timezone: this.timezone,
      daily_cap_sms: this.dailyCapSms,
      daily_cap_voice: this.dailyCapVoice,
      channel_sequence: this.channelSequence,
      is_active: this.isActive,
    };
    this.spinner.show();
    this.svc.createHoursConfig(payload).subscribe({
      next: () => {
        this.spinner.hide();
        this.snack.open('Hours config saved', 'OK', { duration: 3000 });
        this.refreshHoursConfigs();
      },
      error: (err) => {
        this.spinner.hide();
        const reason = err?.error?.detail ?? 'Save failed';
        this.snack.open(`Backend rejected: ${reason}`, 'OK', { duration: 8000 });
      },
    });
  }

  disableConfig(id: string | undefined): void {
    if (!id) return;
    if (!confirm('Soft-disable this hours config? Future scans will skip it.')) return;
    this.svc.disableHoursConfig(id).subscribe({
      next: () => {
        this.snack.open('Hours config disabled', 'OK', { duration: 3000 });
        this.refreshHoursConfigs();
      },
      error: () => this.snack.open('Disable failed', 'OK', { duration: 4000 }),
    });
  }

  // ── Dry-run scan ────────────────────────────────────────────
  runDryRun(): void {
    this.spinner.show();
    this.svc.dryRun({ state: 'READY_TO_TEXT', channel: 'sms', limit: 50 }).subscribe({
      next: (r) => {
        this.spinner.hide();
        this.lastDryRun = r;
        this.refreshDecisionLog();
        this.snack.open(
          `Dry-run complete: ${r.leads_evaluated} leads evaluated`,
          'OK',
          { duration: 5000 },
        );
      },
      error: () => {
        this.spinner.hide();
        this.snack.open('Dry-run failed', 'OK', { duration: 4000 });
      },
    });
  }

  // ── Emergency stop — toggles existing master_pause flag ────
  emergencyStop(enable: boolean): void {
    if (enable && !confirm('Activate master pause? All outreach will be blocked.')) return;
    this.upaSvc.getComplianceConfig().subscribe({
      next: (cfg) => {
        const updated = { ...cfg, master_pause: enable };
        this.upaSvc.updateComplianceConfig(updated as any).subscribe({
          next: () => {
            this.snack.open(
              enable ? 'Master pause ACTIVE — all outreach paused' : 'Master pause cleared',
              'OK',
              { duration: 5000 },
            );
            this.refreshStatus();
          },
          error: () => this.snack.open('Pause toggle failed', 'OK', { duration: 4000 }),
        });
      },
      error: () => this.snack.open('Could not load compliance config', 'OK', { duration: 4000 }),
    });
  }

  // ── Display helpers ─────────────────────────────────────────
  formatWeekdays(mask: number): string {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      if (mask & (1 << i)) days.push(WEEKDAY_LABELS[i]);
    }
    return days.join(', ') || '(none)';
  }

  formatScope(c: OutreachHoursConfig): string {
    if (c.scope_kind === 'global') return 'GLOBAL';
    return `${c.scope_kind.toUpperCase()}: ${c.scope_id ?? '?'}`;
  }
}
