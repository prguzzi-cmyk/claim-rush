import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of, tap, catchError } from 'rxjs';

export interface PortalAccountRequest {
  client_id: string;
  client_name: string;
  client_email: string;
  claim_id?: string;
  claim_number?: string;
  adjuster_name?: string;
}

export interface PortalAccountResponse {
  id: string;
  client_id: string;
  email: string;
  temp_password: string;
  portal_url: string;
  email_sent: boolean;
  created_at: string;
}

/**
 * Handles automatic client portal account creation when adjusters
 * sign new clients. Creates login credentials and sends a secure
 * portal access email to the homeowner.
 *
 * Integrates with all client creation paths:
 * - Direct client creation (ClientDetailsDialog)
 * - Lead → Client conversion (ClientConversionDialog)
 * - Inline creation during claim (ClaimDialog)
 * - Bulk CSV imports
 * - AI Claim Intake
 */
@Injectable({ providedIn: 'root' })
export class ClientPortalAccountService {

  /** Track accounts already created this session to avoid duplicates */
  private createdAccounts = new Set<string>();

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
  ) {}

  /**
   * Automatically creates a client portal account after a client record
   * is created. Skips if no email, or if an account was already created
   * for this client in the current session.
   *
   * Call this from ClientService.addClient() post-creation hook.
   */
  createPortalAccount(client: any, claimContext?: { id?: string; claim_number?: string; adjuster_name?: string }): void {
    const clientId = client?.id;
    const email = client?.email;
    const name = client?.full_name || client?.name || '';

    if (!clientId || !email) return;
    if (this.createdAccounts.has(clientId)) return;

    this.createdAccounts.add(clientId);

    const request: PortalAccountRequest = {
      client_id: clientId,
      client_name: name,
      client_email: email,
      claim_id: claimContext?.id,
      claim_number: claimContext?.claim_number,
      adjuster_name: claimContext?.adjuster_name,
    };

    this.http.post<PortalAccountResponse>('client-portal/accounts', request).pipe(
      tap(response => {
        if (response?.email_sent) {
          this.snackBar.open(
            `Portal access email sent to ${email}`,
            'OK',
            { duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom' },
          );
        }
      }),
      catchError(err => {
        // Fail silently — portal account creation is non-blocking.
        // The adjuster workflow should never be interrupted by this.
        console.warn('Client portal account creation failed:', err?.error?.detail || err.message);
        return of(null);
      }),
    ).subscribe();
  }

  /**
   * Creates a portal account after a lead-to-client conversion.
   * The conversion response typically contains the new client data.
   */
  createPortalAccountFromConversion(conversionResult: any): void {
    const client = conversionResult?.client || conversionResult;
    this.createPortalAccount(client);
  }

  /**
   * Sends a portal access email to an existing client who doesn't
   * have an account yet. Used for manual "Send Portal Access" actions.
   */
  sendPortalInvite(clientId: string, email: string, name: string): Observable<PortalAccountResponse | null> {
    const request: PortalAccountRequest = {
      client_id: clientId,
      client_name: name,
      client_email: email,
    };

    return this.http.post<PortalAccountResponse>('client-portal/accounts', request).pipe(
      tap(response => {
        if (response?.email_sent) {
          this.snackBar.open(`Portal access email sent to ${email}`, 'OK', { duration: 5000 });
        }
      }),
      catchError(err => {
        this.snackBar.open('Failed to send portal invite', 'Retry', { duration: 5000 });
        console.error('Portal invite failed:', err);
        return of(null);
      }),
    );
  }

  /**
   * Generates a temporary password for a client portal account.
   * In production, this would be handled server-side.
   */
  generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Builds the portal access email content.
   * In production, this HTML would be rendered server-side.
   */
  buildPortalEmailContent(name: string, email: string, tempPassword: string, claimNumber?: string): string {
    const portalUrl = `${window.location.origin}/#/client/login`;
    return `
Dear ${name},

Welcome to the UPA Client Claim Portal.

Your adjuster has set up secure access for you to track your insurance claim online.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Portal Login: ${portalUrl}

Email: ${email}
Temporary Password: ${tempPassword}
${claimNumber ? `Claim Number: ${claimNumber}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What you can do in the portal:
• Track your claim status in real time
• View and upload documents and photos
• Message your adjuster directly
• See payment history and estimates
• Download reports

For security, please change your password after your first login.

If you have any questions, your adjuster is available through the portal messaging system.

Best regards,
UPA Group
    `.trim();
  }
}
