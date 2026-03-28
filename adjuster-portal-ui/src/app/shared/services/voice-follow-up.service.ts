import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, tap } from 'rxjs';

/**
 * Voice Follow-Up Service
 *
 * Triggers automated follow-up workflows after a claim review is scheduled.
 * Currently simulates behavior — structured for real integration with:
 * - Retell AI / Vapi voice agent
 * - Twilio SMS system
 * - CRM event tracking
 * - Appointment reminder workflows
 */

export interface FollowUpPayload {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
  claimNumber?: string;
}

export interface VoiceCallScript {
  greeting: string;
  confirmationPrompt: string;
  reassurance: string;
  questionPrompt: string;
  closing: string;
}

export interface FollowUpResult {
  voiceCallTriggered: boolean;
  smsConfirmationSent: boolean;
  crmEventCreated: boolean;
  callId?: string;
  smsId?: string;
}

@Injectable({ providedIn: 'root' })
export class VoiceFollowUpService {

  constructor(private http: HttpClient) {}

  /**
   * Trigger the full follow-up workflow after appointment confirmation.
   * Runs in background — does not block UI.
   */
  triggerVoiceFollowUp(payload: FollowUpPayload): Observable<FollowUpResult> {
    // Future: POST to backend which orchestrates voice + SMS + CRM
    return this.http.post<FollowUpResult>('client-portal/follow-up/trigger', payload).pipe(
      catchError(() => {
        // API not available — simulate the workflow
        return of(this.simulateFollowUp(payload));
      }),
    );
  }

  /**
   * Get the voice script for the confirmation call.
   * Future: fetch from backend based on claim type / agent config.
   */
  getConfirmationScript(payload: FollowUpPayload): VoiceCallScript {
    return {
      greeting: `Hi ${payload.clientName.split(' ')[0]}, this is a quick confirmation for your upcoming claim review.`,
      confirmationPrompt: `We have you scheduled for ${payload.appointmentDate} at ${payload.appointmentTime}. Does that still work for you?`,
      reassurance: `We'll walk through everything with you and answer any questions you may have. Our goal is to make sure your claim is fully evaluated.`,
      questionPrompt: `Before we connect, is there anything specific you'd like us to look at or any questions you have about the process?`,
      closing: `Thank you, ${payload.clientName.split(' ')[0]}. We look forward to speaking with you. Have a great day.`,
    };
  }

  /**
   * Generate the SMS confirmation message.
   */
  getSmsConfirmationText(payload: FollowUpPayload): string {
    return `Your claim review is scheduled for ${payload.appointmentDate} at ${payload.appointmentTime}. We'll connect with you at your selected time. Reply HELP for assistance.`;
  }

  // ── Simulation (replace with real API calls) ───────────────────

  private simulateFollowUp(payload: FollowUpPayload): FollowUpResult {
    // Log to console for development visibility
    console.log('[VoiceFollowUp] Triggered for:', payload.clientName);
    console.log('[VoiceFollowUp] Voice script:', this.getConfirmationScript(payload));
    console.log('[VoiceFollowUp] SMS text:', this.getSmsConfirmationText(payload));

    return {
      voiceCallTriggered: true,
      smsConfirmationSent: true,
      crmEventCreated: true,
      callId: 'sim-call-' + Date.now(),
      smsId: 'sim-sms-' + Date.now(),
    };
  }
}
