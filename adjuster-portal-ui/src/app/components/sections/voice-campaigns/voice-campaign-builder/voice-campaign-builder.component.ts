import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of, Subject, interval } from 'rxjs';
import { takeUntil, switchMap, filter } from 'rxjs/operators';
import { VoiceCampaignService } from 'src/app/services/voice-campaign.service';
import { VoiceCampaignCreate, VoiceCampaign } from 'src/app/models/voice-campaign.model';
import { VoiceLeadSelectorDialogComponent } from '../voice-lead-selector-dialog/voice-lead-selector-dialog.component';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-voice-campaign-builder',
  templateUrl: './voice-campaign-builder.component.html',
  styleUrls: ['./voice-campaign-builder.component.scss'],
  standalone: false,
})
export class VoiceCampaignBuilderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Edit mode
  editMode = false;
  campaignId: string | null = null;
  loadingCampaign = false;
  campaignStatus = 'draft';

  campaign: VoiceCampaignCreate = {
    name: '',
    description: '',
    script_template: '',
    lead_source_filter: '',
    territory_state_filter: '',
    incident_type_filter: '',
    call_window_start: '09:00',
    call_window_end: '17:00',
    call_window_timezone: 'America/New_York',
    max_retries: 3,
    retry_delay_minutes: 120,
    max_calls_per_day: 100,
  };

  selectedLeads: any[] = [];
  saving = false;
  launching = false;
  formDirty = false;
  private navigatingAway = false;
  nameError = '';
  windowError = '';
  retryError = '';
  callLimitError = '';
  scriptError = '';

  // Draft auto-save
  private readonly DRAFT_KEY = 'voice-campaign-draft';
  hasSavedDraft = false;
  savedDraftTime: Date | null = null;

  leadSources = [
    { value: '', label: 'All Sources' },
    { value: 'fire', label: 'Fire' },
    { value: 'storm', label: 'Storm' },
    { value: 'hail', label: 'Hail' },
    { value: 'rotation', label: 'Rotation' },
  ];

  timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
  ];

  selectedPreset = '';
  scriptPresets = [
    { key: 'fire', label: 'Fire Damage', script: 'Hi, this is {{agent_name}} from UPA. I\'m reaching out because we noticed recent fire activity near your property. We specialize in helping homeowners navigate insurance claims for fire and smoke damage. Have you had a chance to assess any damage to your home? I\'d love to schedule a free inspection to help document everything for your claim.' },
    { key: 'storm', label: 'Storm Damage', script: 'Hi, this is {{agent_name}} from UPA. I\'m calling because there was significant storm activity in your area recently. Many homeowners don\'t realize they may have roof or structural damage from high winds and heavy rain. We offer free property inspections to help identify any issues. Would you be interested in scheduling one?' },
    { key: 'hail', label: 'Hail Damage', script: 'Hi, this is {{agent_name}} from UPA. We\'re reaching out to homeowners in your area following recent hail storms. Hail damage to roofing and siding often isn\'t visible from the ground but can lead to costly problems later. We provide free damage assessments. Do you have a few minutes to discuss scheduling an inspection?' },
    { key: 'general', label: 'General Outreach', script: 'Hi, this is {{agent_name}} from UPA. I\'m calling to check in about your property. We help homeowners with insurance claims for property damage, and I wanted to see if you\'ve experienced any recent issues with your home. Do you have a moment to chat?' },
  ];

  constructor(
    private campaignService: VoiceCampaignService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.formDirty && !this.navigatingAway) {
      event.preventDefault();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (!this.saving && !this.launching) this.saveDraft();
    }
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (!this.formDirty || this.navigatingAway) return true;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        color: 'warn',
      },
    });
    return dialogRef.afterClosed();
  }

  get isReadOnly(): boolean {
    return this.editMode && this.campaignStatus !== 'draft';
  }

  markDirty(): void {
    this.formDirty = true;
  }

  applyScriptPreset(key: string): void {
    if (!key) return;
    const preset = this.scriptPresets.find(p => p.key === key);
    if (preset) {
      this.campaign.script_template = preset.script;
      this.markDirty();
    }
  }

  applyRetryPreset(retries: number, delay: number, maxCalls: number): void {
    this.campaign.max_retries = retries;
    this.campaign.retry_delay_minutes = delay;
    this.campaign.max_calls_per_day = maxCalls;
    this.markDirty();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.editMode = true;
      this.campaignId = id;
      this.loadCampaign(id);
    } else {
      this.checkForSavedDraft();
    }

    // Auto-save draft every 30 seconds when form is dirty
    interval(30000).pipe(
      takeUntil(this.destroy$),
      filter(() => this.formDirty && !this.saving && !this.launching && !this.editMode),
    ).subscribe(() => this.saveDraftToStorage());
  }

  private get draftStorageKey(): string {
    return this.campaignId ? `${this.DRAFT_KEY}-${this.campaignId}` : this.DRAFT_KEY;
  }

  private checkForSavedDraft(): void {
    try {
      const saved = localStorage.getItem(this.draftStorageKey);
      if (saved) {
        const draft = JSON.parse(saved);
        this.savedDraftTime = new Date(draft._savedAt);
        this.hasSavedDraft = true;
      }
    } catch { /* ignore */ }
  }

  recoverDraft(): void {
    try {
      const saved = localStorage.getItem(this.draftStorageKey);
      if (saved) {
        const draft = JSON.parse(saved);
        delete draft._savedAt;
        this.campaign = { ...this.campaign, ...draft };
        this.hasSavedDraft = false;
        this.formDirty = true;
        this.snackBar.open('Draft recovered', 'OK', { duration: 2000 });
      }
    } catch { /* ignore */ }
  }

  discardDraft(): void {
    localStorage.removeItem(this.draftStorageKey);
    this.hasSavedDraft = false;
  }

  private saveDraftToStorage(): void {
    try {
      const draft = { ...this.campaign, _savedAt: new Date().toISOString() };
      localStorage.setItem(this.draftStorageKey, JSON.stringify(draft));
    } catch { /* ignore quota errors */ }
  }

  private clearDraftStorage(): void {
    localStorage.removeItem(this.draftStorageKey);
  }

  private loadCampaign(id: string): void {
    this.loadingCampaign = true;
    this.campaignService.getById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (c) => {
        this.campaign = {
          name: c.name,
          description: c.description || '',
          script_template: c.script_template || '',
          lead_source_filter: c.lead_source_filter || '',
          territory_state_filter: c.territory_state_filter || '',
          incident_type_filter: c.incident_type_filter || '',
          call_window_start: c.call_window_start || '09:00',
          call_window_end: c.call_window_end || '17:00',
          call_window_timezone: c.call_window_timezone || 'America/New_York',
          max_retries: c.max_retries ?? 3,
          retry_delay_minutes: c.retry_delay_minutes ?? 120,
          max_calls_per_day: c.max_calls_per_day ?? 100,
        };
        this.campaignStatus = c.status || 'draft';
        this.loadingCampaign = false;
        // Reset dirty flag after populating form from loaded data
        setTimeout(() => this.formDirty = false);
      },
      error: () => {
        this.snackBar.open('Failed to load campaign', 'OK', { duration: 3000 });
        this.router.navigate(['/app/outreach/voice']);
      },
    });
  }

  openLeadSelector(): void {
    const dialogRef = this.dialog.open(VoiceLeadSelectorDialogComponent, {
      width: '800px',
      maxHeight: '80vh',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const existingIds = new Set(this.selectedLeads.map(l => l.id));
        const newLeads = result.filter((l: any) => !existingIds.has(l.id));
        this.selectedLeads = [...this.selectedLeads, ...newLeads];
      }
    });
  }

  removeLead(lead: any): void {
    this.selectedLeads = this.selectedLeads.filter(l => l.id !== lead.id);
  }

  clearLeads(): void {
    this.selectedLeads = [];
  }

  getLeadName(lead: any): string {
    return lead?.contact?.full_name || 'Unknown';
  }

  getLeadPhone(lead: any): string {
    return lead?.contact?.phone_number || '—';
  }

  private validate(): boolean {
    this.nameError = '';
    this.windowError = '';
    this.retryError = '';
    this.callLimitError = '';
    this.scriptError = '';
    let valid = true;
    if (!this.campaign.name?.trim()) {
      this.nameError = 'Campaign name is required';
      valid = false;
    } else if (this.campaign.name.length > 200) {
      this.nameError = 'Campaign name must be 200 characters or fewer';
      valid = false;
    }
    if (this.campaign.script_template && this.campaign.script_template.length > 5000) {
      this.scriptError = 'Script must be 5,000 characters or fewer';
      valid = false;
    }
    if (this.campaign.call_window_start && this.campaign.call_window_end) {
      const startMin = this.timeToMinutes(this.campaign.call_window_start);
      const endMin = this.timeToMinutes(this.campaign.call_window_end);
      if (endMin <= startMin) {
        this.windowError = 'Start time must be before end time';
        valid = false;
      } else if (endMin - startMin < 15) {
        this.windowError = 'Call window must be at least 15 minutes';
        valid = false;
      }
    }
    if (this.campaign.max_retries != null && this.campaign.max_retries < 0) {
      this.retryError = 'Max retries cannot be negative';
      valid = false;
    }
    if (this.campaign.retry_delay_minutes != null && this.campaign.retry_delay_minutes < 1) {
      this.retryError = this.retryError || 'Retry delay must be at least 1 minute';
      valid = false;
    }
    if (this.campaign.max_calls_per_day != null && this.campaign.max_calls_per_day < 1) {
      this.callLimitError = 'Max calls per day must be at least 1';
      valid = false;
    }
    return valid;
  }

  private timeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  hasErrors(): boolean {
    return !!(this.nameError || this.scriptError || this.windowError || this.retryError || this.callLimitError);
  }

  getScriptCounterClass(): string {
    const len = this.campaign.script_template?.length || 0;
    if (len >= 4750) return 'counter-danger';
    if (len >= 4000) return 'counter-warn';
    return '';
  }

  getConfigWarnings(): Array<{ icon: string; message: string }> {
    const warnings: Array<{ icon: string; message: string }> = [];
    // Aggressive retries
    if ((this.campaign.max_retries ?? 0) >= 5 && (this.campaign.retry_delay_minutes ?? 0) < 60) {
      warnings.push({ icon: 'warning', message: 'Aggressive retry config (5+ retries, <60 min delay) may increase costs significantly.' });
    }
    // Short call window
    if (this.campaign.call_window_start && this.campaign.call_window_end) {
      const diff = this.timeToMinutes(this.campaign.call_window_end) - this.timeToMinutes(this.campaign.call_window_start);
      if (diff > 0 && diff < 120) {
        warnings.push({ icon: 'schedule', message: 'Short call window (<2 hours) may limit campaign reach.' });
      }
    }
    // No script
    if (!this.campaign.script_template?.trim()) {
      warnings.push({ icon: 'smart_toy', message: 'No script provided. The AI agent will need clear context to perform well.' });
    }
    // Very high calls per day
    if ((this.campaign.max_calls_per_day ?? 0) > 500) {
      warnings.push({ icon: 'speed', message: 'Very high daily call limit (500+) may result in significant costs.' });
    }
    return warnings;
  }

  getCallWindowDuration(): string | null {
    if (!this.campaign.call_window_start || !this.campaign.call_window_end) return null;
    const diff = this.timeToMinutes(this.campaign.call_window_end) - this.timeToMinutes(this.campaign.call_window_start);
    if (diff <= 0) return null;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${mins} minute${mins > 1 ? 's' : ''}`;
  }

  saveDraft(): void {
    if (!this.validate()) return;
    this.saving = true;
    this.navigatingAway = true;

    const save$ = this.editMode && this.campaignId
      ? this.campaignService.update(this.campaignId, this.campaign)
      : this.campaignService.create(this.campaign);

    save$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.clearDraftStorage();
        this.snackBar.open(this.editMode ? 'Campaign updated' : 'Campaign saved as draft', 'OK', { duration: 3000 });
        this.router.navigate(['/app/outreach/voice']);
      },
      error: () => {
        this.snackBar.open('Failed to save campaign', 'Retry', { duration: 5000 })
          .onAction().subscribe(() => this.saveDraft());
        this.saving = false;
        this.navigatingAway = false;
      },
    });
  }

  saveAndLaunch(): void {
    if (!this.validate()) return;
    // Filter out leads without phone numbers
    const validLeads = this.selectedLeads.filter(l => l?.contact?.phone_number);
    if (validLeads.length === 0) {
      this.snackBar.open('No selected leads have valid phone numbers', 'OK', { duration: 3000 });
      return;
    }
    if (validLeads.length < this.selectedLeads.length) {
      const excluded = this.selectedLeads.length - validLeads.length;
      this.snackBar.open(`${excluded} lead(s) without phone numbers will be excluded`, 'OK', { duration: 3000 });
    }
    const leadIds = validLeads.map(l => l.id);

    // Show pre-launch confirmation
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Launch Campaign',
        message: `Ready to launch "${this.campaign.name}"?\n\n` +
          `Leads: ${leadIds.length}\n` +
          `Call Window: ${this.campaign.call_window_start} – ${this.campaign.call_window_end} (${this.campaign.call_window_timezone})\n` +
          `Max Retries: ${this.campaign.max_retries}\n` +
          `Max Calls/Day: ${this.campaign.max_calls_per_day}`,
        confirmLabel: 'Launch',
        cancelLabel: 'Cancel',
        color: 'primary',
      },
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.performLaunch(leadIds);
    });
  }

  private performLaunch(leadIds: string[]): void {
    this.launching = true;
    this.navigatingAway = true;

    const save$ = this.editMode && this.campaignId
      ? this.campaignService.update(this.campaignId, this.campaign)
      : this.campaignService.create(this.campaign);

    save$.pipe(
      takeUntil(this.destroy$),
      switchMap((saved: VoiceCampaign) =>
        this.campaignService.launch(saved.id, { lead_ids: leadIds })
      ),
    ).subscribe({
      next: () => {
        this.clearDraftStorage();
        this.snackBar.open(
          `Campaign "${this.campaign.name}" launched with ${leadIds.length} leads!`,
          'OK', { duration: 4000 },
        );
        this.router.navigate(['/app/outreach/voice']);
      },
      error: () => {
        this.snackBar.open('Failed to save and launch campaign', 'Retry', { duration: 5000 })
          .onAction().subscribe(() => this.performLaunch(leadIds));
        this.launching = false;
        this.navigatingAway = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/app/outreach/voice']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
