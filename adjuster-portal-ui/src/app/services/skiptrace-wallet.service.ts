import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SkiptraceWalletSummary,
  CreditPurchaseResponse,
  SkiptraceTransaction,
  LeadOwnerIntelligence,
} from '../models/skiptrace-wallet.model';

@Injectable({
  providedIn: 'root',
})
export class SkiptraceWalletService {
  private base = 'skip-trace-wallet';

  constructor(private http: HttpClient) {}

  getBalance(): Observable<SkiptraceWalletSummary> {
    return this.http.get<SkiptraceWalletSummary>(`${this.base}/balance`);
  }

  purchaseCredits(packSize: number): Observable<CreditPurchaseResponse> {
    return this.http.post<CreditPurchaseResponse>(`${this.base}/purchase`, { pack_size: packSize });
  }

  getTransactions(): Observable<SkiptraceTransaction[]> {
    return this.http.get<SkiptraceTransaction[]>(`${this.base}/transactions`);
  }

  runSkipTrace(leadId: string): Observable<LeadOwnerIntelligence> {
    return this.http.post<LeadOwnerIntelligence>(`${this.base}/leads/${leadId}/run`, {});
  }

  getOwnerIntelligence(leadId: string): Observable<LeadOwnerIntelligence> {
    return this.http.get<LeadOwnerIntelligence>(`${this.base}/leads/${leadId}/owner-intelligence`);
  }

  getActionCosts(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/action-costs`);
  }
}
