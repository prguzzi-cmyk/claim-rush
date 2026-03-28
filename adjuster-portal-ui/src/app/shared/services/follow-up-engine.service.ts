import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, catchError } from 'rxjs';
import {
  UserClaimState,
  FollowUpSequence,
  FollowUpStep,
  FollowUpEvent,
  FollowUpChannel,
  FOLLOW_UP_MESSAGES,
} from '../models/follow-up.model';

/**
 * Intelligent Follow-Up Engine
 *
 * Tracks user activity states and triggers automated re-engagement
 * sequences across SMS, email, and voice channels.
 *
 * Currently simulates all delivery — structured for real integration with:
 * - Twilio (SMS)
 * - Email API (SendGrid / SES)
 * - AI Voice Agent (Retell / Vapi)
 * - CRM automation workflows
 */
@Injectable({ providedIn: 'root' })
export class FollowUpEngineService {

  private events$ = new BehaviorSubject<FollowUpEvent[]>([]);
  private activeSequences$ = new BehaviorSubject<FollowUpSequence[]>([]);
  private timers = new Map<string, any[]>();

  constructor(private http: HttpClient) {}

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Track a user state change and trigger the appropriate follow-up sequence.
   * Call this whenever a user reaches a new state in the claim flow.
   */
  trackState(
    clientId: string,
    state: UserClaimState,
    context: { name: string; phone: string; email: string; claimNumber?: string },
  ): void {
    if (state === 'completed') {
      this.cancelSequencesForClient(clientId);
      // Notify backend to cancel follow-ups
      this.http.post('client-portal/follow-up/cancel/' + clientId, {}).pipe(
        catchError(() => of(null)),
      ).subscribe();
      return;
    }

    // Cancel any existing sequence for this client before starting a new one
    this.cancelSequencesForClient(clientId);

    // Persist lead to backend
    this.http.post<any>('client-portal/leads', {
      name: context.name || 'Portal User',
      email: context.email || null,
      phone: context.phone || null,
      claim_number: context.claimNumber || null,
      source: 'client_portal',
    }).pipe(catchError(() => of(null))).subscribe();

    const sequence = this.buildSequence(clientId, state, context);
    this.activeSequences$.next([...this.activeSequences$.value, sequence]);
    this.scheduleSequence(sequence);
  }

  /**
   * Trigger the follow-up sequence directly (alternative entry point).
   */
  triggerFollowUpSequence(userState: UserClaimState, context: {
    clientId: string;
    name: string;
    phone: string;
    email: string;
    claimNumber?: string;
  }): void {
    this.trackState(context.clientId, userState, context);
  }

  /**
   * Cancel all follow-ups for a client (e.g., when they complete the flow).
   */
  cancelSequencesForClient(clientId: string): void {
    const timers = this.timers.get(clientId);
    if (timers) {
      timers.forEach(t => clearTimeout(t));
      this.timers.delete(clientId);
    }

    const sequences = this.activeSequences$.value.map(s =>
      s.clientId === clientId ? { ...s, cancelled: true } : s
    );
    this.activeSequences$.next(sequences);
  }

  /**
   * Get all follow-up events for dashboard visibility.
   */
  getEvents(): Observable<FollowUpEvent[]> {
    return this.events$.asObservable();
  }

  /**
   * Get active sequences.
   */
  getActiveSequences(): Observable<FollowUpSequence[]> {
    return this.activeSequences$.asObservable();
  }

  // ── Sequence Builder ───────────────────────────────────────────

  private buildSequence(
    clientId: string,
    state: UserClaimState,
    context: { name: string; phone: string; email: string; claimNumber?: string },
  ): FollowUpSequence {
    const steps = this.getStepsForState(state);
    return {
      id: 'seq-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
      clientId,
      clientName: context.name,
      clientPhone: context.phone,
      clientEmail: context.email,
      claimNumber: context.claimNumber || null,
      userState: state,
      steps,
      createdAt: new Date().toISOString(),
      completedAt: null,
      cancelled: false,
    };
  }

