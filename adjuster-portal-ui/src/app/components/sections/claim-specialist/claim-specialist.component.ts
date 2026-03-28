import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MyClaimService, ClientProfile } from '../../my-claim/my-claim.service';
import { VoiceFollowUpService, FollowUpResult } from 'src/app/shared/services/voice-follow-up.service';
import { FollowUpEngineService } from 'src/app/shared/services/follow-up-engine.service';
import { CalendarService, CalendarEventResponse } from 'src/app/shared/services/calendar.service';
import { EmailService } from 'src/app/shared/services/email.service';

type SpecialistStep = 'intro' | 'qualify' | 'schedule' | 'confirmed';

interface TimeSlot {
  label: string;
  time: string;
  period: 'morning' | 'afternoon' | 'evening';
  available: boolean;
}

interface ScheduleDay {
  date: Date;
  label: string;
  dayName: string;
  slots: TimeSlot[];
}

@Component({
  selector: 'app-claim-specialist',
  templateUrl: './claim-specialist.component.html',
  styleUrls: ['./claim-specialist.component.scss'],
  standalone: false,
})
export class ClaimSpecialistComponent implements OnInit {

  step: SpecialistStep = 'intro';

  // Schedule state
  availableDays: ScheduleDay[] = [];
  selectedDay: ScheduleDay | null = null;
  selectedSlot: TimeSlot | null = null;
  detectedTimezone = '';

  // Form fields
  clientName = '';
  clientPhone = '';
  clientEmail = '';
  submitting = false;

  // Follow-up state
  followUpTriggered = false;
  followUpResult: FollowUpResult | null = null;
  calendarEventId: string | null = null;
  calendarLink: string | null = null;
  emailSent = false;

  private clientId = '';

  constructor(
    private router: Router,
    private claimService: MyClaimService,
    private voiceFollowUp: VoiceFollowUpService,
    private followUpEngine: FollowUpEngineService,
    private calendarService: CalendarService,
    private emailService: EmailService,
  ) {}

