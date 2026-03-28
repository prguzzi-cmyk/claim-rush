import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError } from 'rxjs';

/**
 * Email Integration Service
 *
 * Sends transactional emails for appointment confirmations and claim updates.
 * Currently simulates — structured for drop-in replacement with:
 * - SendGrid API
 * - AWS SES
 * - Any SMTP relay via backend proxy
 *
 * API keys and endpoints should be configured via environment variables.
 */

export interface EmailRequest {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  replyTo?: string;
  templateId?: string;
  templateData?: Record<string, string>;
}

export interface EmailResponse {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class EmailService {

  constructor(private http: HttpClient) {}

  /**
   * Send an email via the backend email relay.
   * Backend handles provider selection (SendGrid / SES / SMTP).
   */
  send(request: EmailRequest): Observable<EmailResponse> {
    return this.http.post<EmailResponse>('client-portal/email/send', request).pipe(
      catchError((err) => {
        console.warn('[EmailService] API unavailable, simulating:', err?.message);
        return of(this.simulateSend(request));
      }),
    );
  }

  /**
   * Send appointment confirmation email with pre-built content.
   */
  sendAppointmentConfirmation(data: {
    clientEmail: string;
    clientName: string;
    appointmentDate: string;
    appointmentTime: string;
    calendarLink?: string;
  }): Observable<EmailResponse> {
    const firstName = data.clientName.split(' ')[0];

    const body = [
      `Hi ${firstName},`,
      '',
      "You're all set.",
      '',
      `Your claim review has been scheduled for ${data.appointmentDate} at ${data.appointmentTime}.`,
      '',
      "We'll walk through your claim with you and answer any questions you may have.",
      '',
      'If anything changes, you can reply to this message.',
      '',
      'We look forward to speaking with you.',
      '',
      '— Your Claim Review Team',
    ].join('\n');

    return this.send({
      to: data.clientEmail,
      toName: data.clientName,
      subject: 'Your Claim Review is Scheduled',
      body,
    });
  }

  // ── Simulation ─────────────────────────────────────────────────

  private simulateSend(request: EmailRequest): EmailResponse {
    const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    console.log('[EmailService] Simulated email sent:', {
      messageId,
      to: request.to,
      subject: request.subject,
      bodyPreview: request.body.substring(0, 100) + '...',
    });
    return {
      messageId,
      status: 'sent',
    };
  }
}
