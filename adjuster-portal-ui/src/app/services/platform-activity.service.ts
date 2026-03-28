import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, Subscription, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

export interface PlatformActivityEvent {
  id: string;
  event_type: string;
  icon: string;
  color: string;
  title: string;
  detail: string;
  location?: string;
  assigned_agent?: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class PlatformActivityService {

  private events$ = new BehaviorSubject<PlatformActivityEvent[]>([]);
  private pollSub: Subscription | null = null;

  constructor(private http: HttpClient) {}

  getEvents(): Observable<PlatformActivityEvent[]> { return this.events$.asObservable(); }
  getSnapshot(): PlatformActivityEvent[] { return this.events$.value; }

  startPolling(intervalMs = 30000): void {
    this.stopPolling();
    this.refresh();
    this.pollSub = interval(intervalMs).subscribe(() => this.refresh());
  }

  stopPolling(): void { this.pollSub?.unsubscribe(); this.pollSub = null; }

  refresh(): void {
    this.http.get<PlatformActivityEvent[]>('platform-activity/recent').pipe(
      timeout(10000),
      catchError(() => {
        // Network unavailable — return empty rather than mock.
        // The LiveActivityService handles the consolidated fallback.
        return of([]);
      })
    ).subscribe(events => {
      const list = Array.isArray(events) ? events : (events as any)?.items || [];
      this.events$.next(list.slice(0, 50));
    });
  }
}
