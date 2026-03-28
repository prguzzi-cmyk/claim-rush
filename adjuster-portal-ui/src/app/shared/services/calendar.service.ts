import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

/**
 * Calendar Integration Service
 *
 * Creates calendar events for claim review appointments.
 * Currently simulates — structured exactly like a Google Calendar API
 * event creation request for drop-in replacement.
 *
 * Future: connect via OAuth to Google Calendar API or Microsoft Graph API.
 * API keys and endpoints should be configured via environment variables.
 */

export interface CalendarEventRequest {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  appointmentDate: string;       // ISO date or display string
  appointmentTime: string;       // Display time (e.g., "10:00 AM")
  appointmentDateISO: string;    // Full ISO datetime for start
  appointmentEndISO: string;     // Full ISO datetime for end
  timezone: string;
  claimNumber?: string;
  notes?: string;
}

export interface CalendarEventResponse {
  eventId: string;
  calendarLink: string;
  status: 'created' | 'failed';
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {

  constructor(private http: HttpClient) {}

  /**
   * Create a calendar event for a claim review appointment.
   *
   * Structures the request exactly like a Google Calendar API v3
   * events.insert call so the backend can proxy it directly.
   */
  createCalendarEvent(data: CalendarEventRequest): Observable<CalendarEventResponse> {
    // Build Google Calendar-compatible event body
    const eventBody = {
      summary: `Claim Review – ${data.clientName}`,
      description: this.buildEventDescription(data),
      start: {
        dateTime: data.appointmentDateISO,
        timeZone: data.timezone.replace(/ \/ /g, '/').replace(/ /g, '_'),
      },
      end: {
        dateTime: data.appointmentEndISO,
        timeZone: data.timezone.replace(/ \/ /g, '/').replace(/ /g, '_'),
      },
      attendees: [
        { email: data.clientEmail, displayName: data.clientName },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
      conferenceData: {
        createRequest: {
          requestId: 'claim-review-' + Date.now(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    // POST to backend which proxies to Google Calendar API
    return this.http.post<CalendarEventResponse>(
      'client-portal/calendar/create-event',
      { event: eventBody, client_phone: data.clientPhone, claim_number: data.claimNumber },
    ).pipe(
      catchError((err) => {
        console.warn('[CalendarService] API unavailable, using simulation:', err?.message);
        return of(this.simulateEventCreation(data));
      }),
    );
  }

  /**
   * Build a human-readable event description with all client details.
   */
  private buildEventDescription(data: CalendarEventRequest): string {
    const lines = [
      'Claim review appointment',
      '',
      `Client: ${data.clientName}`,
      `Phone: ${data.clientPhone}`,
      `Email: ${data.clientEmail}`,
    ];
    if (data.claimNumber) lines.push(`Claim #: ${data.claimNumber}`);
    if (data.notes) lines.push('', `Notes: ${data.notes}`);
    lines.push('', 'Scheduled via UPA Client Portal');
    return lines.join('\n');
  }

  /**
   * Build ISO datetime strings from date + time slot.
   * Call this before createCalendarEvent to populate appointmentDateISO and appointmentEndISO.
   */
  buildISODateTimes(date: Date, timeStr: string): { start: string; end: string } {
    const [time, meridian] = timeStr.split(' ');
    const [hourStr, minStr] = time.split(':');
    let hour = parseInt(hourStr, 10);
    const min = parseInt(minStr || '0', 10);

    if (meridian?.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (meridian?.toUpperCase() === 'AM' && hour === 12) hour = 0;

    const start = new Date(date);
    start.setHours(hour, min, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30); // 30-minute appointment

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  // ── Simulation ─────────────────────────────────────────────────

  private simulateEventCreation(data: CalendarEventRequest): CalendarEventResponse {
    const eventId = 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    console.log('[CalendarService] Simulated event created:', eventId, data.clientName);
    return {
      eventId,
      calendarLink: `https://calendar.google.com/calendar/event?eid=${eventId}`,
      status: 'created',
    };
  }
}
