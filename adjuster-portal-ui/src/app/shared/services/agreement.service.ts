import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Agreement, AuditEntry, SignRequest, AgreementMetrics,
} from '../models/agreement.model';

/**
 * E-Sign Agreement Service
 *
 * Full agreement lifecycle: generate → upload PDF → send → track → sign → deliver.
 * Supports standard and certified signing modes.
 */
@Injectable({ providedIn: 'root' })
export class AgreementService {

  constructor(private http: HttpClient) {}

  // ── Agreement CRUD ─────────────────────────────────────────────

  generateAgreement(data: Partial<Agreement>): Observable<Agreement> {
    return this.http.post<Agreement>('esign/agreements', data);
  }

  getAgreement(id: string): Observable<Agreement> {
    return this.http.get<Agreement>(`esign/agreements/${id}`);
  }

  listAgreements(params?: { agent_id?: string; status?: string; limit?: number }): Observable<Agreement[]> {
    return this.http.get<Agreement[]>('esign/agreements', { params: params as any });
  }

  updateAgreement(id: string, updates: Partial<Agreement>): Observable<Agreement> {
    return this.http.patch<Agreement>(`esign/agreements/${id}`, updates);
  }

  // ── PDF Upload ─────────────────────────────────────────────────

  uploadAgreementPdf(agreementId: string, pdfUrl: string): Observable<any> {
    return this.http.post(`esign/agreements/${agreementId}/upload-pdf`, null, {
      params: { pdf_url: pdfUrl },
    });
  }

  // ── Send & Track ───────────────────────────────────────────────

  sendAgreement(id: string): Observable<Agreement> {
    return this.http.post<Agreement>(`esign/agreements/${id}/send`, {});
  }

  markViewed(id: string, env: { ip_address?: string; device_type?: string; browser?: string; platform?: string }): Observable<any> {
    return this.http.post(`esign/agreements/${id}/viewed`, null, { params: env as any });
  }

  markStarted(id: string, env: { ip_address?: string; device_type?: string; browser?: string; platform?: string }): Observable<any> {
    return this.http.post(`esign/agreements/${id}/started`, null, { params: env as any });
  }

  // ── Sign ───────────────────────────────────────────────────────

  signAgreement(id: string, signReq: SignRequest): Observable<Agreement> {
    return this.http.post<Agreement>(`esign/agreements/${id}/sign`, signReq);
  }

  // ── Delivery ───────────────────────────────────────────────────

  deliverCopies(id: string): Observable<{ insured: boolean; agent: boolean }> {
    return this.http.post<{ insured: boolean; agent: boolean }>(`esign/agreements/${id}/deliver`, {});
  }

  // ── Reminders ──────────────────────────────────────────────────

  sendReminder(id: string): Observable<any> {
    return this.http.post(`esign/agreements/${id}/remind`, {});
  }

  // ── Audit Trail ────────────────────────────────────────────────

  getAuditTrail(id: string): Observable<AuditEntry[]> {
    return this.http.get<AuditEntry[]>(`esign/agreements/${id}/audit`);
  }

  // ── Metrics ────────────────────────────────────────────────────

  getMetrics(agentId?: string): Observable<AgreementMetrics> {
    const params: any = {};
    if (agentId) params.agent_id = agentId;
    return this.http.get<AgreementMetrics>('esign/agreements/metrics/summary', { params });
  }

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Collect signer environment for audit trail.
   */
  collectSignerEnvironment(): { ip_address: string; device_type: string; browser: string; platform: string } {
    const ua = navigator.userAgent;
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    return {
      ip_address: '', // Populated by backend from request
      device_type: isMobile ? 'mobile' : 'desktop',
      browser: this.detectBrowser(ua),
      platform: navigator.platform || 'unknown',
    };
  }

  private detectBrowser(ua: string): string {
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    return 'Other';
  }
}
