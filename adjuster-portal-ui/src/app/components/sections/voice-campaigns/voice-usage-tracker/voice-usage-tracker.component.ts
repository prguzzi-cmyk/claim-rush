import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { VoiceCampaignService } from 'src/app/services/voice-campaign.service';
import {
  VoiceCampaign,
  VoiceCampaignAnalytics,
  VoiceUsageSummary,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
} from 'src/app/models/voice-campaign.model';

@Component({
  selector: 'app-voice-usage-tracker',
  templateUrl: './voice-usage-tracker.component.html',
  styleUrls: ['./voice-usage-tracker.component.scss'],
  standalone: false,
})
export class VoiceUsageTrackerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  loading = true;
  loadError = false;

  // Campaign filter
  campaigns: VoiceCampaign[] = [];
  selectedCampaignId = '';
  selectedCampaignName = '';

  usage: VoiceUsageSummary = {
    minutes_used: 0,
    plan_limit_minutes: 500,
    percent_used: 0,
    call_count: 0,
    overage_minutes: 0,
  };

  analytics: VoiceCampaignAnalytics = {
    total_calls: 0,
    calls_answered: 0,
    conversion_rate: 0,
    avg_duration_seconds: 0,
    outcome_breakdown: {},
    daily_trend: [],
  };

  outcomeEntries: Array<{ key: string; label: string; count: number; color: string; percent: number }> = [];

  constructor(
    private route: ActivatedRoute,
    private campaignService: VoiceCampaignService,
  ) {}

  ngOnInit(): void {
    this.loadCampaigns();

    // Check for campaignId query param (from dashboard "View Analytics" button)
    const campaignId = this.route.snapshot.queryParamMap.get('campaignId');
    if (campaignId) {
      this.selectedCampaignId = campaignId;
    }

    this.loadData();
  }

  private loadCampaigns(): void {
    this.campaignService.list().pipe(takeUntil(this.destroy$)).subscribe(campaigns => {
      this.campaigns = campaigns;
      if (this.selectedCampaignId) {
        const found = campaigns.find(c => c.id === this.selectedCampaignId);
        this.selectedCampaignName = found?.name || '';
      }
    });
  }

  onCampaignChange(): void {
    const found = this.campaigns.find(c => c.id === this.selectedCampaignId);
    this.selectedCampaignName = found?.name || '';
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.loadError = false;

    this.campaignService.getUsage().pipe(takeUntil(this.destroy$)).subscribe({
      next: (usage) => { this.usage = usage; },
      error: () => {},
    });

    const campaignId = this.selectedCampaignId || undefined;
    this.campaignService.getAnalytics(campaignId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (analytics) => {
        this.analytics = analytics;
        this.buildOutcomeEntries();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  private buildOutcomeEntries(): void {
    const breakdown = this.analytics.outcome_breakdown;
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0) || 1;
    this.outcomeEntries = Object.entries(breakdown).map(([key, count]) => ({
      key,
      label: OUTCOME_LABELS[key] || key,
      count,
      color: OUTCOME_COLORS[key] || '#9e9e9e',
      percent: Math.round(count / total * 100),
    })).sort((a, b) => b.count - a.count);
  }

  getUsageBarColor(): string {
    if (this.usage.percent_used >= 90) return '#f44336';
    if (this.usage.percent_used >= 70) return '#ff9800';
    return '#4caf50';
  }

  getUsageStatus(): 'danger' | 'warning' | 'safe' {
    if (this.usage.percent_used >= 90) return 'danger';
    if (this.usage.percent_used >= 70) return 'warning';
    return 'safe';
  }

  getUsageStatusLabel(): string {
    if (this.usage.overage_minutes > 0) return 'Over Limit';
    if (this.usage.percent_used >= 90) return 'Approaching Limit';
    if (this.usage.percent_used >= 70) return 'High Usage';
    return 'On Track';
  }

  getBurnRateForecast(): string | null {
    if (this.usage.minutes_used <= 0 || this.usage.percent_used >= 100) return null;
    const trend = this.analytics.daily_trend;
    if (!trend || trend.length < 2) return null;
    // Calculate average daily minutes based on total usage and trend days
    const days = trend.length;
    const dailyRate = this.usage.minutes_used / days;
    if (dailyRate <= 0) return null;
    const remaining = this.usage.plan_limit_minutes - this.usage.minutes_used;
    const daysLeft = Math.round(remaining / dailyRate);
    if (daysLeft > 90) return null;
    if (daysLeft <= 0) return 'You may exceed your limit today';
    return `At this rate, you'll reach your limit in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
  }

  getAnswerRate(): number {
    if (this.analytics.total_calls === 0) return 0;
    return Math.round(this.analytics.calls_answered / this.analytics.total_calls * 100);
  }

  getTrendBarHeight(count: number): number {
    if (!this.analytics.daily_trend.length) return 0;
    if (count === 0) return 0;
    const max = Math.max(...this.analytics.daily_trend.map(d => d.calls), 1);
    return Math.max(5, Math.round((count / max) * 100));
  }

  formatTrendDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
