import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { LiveActivityService } from '../../../services/live-activity.service';
import { LiveActivityItem, ActivityEventType } from '../../../models/live-activity.model';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-live-activity-panel',
  templateUrl: './live-activity-panel.component.html',
  styleUrls: ['./live-activity-panel.component.scss'],
  standalone: false,
})
export class LiveActivityPanelComponent implements OnInit, OnDestroy {
  items: LiveActivityItem[] = [];
  drawerOpen = false;
  hidden = false;
  private sub: Subscription;
  private routeSub: Subscription;
  private toggleSub: Subscription;

  private colorMap: Record<ActivityEventType, string> = {
    fire_incident: '#FF6B35',
    storm_alert: '#60a5fa',
    hail_alert: '#a78bfa',
    wind_alert: '#60a5fa',
    lightning_alert: '#fbbf24',
    hurricane_alert: '#f87171',
    lead_assigned: '#fbbf24',
    lead_escalated: '#F59E0B',
    agent_accepted: '#10B981',
    client_signed: '#10B981',
    notification_sent: '#93c5fd',
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

  private hiddenRoutes = [
    '/app/communications-hub',
    '/app/storm-intelligence',
  ];

  ngOnInit() {
    this.sub = this.liveActivity.activities$.subscribe(items => {
      this.items = items.slice(0, 25);
    });
    this.liveActivity.startPolling(30000);
    this.hidden = this.hiddenRoutes.some(r => this.router.url.includes(r));
    this.routeSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        this.hidden = this.hiddenRoutes.some(r => e.urlAfterRedirects.includes(r));
        // Close drawer on navigation
        this.drawerOpen = false;
      });
    this.toggleSub = this.liveActivity.drawerToggle$.subscribe(() => {
      this.toggleDrawer();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.toggleSub?.unsubscribe();
  }

  toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
  }

  getIconColor(eventType: ActivityEventType): string {
    return this.colorMap[eventType] || '#94a3b8';
  }

  getTimeAgo(date: Date): string {
    const mins = Math.round((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  onClick(item: LiveActivityItem) {
    if (item.route) {
      this.router.navigate([item.route]);
      this.drawerOpen = false;
    }
  }
}
