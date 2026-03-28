import { Component, OnInit } from '@angular/core';
import { NgxSpinnerService } from 'ngx-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UpaOutreachService, ComplianceConfig } from 'src/app/services/upa-outreach.service';

@Component({
  selector: 'app-outreach-compliance',
  templateUrl: './outreach-compliance.component.html',
  styleUrls: ['./outreach-compliance.component.scss'],
  standalone: false,
})
export class OutreachComplianceComponent implements OnInit {
  config: ComplianceConfig | null = null;

  // Editable form fields
  masterPause = false;
  quietHoursEnabled = true;
  quietHoursStart = '21:00';
  quietHoursEnd = '08:00';
  quietHoursTz = 'America/New_York';
  stopWordList = '';
  autoSuppressEnabled = true;
  maxDailySms = 3;
  maxDailyEmails = 2;

  timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
  ];

  constructor(
    private upaOutreach: UpaOutreachService,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.loadConfig();
  }

  loadConfig() {
    this.spinner.show();
    this.upaOutreach.getComplianceConfig().subscribe({
      next: (cfg) => {
        this.config = cfg;
        this.masterPause = cfg.master_pause;
        this.quietHoursEnabled = cfg.quiet_hours_enabled;
        this.quietHoursStart = cfg.quiet_hours_start;
        this.quietHoursEnd = cfg.quiet_hours_end;
        this.quietHoursTz = cfg.quiet_hours_tz;
        this.stopWordList = cfg.stop_word_list;
        this.autoSuppressEnabled = cfg.auto_suppress_enabled;
        this.maxDailySms = cfg.max_daily_sms_per_lead;
        this.maxDailyEmails = cfg.max_daily_emails_per_lead;
        this.spinner.hide();
      },
      error: () => this.spinner.hide(),
    });
  }

  saveConfig() {
    this.spinner.show();
    this.upaOutreach.updateComplianceConfig({
      master_pause: this.masterPause,
      quiet_hours_enabled: this.quietHoursEnabled,
      quiet_hours_start: this.quietHoursStart,
      quiet_hours_end: this.quietHoursEnd,
      quiet_hours_tz: this.quietHoursTz,
      stop_word_list: this.stopWordList,
      auto_suppress_enabled: this.autoSuppressEnabled,
      max_daily_sms_per_lead: this.maxDailySms,
      max_daily_emails_per_lead: this.maxDailyEmails,
    }).subscribe({
      next: (cfg) => {
        this.config = cfg;
        this.spinner.hide();
        this.snackBar.open('Compliance settings saved.', 'OK', { duration: 3000 });
      },
      error: () => {
        this.spinner.hide();
        this.snackBar.open('Failed to save settings.', 'OK', { duration: 3000 });
      },
    });
  }

  get stopWords(): string[] {
    return this.stopWordList.split(',').map(w => w.trim()).filter(w => w);
  }

  addStopWord(word: string) {
    if (!word.trim()) return;
    const words = this.stopWords;
    const upper = word.trim().toUpperCase();
    if (!words.includes(upper)) {
      words.push(upper);
      this.stopWordList = words.join(',');
    }
  }

  removeStopWord(word: string) {
    const words = this.stopWords.filter(w => w !== word);
    this.stopWordList = words.join(',');
  }
}
