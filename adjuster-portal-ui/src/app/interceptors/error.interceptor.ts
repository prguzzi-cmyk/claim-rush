import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor(private snackBar: MatSnackBar,private router: Router) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // intake-config handles ALL errors locally — pass raw HttpErrorResponse through
        if (request.url.includes('intake-config/') || request.url.endsWith('intake-config')) {
          console.warn('[ErrorInterceptor] intake-config error passed through:', error.status, error.error?.detail || '');
          return throwError(() => error);
        }

        let errorMessage = '';

        if (error.error instanceof ErrorEvent) {
          // Client-side error
          errorMessage = `Client-side error: ${error.error.message}`;
        } else {
          // Server-side error
          if (error.status === 422) {
            // Suppress 422 for dashboard background endpoints
            const dashUrls = ['dashboard/', 'fire-incidents', 'voice-campaigns/', 'claim-recovery/', 'platform-activity/'];
            if (dashUrls.some(u => request.url.includes(u))) {
              console.warn('[ErrorInterceptor] 422 suppressed (dashboard):', request.method, request.url, error.error?.detail);
              return throwError(() => error);
            }
            // Handling 422 validation errors
            if (error.error && Array.isArray(error.error.detail)) {
              errorMessage = error.status + ' ' + error.statusText + ' : ' + error.error.detail
                .map((detail: { loc: string[]; msg: string }) => {
                  // Create a readable path from the 'loc' array
                  const locationPath = detail.loc.join(' -> ');
                  return `${locationPath}: ${detail.msg}`;
                })
                .join(', '); // Combine all error messages into one string

            } else {
              errorMessage = 'Validation error occurred';
            }
          } else if (error.status === 429) {
            errorMessage = error.error?.detail || 'Too many requests. Please slow down.';
          } else if (error.status === 401) {
            errorMessage = `${error.statusText}` + ' : ' + error.error.detail;
          } else if (error.status === 403) {
            // Suppress 403 for pages that handle permission errors locally
            const suppress403Urls = ['storm-events', 'potential-claims', 'incident-intelligence'];
            if (suppress403Urls.some(u => request.url.includes(u))) {
              console.warn('[ErrorInterceptor] 403 suppressed:', request.method, request.url);
              return throwError(() => error);
            }
            errorMessage = `${error.statusText}` + ' : ' + error.error?.detail;
            if (error.error?.detail === 'Could not validate credentials.') {
              this.router.navigate(['login']);
            }
          } else if (error.status === 404) {
            // Suppress snackbar for endpoints with local error handling (background data-loading)
            if (request.url.includes('community-advocate/') ||
                request.url.includes('policy-documents/by-entity')) {
              return throwError(() => error);
            }
            errorMessage = `${error.statusText}` + ' : ' + (error.error?.detail || 'Not Found');
          } else if (error.status === 409) {
            // Suppress 409 for background data-loading endpoints that handle errors locally
            const suppress409Urls = ['crime-incidents', 'crime-data-sources', 'potential-claims',
              'storm-events', 'fire-incidents', 'roof-analysis', 'dashboard/', 'leads'];
            if (suppress409Urls.some(u => request.url.includes(u))) {
              console.warn('[ErrorInterceptor] 409 suppressed:', request.method, request.url, error.error?.detail);
              return throwError(() => error);
            }
            errorMessage = `${error.statusText}` + ' : ' + (error.error?.detail || 'Conflict');
          } else if (error.status === 500) {
            // Suppress snackbar for background requests that handle errors locally
            const suppressUrls = [
              'policy-documents/by-entity',
              'policy-documents/list',
              'policy-documents/from-claim-file',
              '/attach',
              // Dashboard data-loading endpoints handle errors via catchError in component
              'dashboard/',
              'claim-recovery/',
              'fire-incidents',
              'platform-activity/',
              'voice-campaigns/',
              'agent-performance',
              'communication-metrics',
              'lead-outcome-breakdown',
              'agent-outcome-breakdown',
              'newsletters',
              'announcements',
              // Roof Intel handles errors with demo data fallback
              'roof-analysis',
              // Potential Claims used by Storm Intel + Roof Intel with local catchError
              'potential-claims',
              // AI Intake handles all errors locally with fallback sessions
              'ai-intake/',
              'intake-config/',
            ];
            const isClaimFileUpload = request.method === 'POST' && /claims\/[^/]+\/files$/.test(request.url);

            // Suppress transient DB session errors (SQLAlchemy concurrency) —
            // these are retryable and the claim page handles them locally.
            const detail500 = error.error?.detail || '';
            const isTransientDbError = detail500.includes('issue getting a claim entity')
              || detail500.includes('session is provisioning');

            const isSuppressed = suppressUrls.some(u => request.url.includes(u)) || isClaimFileUpload || isTransientDbError;
            if (isSuppressed) {
              console.warn('[ErrorInterceptor] 500 suppressed:', request.method, request.url, detail500 || '(no detail)');
              return throwError(() => error);
            }
            const detail = detail500;
            errorMessage = detail ? `Server Error: ${detail}` : 'Internal Server Error';
            console.error('[ErrorInterceptor] 500 on', request.method, request.url, error.error);
          } else if (error.status === 503) {
            const detail = error.error?.detail;
            errorMessage = detail || 'Service temporarily unavailable';
            console.warn('[ErrorInterceptor] 503 on', request.method, request.url);
          } else if (error.status === 0) {
            errorMessage = 'Network error — check your connection';
            console.warn('[ErrorInterceptor] Network error on', request.method, request.url);
          } else {
            errorMessage = `${error.statusText}: ${error.message}`;
          }
        }

        console.log(error);

        // Display error message using MatSnackBar
        this.snackBar.open(errorMessage, 'Close', {
          duration: 10000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
          panelClass: ['snackbar-error'],
        });

        return throwError(() => new Error(errorMessage));
      })
    );
  }
}