  ngOnInit(): void {
    this.detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      .replace(/_/g, ' ')
      .replace(/\//g, ' / ');

    this.buildAvailableDays();

    // Pre-fill from profile if available
    this.claimService.getProfile().subscribe(p => {
      if (p) {
        this.clientId = p.id;
        this.clientName = `${p.firstName} ${p.lastName}`.trim();
        this.clientEmail = p.email || '';
        this.clientPhone = p.phone || '';
      }
    });
  }

  // ── Step Navigation ────────────────────────────────────────────

  acceptReview(): void {
    this.step = 'qualify';
  }

  declineReview(): void {
    this.router.navigate(['/client/dashboard'], {
      queryParams: { status: 'processing', message: 'review_later' },
    });
  }

  scheduleCall(): void {
    this.step = 'schedule';
  }

  continueOnline(): void {
    this.router.navigate(['/client/dashboard'], {
      queryParams: { status: 'processing', review: 'online' },
    });
  }

  // ── Calendar Logic ─────────────────────────────────────────────

  private buildAvailableDays(): void {
    const days: ScheduleDay[] = [];
    const now = new Date();

    for (let i = 1; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      // Skip weekends
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      days.push({
        date: d,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        slots: this.generateSlots(),
      });
    }

    this.availableDays = days;
  }

  private generateSlots(): TimeSlot[] {
    // Mock slots — some randomly unavailable for realism
    const allSlots: TimeSlot[] = [
      { label: '9:00 AM', time: '09:00', period: 'morning', available: true },
      { label: '10:00 AM', time: '10:00', period: 'morning', available: true },
      { label: '11:00 AM', time: '11:00', period: 'morning', available: Math.random() > 0.3 },
      { label: '12:00 PM', time: '12:00', period: 'afternoon', available: true },
      { label: '1:00 PM', time: '13:00', period: 'afternoon', available: Math.random() > 0.2 },
      { label: '2:00 PM', time: '14:00', period: 'afternoon', available: true },
      { label: '3:00 PM', time: '15:00', period: 'afternoon', available: Math.random() > 0.3 },
      { label: '5:00 PM', time: '17:00', period: 'evening', available: true },
      { label: '6:00 PM', time: '18:00', period: 'evening', available: Math.random() > 0.4 },
    ];
    return allSlots;
  }

  selectDay(day: ScheduleDay): void {
    this.selectedDay = day;
    this.selectedSlot = null;
  }

  selectSlot(slot: TimeSlot): void {
    if (!slot.available) return;
    this.selectedSlot = slot;
  }

  get morningSlots(): TimeSlot[] {
    return this.selectedDay?.slots.filter(s => s.period === 'morning') || [];
  }

  get afternoonSlots(): TimeSlot[] {
    return this.selectedDay?.slots.filter(s => s.period === 'afternoon') || [];
  }

  get eveningSlots(): TimeSlot[] {
    return this.selectedDay?.slots.filter(s => s.period === 'evening') || [];
  }

  get canConfirm(): boolean {
    return !!(this.selectedDay && this.selectedSlot && this.clientName.trim() && this.clientPhone.trim());
  }

  get confirmationDate(): string {
    if (!this.selectedDay || !this.selectedSlot) return '';
    return `${this.selectedDay.dayName}, ${this.selectedDay.label} at ${this.selectedSlot.label}`;
  }

  // ── Submit ─────────────────────────────────────────────────────

  confirmAppointment(): void {
    if (!this.canConfirm || !this.selectedDay || !this.selectedSlot) return;
    this.submitting = true;

    // 1. Build ISO datetimes for the calendar event
    const isoTimes = this.calendarService.buildISODateTimes(
      this.selectedDay.date,
      this.selectedSlot.label,
    );

    const tz = this.detectedTimezone.replace(/ \/ /g, '/').replace(/ /g, '_');

    // 2. Create calendar event
    this.calendarService.createCalendarEvent({
      clientName: this.clientName,
      clientEmail: this.clientEmail,
      clientPhone: this.clientPhone,
      appointmentDate: this.selectedDay.label,
      appointmentTime: this.selectedSlot.label,
      appointmentDateISO: isoTimes.start,
      appointmentEndISO: isoTimes.end,
      timezone: tz,
    }).subscribe({
      next: (calResult) => {
        this.calendarEventId = calResult.eventId;
        this.calendarLink = calResult.calendarLink;

        if (calResult.status === 'failed') {
          console.error('[ClaimSpecialist] Calendar event failed:', calResult.error);
          // Still allow booking — do not block user flow
        }

        // 3. Transition to confirmed step
        this.submitting = false;
        this.step = 'confirmed';

        // 4. Cancel re-engagement follow-ups
        if (this.clientId) {
          this.followUpEngine.trackState(this.clientId, 'completed', {
            name: this.clientName, phone: this.clientPhone, email: this.clientEmail,
          });
        }

        // 5. Send confirmation email (background, non-blocking)
        this.sendConfirmationEmail();

        // 6. Trigger voice follow-up (background)
        this.triggerVoiceFollowUp();

        // 7. Log CRM event
        this.logCrmEvent();
      },
      error: () => {
        // Calendar failed but don't block the user
        console.error('[ClaimSpecialist] Calendar service error — proceeding anyway');
        this.submitting = false;
        this.step = 'confirmed';
        this.sendConfirmationEmail();
        this.triggerVoiceFollowUp();
        this.logCrmEvent();
      },
    });
  }

  private sendConfirmationEmail(): void {
    if (!this.clientEmail || !this.selectedDay || !this.selectedSlot) return;

    this.emailService.sendAppointmentConfirmation({
      clientEmail: this.clientEmail,
      clientName: this.clientName,
      appointmentDate: this.selectedDay.label,
      appointmentTime: this.selectedSlot.label,
      calendarLink: this.calendarLink || undefined,
    }).subscribe({
      next: (result) => {
        this.emailSent = result.status === 'sent' || result.status === 'queued';
        if (result.status === 'failed') {
          console.error('[ClaimSpecialist] Email failed:', result.error);
        }
      },
      error: (err) => {
        console.error('[ClaimSpecialist] Email service error:', err);
        // Do NOT block user flow
      },
    });
  }

  private triggerVoiceFollowUp(): void {
    if (!this.selectedDay || !this.selectedSlot) return;

    this.voiceFollowUp.triggerVoiceFollowUp({
      clientName: this.clientName,
      clientPhone: this.clientPhone,
      clientEmail: this.clientEmail,
      appointmentDate: this.selectedDay.label,
      appointmentTime: this.selectedSlot.label,
      timezone: this.detectedTimezone,
    }).subscribe(result => {
      this.followUpResult = result;
      this.followUpTriggered = true;
    });
  }

  private logCrmEvent(): void {
    if (!this.selectedDay || !this.selectedSlot) return;

    const eventData = {
      event_type: 'appointment_scheduled',
      client_id: this.clientId,
      client_name: this.clientName,
      client_phone: this.clientPhone,
      client_email: this.clientEmail,
      appointment_date: this.selectedDay.label,
      appointment_time: this.selectedSlot.label,
      timezone: this.detectedTimezone,
      calendar_event_id: this.calendarEventId,
      calendar_link: this.calendarLink,
      timestamp: new Date().toISOString(),
    };

    console.log('[CRM] Event logged:', eventData);
    // Future: POST to CRM tracking endpoint
  }

  goToDashboard(): void {
    this.router.navigate(['/client/dashboard'], {
      queryParams: { status: 'processing', review: 'scheduled' },
    });
  }
}
