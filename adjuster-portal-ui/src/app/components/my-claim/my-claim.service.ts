import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, catchError, tap } from 'rxjs';
import {
  ClientClaim, ClaimDocument, ClaimPayment, MessageThread,
  ClaimReport, ClaimNotification, CLAIM_STAGES,
} from 'src/app/models/client-portal.model';

export interface ClientProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

@Injectable({ providedIn: 'root' })
export class MyClaimService {
  private profile$ = new BehaviorSubject<ClientProfile | null>(null);
  private claim$ = new BehaviorSubject<ClientClaim | null>(null);
  private documents$ = new BehaviorSubject<ClaimDocument[]>([]);
  private payments$ = new BehaviorSubject<ClaimPayment[]>([]);
  private threads$ = new BehaviorSubject<MessageThread[]>([]);
  private reports$ = new BehaviorSubject<ClaimReport[]>([]);
  private notifications$ = new BehaviorSubject<ClaimNotification[]>([]);

  constructor(private http: HttpClient) {}

  getProfile(): Observable<ClientProfile | null> { return this.profile$.asObservable(); }
  getClaim(): Observable<ClientClaim | null> { return this.claim$.asObservable(); }
  getDocuments(): Observable<ClaimDocument[]> { return this.documents$.asObservable(); }
  getPayments(): Observable<ClaimPayment[]> { return this.payments$.asObservable(); }
  getThreads(): Observable<MessageThread[]> { return this.threads$.asObservable(); }
  getReports(): Observable<ClaimReport[]> { return this.reports$.asObservable(); }
  getNotifications(): Observable<ClaimNotification[]> { return this.notifications$.asObservable(); }

  isLoggedIn(): boolean { return this.profile$.value !== null; }

  /**
   * Client login. Attempts the real API first; falls back to mock data
   * so the portal is always usable during development.
   * In production this calls POST /auth/client-login which returns the
   * client profile and their linked claim_id.
   */
  clientLogin(email: string, password: string): Observable<boolean> {
    const payload = { email: email.includes('@') ? email : undefined, claim_number: !email.includes('@') ? email : undefined, password };

    return new Observable(obs => {
      this.http.post<any>('client-portal/login', payload).pipe(
        catchError(() => {
          // API not available — use mock data for development
          return of(null);
        }),
      ).subscribe(apiResult => {
        if (apiResult?.profile) {
          this.profile$.next(apiResult.profile);
          this.loadClaimFromApi(apiResult.profile.id);
        } else {
          // Fallback: mock profile + mock claim data
          this.profile$.next({
            id: 'CP-001', firstName: 'James', lastName: 'Henderson',
            email: email.includes('@') ? email : 'james.henderson@email.com',
            phone: '(407) 555-0199',
          });
          this.loadMockClaimData();
        }
        obs.next(true);
        obs.complete();
      });
    });
  }

  /**
   * Load the client's claim data from the backend API.
   * The API returns only the claim linked to this client's portal account.
   */
  private loadClaimFromApi(clientId: string): void {
    this.http.get<any>(`client-portal/claims/${clientId}`).pipe(
      catchError(() => {
        // API not available — fall back to mock data
        this.loadMockClaimData();
        return of(null);
      }),
    ).subscribe(data => {
      if (!data) return;
      if (data.claim) this.claim$.next(data.claim);
      if (data.documents) this.documents$.next(data.documents);
      if (data.payments) this.payments$.next(data.payments);
      if (data.threads) this.threads$.next(data.threads);
      if (data.reports) this.reports$.next(data.reports);
      if (data.notifications) this.notifications$.next(data.notifications);
    });
  }

  clientLogout(): void {
    this.profile$.next(null);
    this.claim$.next(null);
    this.documents$.next([]);
    this.payments$.next([]);
    this.threads$.next([]);
    this.reports$.next([]);
    this.notifications$.next([]);
  }

  markNotificationRead(id: string): void {
    const list = this.notifications$.value.map(n => n.id === id ? { ...n, read: true } : n);
    this.notifications$.next(list);
  }

