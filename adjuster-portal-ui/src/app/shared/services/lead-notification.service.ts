import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface LeadNotification {
  id: string;
  leadId: string;
  sessionId?: string;
  status: 'BOOKED' | 'CALL_BACK_REQUESTED' | 'QUALIFIED';
  leadName: string;
  address: string;
  source: string;
  timestamp: string;
  read: boolean;
  assignedAgent?: string;
  assignedReason?: string;
  autoAssigned?: boolean;
}

const STORAGE_KEY = 'upa_lead_notifications';

@Injectable({ providedIn: 'root' })
export class LeadNotificationService {
  private notifications$ = new BehaviorSubject<LeadNotification[]>([]);
  private seenKeys = new Set<string>();

  constructor(private http: HttpClient) {
    this.loadFromStorage();
  }

  getNotifications(): Observable<LeadNotification[]> {
    return this.notifications$.asObservable();
  }

  get unreadCount(): number {
    return this.notifications$.getValue().filter(n => !n.read).length;
  }

  /**
   * Add a high-priority lead notification. Deduplicates by leadId + status.
   */
  notify(params: {
    leadId: string;
    sessionId?: string;
    status: 'BOOKED' | 'CALL_BACK_REQUESTED' | 'QUALIFIED';
    leadName: string;
    address: string;
    source: string;
  }): void {
    const dedupeKey = `${params.leadId}|${params.status}`;
    if (this.seenKeys.has(dedupeKey)) return;
    this.seenKeys.add(dedupeKey);

    const notification: LeadNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      leadId: params.leadId,
      sessionId: params.sessionId,
      status: params.status,
      leadName: params.leadName,
      address: params.address,
      source: params.source,
      timestamp: new Date().toISOString(),
      read: false,
      autoAssigned: false,
    };

    const current = this.notifications$.getValue();
    const updated = [notification, ...current].slice(0, 50);
    this.notifications$.next(updated);
    this.saveToStorage(updated);

    console.log(`[Notification] High-priority lead: ${params.status} — ${params.leadName} (${params.source})`);

    // Trigger auto-assignment
    this.autoAssign(notification);
  }

  private autoAssign(notification: LeadNotification): void {
    this.http.post<any>('ai-intake/auto-assign', {
      lead_id: notification.leadId,
      status: notification.status,
      session_id: notification.sessionId,
    }).pipe(
      catchError(err => {
        console.warn('[AutoAssign] Failed:', err?.message || err);
        return of({ assigned: false, reason: 'request_failed' });
      }),
    ).subscribe(result => {
      if (result.assigned) {
        notification.assignedAgent = result.agent_name || result.agent_id;
        notification.assignedReason = result.reason;
        notification.autoAssigned = true;

        // Update the notification in the list
        const current = this.notifications$.getValue();
        this.notifications$.next([...current]);
        this.saveToStorage(current);

        console.log(
          `[AutoAssign] Lead ${notification.leadId} → ${result.agent_name} (${result.reason}) territory=${result.territory_name || 'N/A'}`,
        );
      } else {
        console.log(`[AutoAssign] Lead ${notification.leadId} → ${result.reason}`);
      }
    });
  }

  markRead(notificationId: string): void {
    const current = this.notifications$.getValue();
    const target = current.find(n => n.id === notificationId);
    if (target) {
      target.read = true;
      this.notifications$.next([...current]);
      this.saveToStorage(current);
    }
  }

  markAllRead(): void {
    const current = this.notifications$.getValue();
    current.forEach(n => n.read = true);
    this.notifications$.next([...current]);
    this.saveToStorage(current);
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LeadNotification[];
      if (Array.isArray(parsed)) {
        this.notifications$.next(parsed);
        parsed.forEach(n => this.seenKeys.add(`${n.leadId}|${n.status}`));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private saveToStorage(notifications: LeadNotification[]): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications)); } catch {}
  }
}
