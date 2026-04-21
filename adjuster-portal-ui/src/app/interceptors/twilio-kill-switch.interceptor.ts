import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of } from 'rxjs';

/**
 * TWILIO KILL SWITCH — global halt for all Twilio-routed traffic.
 *
 * Short-circuits any HTTP request whose URL matches Twilio-backed backend endpoints:
 *   - SMS sends / retries
 *   - Voice (Twilio voice) sends
 *   - Messaging / Twilio-specific paths
 * Everything else (email, templates, dashboards, claims, auth, statements, etc.)
 * passes through unchanged. Flip TWILIO_HALTED to false to resume.
 */
export const TWILIO_HALTED = true;

/**
 * URL patterns that represent Twilio-routed traffic on the backend. Kept tight so
 * non-Twilio APIs (email/etc.) continue to work. Extend only when we confirm a new
 * endpoint is Twilio-backed.
 */
const TWILIO_URL_PATTERNS: RegExp[] = [
  /\/communications-hub\/send\/sms(\b|\/|\?|$)/i,
  /\/communications-hub\/send\/voice(\b|\/|\?|$)/i,
  /\/communications\/resend(\b|\/|\?|$)/i,
  /\/communications\/[^/]+\/resend(\b|\/|\?|$)/i,
  /\/leads\/[^/]+\/communications\/resend(\b|\/|\?|$)/i,
  /\/send-sms(\b|\/|\?|$)/i,
  /\/send-voice(\b|\/|\?|$)/i,
  /\/twilio(\b|\/|\?|$)/i,
  /\/messaging\/(send|dispatch|retry)(\b|\/|\?|$)/i,
];

function isTwilioUrl(url: string): boolean {
  return TWILIO_URL_PATTERNS.some(p => p.test(url));
}

@Injectable()
export class TwilioKillSwitchInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (TWILIO_HALTED && isTwilioUrl(req.url)) {
      // Silently halt — no network call, no retry, no error to caller.
      // Log once for auditability; callers still complete cleanly.
      // eslint-disable-next-line no-console
      console.warn('[TwilioKillSwitch] Blocked', req.method, req.url);
      return of(new HttpResponse({
        status: 200,
        statusText: 'Halted (Twilio kill switch)',
        url: req.url,
        body: { halted: true, reason: 'twilio_kill_switch' },
      }) as HttpEvent<unknown>);
    }
    return next.handle(req);
  }
}