  private getStepsForState(state: UserClaimState): FollowUpStep[] {
    switch (state) {
      case 'started_no_photos':
        return [
          { delayMinutes: 60,   type: 'reminder',       channel: 'sms',   messageKey: 'reminder_photos',   status: 'pending', sentAt: null },
          { delayMinutes: 1440, type: 're_engagement',  channel: 'email', messageKey: 'reengage_general',  status: 'pending', sentAt: null },
          { delayMinutes: 2880, type: 're_engagement',  channel: 'sms',   messageKey: 'reengage_general',  status: 'pending', sentAt: null },
        ];

      case 'photos_uploaded_no_continue':
        return [
          { delayMinutes: 60,   type: 'reminder',       channel: 'sms',   messageKey: 'reminder_continue',  status: 'pending', sentAt: null },
          { delayMinutes: 1440, type: 're_engagement',  channel: 'email', messageKey: 'reengage_insights',  status: 'pending', sentAt: null },
        ];

      case 'insights_viewed_no_review':
        return [
          { delayMinutes: 60,   type: 'reminder',       channel: 'sms',   messageKey: 'reengage_insights', status: 'pending', sentAt: null },
          { delayMinutes: 1440, type: 're_engagement',  channel: 'email', messageKey: 'reengage_insights', status: 'pending', sentAt: null },
          { delayMinutes: 2880, type: 're_engagement',  channel: 'voice', messageKey: 'reengage_insights', status: 'pending', sentAt: null },
        ];

      case 'review_requested_no_schedule':
        return [
          { delayMinutes: 60,   type: 'reminder',       channel: 'sms',   messageKey: 'reminder_schedule', status: 'pending', sentAt: null },
          { delayMinutes: 1440, type: 're_engagement',  channel: 'email', messageKey: 'reminder_schedule', status: 'pending', sentAt: null },
        ];

      case 'scheduled_no_attendance':
        return [
          { delayMinutes: 60,   type: 'reinforcement',  channel: 'sms',   messageKey: 'reinforce_missed',    status: 'pending', sentAt: null },
          { delayMinutes: 1440, type: 're_engagement',  channel: 'email', messageKey: 'reinforce_missed',    status: 'pending', sentAt: null },
          { delayMinutes: 2880, type: 're_engagement',  channel: 'voice', messageKey: 'reinforce_missed',    status: 'pending', sentAt: null },
        ];

      default:
        return [];
    }
  }

  // ── Scheduler ──────────────────────────────────────────────────

  private scheduleSequence(sequence: FollowUpSequence): void {
    const clientTimers: any[] = [];

    sequence.steps.forEach((step, idx) => {
      // In simulation: use seconds instead of minutes for dev speed
      // In production: use step.delayMinutes * 60000
      const delayMs = step.delayMinutes * 1000; // 1 min = 1 sec in simulation

      const timer = setTimeout(() => {
        if (sequence.cancelled) return;
        this.executeStep(sequence, step, idx);
      }, delayMs);

      clientTimers.push(timer);
    });

    this.timers.set(sequence.clientId, clientTimers);
  }

  private executeStep(sequence: FollowUpSequence, step: FollowUpStep, stepIndex: number): void {
    if (sequence.cancelled) return;

    const message = FOLLOW_UP_MESSAGES[step.messageKey];
    if (!message) return;

    // Build the event
    const event: FollowUpEvent = {
      id: 'evt-' + Date.now(),
      sequenceId: sequence.id,
      clientId: sequence.clientId,
      type: step.type,
      channel: step.channel,
      status: 'sent',
      messageKey: step.messageKey,
      messageText: this.getMessageText(message, step.channel),
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      failureReason: null,
    };

    // Attempt real delivery, fall back to simulation
    this.deliverMessage(sequence, step, event).subscribe(result => {
      event.status = result ? 'delivered' : 'sent';
      event.deliveredAt = result ? new Date().toISOString() : null;

      step.status = event.status;
      step.sentAt = event.sentAt;

      // Log event
      this.events$.next([event, ...this.events$.value]);

      console.log(`[FollowUp] ${step.channel.toUpperCase()} ${step.type} sent to ${sequence.clientName}: "${event.messageText}"`);

      // Check if sequence is complete
      if (stepIndex === sequence.steps.length - 1) {
        sequence.completedAt = new Date().toISOString();
      }
    });
  }

  // ── Delivery (simulated — replace per channel) ─────────────────

  private deliverMessage(
    sequence: FollowUpSequence,
    step: FollowUpStep,
    event: FollowUpEvent,
  ): Observable<boolean> {
    const payload = {
      client_id: sequence.clientId,
      client_name: sequence.clientName,
      client_phone: sequence.clientPhone,
      client_email: sequence.clientEmail,
      claim_number: sequence.claimNumber,
      channel: step.channel,
      message_key: step.messageKey,
      message_text: event.messageText,
      follow_up_type: step.type,
    };

    // Future: POST to real delivery endpoints per channel
    return this.http.post<any>('client-portal/follow-up/deliver', payload).pipe(
      catchError(() => {
        // Simulation fallback
        return of(true);
      }),
    );
  }

  private getMessageText(message: { smsText: string; emailBody: string; voiceScript: string | null }, channel: FollowUpChannel): string {
    switch (channel) {
      case 'sms': return message.smsText;
      case 'email': return message.emailBody;
      case 'voice': return message.voiceScript || message.smsText;
    }
  }
}
