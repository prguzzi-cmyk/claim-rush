import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Subscription, interval } from 'rxjs';
import { AppNotification, UnreadCountResponse } from '../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class InAppNotificationService implements OnDestroy {
  unreadCount$ = new BehaviorSubject<number>(0);
  private pollSub: Subscription | null = null;

  constructor(private http: HttpClient) {}

  getNotifications(unreadOnly = false, skip = 0, limit = 20) {
    let params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString());
    if (unreadOnly) {
      params = params.set('unread_only', 'true');
    }
    return this.http.get<AppNotification[]>('notifications', { params });
  }

  getUnreadCount() {
    return this.http.get<UnreadCountResponse>('notifications/unread-count');
  }

  markAsRead(notificationId: string) {
    return this.http.patch<AppNotification>(`notifications/${notificationId}/read`, {});
  }

  markAllAsRead() {
    return this.http.patch<any>('notifications/read-all', {});
  }

  startPolling(intervalMs = 30000) {
    this.refreshUnreadCount();
    this.pollSub = interval(intervalMs).subscribe(() => {
      this.refreshUnreadCount();
    });
  }

  stopPolling() {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = null;
    }
  }

  refreshUnreadCount() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    this.getUnreadCount().subscribe({
      next: (res) => this.unreadCount$.next(res.unread_count),
      error: (err) => console.warn('Notification poll failed:', err.status, err.message),
    });
  }

  ngOnDestroy() {
    this.stopPolling();
  }
}
