import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { LiveActivityService } from '../../../services/live-activity.service';
import { LiveActivityItem, ActivityEventType } from '../../../models/live-activity.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-command-bar',
  templateUrl: './command-bar.component.html',
  styleUrls: ['./command-bar.component.scss'],
  standalone: false,
})
export class CommandBarComponent implements OnInit, OnDestroy {
  items: LiveActivityItem[] = [];
  private sub: Subscription;

  private colorMap: Record<ActivityEventType, string> = {
    fire_incident: '#FF6B35',
    storm_alert: 'var(--event-wind)',
    hail_alert: 'var(--event-hail)',
    wind_alert: 'var(--event-wind)',
    lightning_alert: 'var(--event-lightning)',
    hurricane_alert: 'var(--event-hurricane)',
    lead_assigned: 'var(--color-gold)',
    lead_escalated: '#F59E0B',
    agent_accepted: '#10B981',
    client_signed: '#10B981',
    notification_sent: 'var(--color-primary-200)',
    system_alert: '#EF4444',
    lead_created: '#00e676',
    skip_trace_completed: '#aa00ff',
    voice_call: '#00e5ff',
    claim_opened: '#2979ff',
  };

  constructor(
    private liveActivity: LiveActivityService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.liveActivity.startPolling(30000);
    this.sub = this.liveActivity.activities$.subscribe(items => {
      this.items = items;
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.liveActivity.stopPolling();
  }

  getIconColor(eventType: ActivityEventType): string {
    return this.colorMap[eventType] || '#ffffff';
  }

  getTimeAgo(date: Date): string {
    const mins = Math.round((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  private stormTypes = new Set<ActivityEventType>([
    'storm_alert', 'hail_alert', 'wind_alert', 'lightning_alert', 'hurricane_alert',
  ]);

  isStormEvent(eventType: ActivityEventType): boolean {
    return this.stormTypes.has(eventType);
  }

  trackById(_index: number, item: LiveActivityItem): string {
    return item.id;
  }

  onClick(item: LiveActivityItem) {
    this.liveActivity.focusOnEvent(item);
    if (item.route) {
      this.router.navigate([item.route]);
    }
  }
}
