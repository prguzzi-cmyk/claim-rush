import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, interval, of } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

import { VoiceOutreachEngineService } from '../../../../shared/services/voice-outreach-engine.service';
import { RotationLeadService } from '../../../../services/rotation-lead.service';
import { RotationLead } from '../../../../models/rotation-lead.model';
import {
  VoiceCallRecord,
  VoiceOutreachSession,
  VoiceCallOutcome,
  AICallStatus,
  CALL_OUTCOME_META,
  QualificationData,
} from '../../../../shared/models/voice-outreach.model';

@Component({
  selector: 'app-voice-outreach-detail',
  templateUrl: './voice-outreach-detail.component.html',
  styleUrls: ['./voice-outreach-detail.component.scss'],
  standalone: false,
})
export class VoiceOutreachDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  callId: string;
  call: VoiceCallRecord | null = null;
  session: VoiceOutreachSession | null = null;
  lead: RotationLead | null = null;
  loading = true;

  // Outcome recording (inline)
  outcomes = Object.keys(CALL_OUTCOME_META) as VoiceCallOutcome[];
  outcomeMeta = CALL_OUTCOME_META;
  selectedOutcome: VoiceCallOutcome | null = null;
  outcomeNotes = '';
  savingOutcome = false;

  readonly statusColors: Record<string, string> = {
    pending: '#9e9e9e',
    initiated: '#2196f3',
    ringing: '#ff9800',
    connected: '#4caf50',
    no_answer: '#f44336',
    voicemail: '#ff9800',
    failed: '#f44336',
    completed: '#4caf50',
    skipped: '#9e9e9e',
  };

  readonly qualFields: { key: keyof QualificationData; label: string; icon: string }[] = [
    { key: 'damageType', label: 'Damage Type', icon: 'warning' },
    { key: 'eventType', label: 'Event Type', icon: 'event' },
    { key: 'lossDate', label: 'Loss Date', icon: 'calendar_today' },
    { key: 'propertyAddress', label: 'Property Address', icon: 'location_on' },
    { key: 'hasInsuranceClaim', label: 'Has Insurance Claim', icon: 'policy' },
    { key: 'wantsInspection', label: 'Wants Inspection', icon: 'search' },
    { key: 'callbackNumber', label: 'Callback Number', icon: 'phone_callback' },
    { key: 'bestTimeToCall', label: 'Best Time to Call', icon: 'schedule' },
    { key: 'additionalNotes', label: 'Additional Notes', icon: 'notes' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private voiceService: VoiceOutreachEngineService,
    private rotationLeadService: RotationLeadService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.callId = this.route.snapshot.paramMap.get('callId') || '';
    this.loadCallData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCallData(): void {
    this.loading = true;

    // We need to find the call by iterating sessions. Load all leads, then find the call.
    this.rotationLeadService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (leads) => {
          const leadList = Array.isArray(leads) ? leads : (leads as any)?.items || [];
          this.findCallInLeads(leadList);
        },
        error: () => {
          this.loading = false;
          this.snackBar.open('Failed to load data', '', { duration: 3000 });
        },
      });
  }

  private findCallInLeads(leads: RotationLead[]): void {
    let found = false;

    const checkNext = (index: number) => {
      if (index >= leads.length) {
        this.loading = false;
        if (!found) {
          this.snackBar.open('Call not found', '', { duration: 3000 });
        }
        return;
      }

      this.voiceService.getSession(leads[index].id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (session) => {
            if (session?.callAttempts) {
              const match = session.callAttempts.find(c => c.id === this.callId);
              if (match) {
                found = true;
                this.call = match;
                this.session = session;
                this.lead = leads[index];
                this.selectedOutcome = match.outcome || null;
                this.loading = false;
                this.startPollingIfLive();
                return;
              }
            }
            checkNext(index + 1);
          },
          error: () => checkNext(index + 1),
        });
    };

    checkNext(0);
  }

  private startPollingIfLive(): void {
    if (!this.call || !this.isLiveStatus(this.call.status)) return;

    interval(3000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => {
        if (!this.call || !this.isLiveStatus(this.call.status)) return of(null);
        return this.voiceService.getCallStatus(this.call.id);
      }),
    ).subscribe(status => {
      if (status && this.call) {
        this.call.status = status.status || this.call.status;
        if (status.durationSeconds != null) this.call.durationSeconds = status.durationSeconds;
        if (status.endedAt) this.call.endedAt = status.endedAt;
      }
    });
  }

  isLiveStatus(status: AICallStatus): boolean {
    return status === 'initiated' || status === 'ringing' || status === 'connected';
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || '#9e9e9e';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getOutcomeLabel(outcome: VoiceCallOutcome | null): string {
    if (!outcome) return '—';
    return CALL_OUTCOME_META[outcome]?.label || outcome;
  }

  getOutcomeColor(outcome: VoiceCallOutcome | null): string {
    if (!outcome) return '#9e9e9e';
    return CALL_OUTCOME_META[outcome]?.color || '#9e9e9e';
  }

  getOutcomeIcon(outcome: VoiceCallOutcome | null): string {
    if (!outcome) return '';
    return CALL_OUTCOME_META[outcome]?.icon || '';
  }

  formatDuration(seconds: number | null): string {
    if (seconds == null) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getQualValue(qual: QualificationData, key: keyof QualificationData): string | null {
    const val = qual[key];
    if (val == null) return null;
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  }

  hasQualificationData(): boolean {
    if (!this.call?.qualificationData) return false;
    const q = this.call.qualificationData;
    return this.qualFields.some(f => q[f.key] != null);
  }

  saveOutcome(): void {
    if (!this.call || !this.selectedOutcome) return;
    this.savingOutcome = true;

    this.voiceService.recordCallOutcome(
      this.call.id,
      this.selectedOutcome,
      null,
      this.outcomeNotes || null,
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (record) => {
          this.savingOutcome = false;
          this.call = record;
          this.snackBar.open('Outcome recorded', '', { duration: 3000 });
        },
        error: () => {
          this.savingOutcome = false;
          this.snackBar.open('Failed to record outcome', '', { duration: 3000 });
        },
      });
  }

  getContactStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  goBack(): void {
    this.router.navigate(['/app/voice-outreach']);
  }
}