  markAllNotificationsRead(): void {
    this.notifications$.next(this.notifications$.value.map(n => ({ ...n, read: true })));
  }

  sendMessage(threadId: string, body: string): void {
    const threads = this.threads$.value.map(t => {
      if (t.id !== threadId) return t;
      return { ...t, messages: [...t.messages, {
        id: 'msg-' + Date.now(), senderName: 'You', senderRole: 'client' as const,
        body, timestamp: new Date().toISOString(),
      }], lastMessageAt: new Date().toISOString() };
    });
    this.threads$.next(threads);
  }

  addDocument(doc: ClaimDocument): void {
    this.documents$.next([doc, ...this.documents$.value]);
  }

  private loadMockClaimData(): void {
    this.claim$.next({
      id: '1', claimNumber: 'CLM-2024-00847', status: 'In Review',
      type: 'Residential – Wind Damage', dateOfLoss: '2024-09-14', dateOpened: '2024-09-16',
      adjusterName: 'Marcus Rivera', adjusterPhone: '(407) 555-0188', adjusterEmail: 'mrivera@upagroup.com',
      description: 'Wind damage to roof shingles, soffit, and fascia from tropical storm. Partial interior water intrusion in master bedroom and hallway.',
      propertyAddress: '4218 Magnolia Blvd', city: 'Orlando', state: 'FL', zip: '32806',
      estimatedValue: 28750, currentPhase: 'Carrier Review', currentStage: 'carrier_review',
      timeline: [
        { date: '2024-09-16', label: 'Claim Reported', description: 'Claim filed by homeowner via online intake.', icon: 'flag', completed: true },
        { date: '2024-09-18', label: 'Adjuster Assigned', description: 'Assigned to adjuster Marcus Rivera.', icon: 'person_add', completed: true },
        { date: '2024-09-22', label: 'Inspection Scheduled', description: 'On-site inspection completed. 42 photos documented.', icon: 'event_available', completed: true },
        { date: '2024-10-01', label: 'Estimate Submitted', description: 'Repair estimate submitted to carrier — $28,750.', icon: 'calculate', completed: true },
        { date: '2024-10-10', label: 'Carrier Review', description: 'Estimate under carrier review. Expected response within 15 business days.', icon: 'rate_review', completed: false },
        { date: '', label: 'Negotiation', description: 'Pending — adjuster will negotiate with carrier if needed.', icon: 'handshake', completed: false },
        { date: '', label: 'Payment Issued', description: 'Pending settlement approval and payment.', icon: 'payments', completed: false },
        { date: '', label: 'Claim Closed', description: 'Claim will be closed after final payment.', icon: 'check_circle', completed: false },
      ],
    });

    this.documents$.next([
      { id: '1', name: 'Policy Declaration Page', type: 'PDF', uploadedAt: '2024-09-16', size: '245 KB', url: '#', category: 'policy', uploadedBy: 'client' },
      { id: '2', name: 'Initial Repair Estimate', type: 'PDF', uploadedAt: '2024-10-01', size: '1.2 MB', url: '#', category: 'estimate', uploadedBy: 'adjuster' },
      { id: '3', name: 'Roof Damage — Front Elevation', type: 'JPG', uploadedAt: '2024-09-22', size: '3.4 MB', url: '#', category: 'photo', uploadedBy: 'adjuster' },
      { id: '4', name: 'Roof Damage — Rear Elevation', type: 'JPG', uploadedAt: '2024-09-22', size: '2.9 MB', url: '#', category: 'photo', uploadedBy: 'adjuster' },
      { id: '5', name: 'Interior Water Damage — Master Bedroom', type: 'JPG', uploadedAt: '2024-09-22', size: '2.1 MB', url: '#', category: 'photo', uploadedBy: 'client' },
      { id: '6', name: 'Supplement Request Letter', type: 'PDF', uploadedAt: '2024-10-08', size: '98 KB', url: '#', category: 'supplement', uploadedBy: 'adjuster' },
    ]);

    this.payments$.next([
      { id: '1', date: '2024-09-20', amount: 5000, description: 'Emergency Mitigation Advance', status: 'processed', method: 'Direct Deposit', referenceNumber: 'PAY-2024-1101', payerName: 'State Farm' },
      { id: '2', date: '2024-10-05', amount: 12500, description: 'Partial Roof Repair — First Draw', status: 'processed', method: 'Check', referenceNumber: 'PAY-2024-1234', payerName: 'State Farm' },
      { id: '3', date: '2024-10-12', amount: 8750, description: 'Interior Restoration — Second Draw', status: 'pending', method: 'Direct Deposit', referenceNumber: 'PAY-2024-1340', payerName: 'State Farm' },
    ]);

    this.threads$.next([
      {
        id: '1', subject: 'Inspection Follow-Up', lastMessageAt: '2024-10-09T14:32:00', unread: true,
        messages: [
          { id: '1', senderName: 'Marcus Rivera', senderRole: 'adjuster', body: 'Hi James, I completed the on-site inspection on 9/22. I wanted to follow up with some findings and next steps for your claim.', timestamp: '2024-09-23T09:15:00' },
          { id: '2', senderName: 'You', senderRole: 'client', body: 'Thank you Marcus. I noticed additional damage in the hallway ceiling after the heavy rain last week. Should I document it?', timestamp: '2024-10-01T11:20:00' },
          { id: '3', senderName: 'Marcus Rivera', senderRole: 'adjuster', body: 'Absolutely — please take photos and upload them. I\'ll include it in the supplement request to the carrier.', timestamp: '2024-10-09T14:32:00' },
        ],
      },
      {
        id: '2', subject: 'Payment Notification', lastMessageAt: '2024-10-05T08:00:00', unread: false,
        messages: [
          { id: '4', senderName: 'System', senderRole: 'system', body: 'A payment of $12,500.00 for "Partial Roof Repair" has been issued via check. Reference: PAY-2024-1234.', timestamp: '2024-10-05T08:00:00' },
        ],
      },
    ]);

    this.reports$.next([
      { id: '1', name: 'Initial Claim Report', type: 'claim_report', generatedAt: '2024-09-23', size: '2.4 MB', url: '#' },
      { id: '2', name: 'Inspection Report', type: 'inspection_report', generatedAt: '2024-09-24', size: '5.1 MB', url: '#' },
      { id: '3', name: 'Repair Estimate Report', type: 'estimate_report', generatedAt: '2024-10-01', size: '1.8 MB', url: '#' },
      { id: '4', name: 'Supplement Report', type: 'supplement_report', generatedAt: '2024-10-08', size: '1.2 MB', url: '#' },
    ]);

    this.notifications$.next([
      { id: '1', title: 'Claim Status Updated', message: 'Your claim has moved to Carrier Review.', type: 'status_change', timestamp: '2024-10-10T10:00:00', read: false, icon: 'update', relatedStage: 'carrier_review' },
      { id: '2', title: 'New Message', message: 'Marcus Rivera sent you a message about the carrier review process.', type: 'message', timestamp: '2024-10-10T10:05:00', read: false, icon: 'chat', relatedStage: null },
      { id: '3', title: 'Payment Issued', message: '$12,500 for roof repair has been issued via check.', type: 'payment', timestamp: '2024-10-05T08:00:00', read: true, icon: 'payments', relatedStage: 'payment_issued' },
      { id: '4', title: 'Estimate Submitted', message: 'Your repair estimate of $28,750 has been submitted to the carrier.', type: 'status_change', timestamp: '2024-10-01T14:00:00', read: true, icon: 'send', relatedStage: 'estimate_submitted' },
      { id: '5', title: 'Inspection Completed', message: 'On-site inspection completed. 42 photos documented.', type: 'status_change', timestamp: '2024-09-22T16:30:00', read: true, icon: 'check_circle', relatedStage: 'inspection_scheduled' },
    ]);
  }
}
