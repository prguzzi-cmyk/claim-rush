import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { AdvocacyKpiSummary, ChannelPerformance, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-analytics',
  templateUrl: './ca-analytics.component.html',
  styleUrls: ['./ca-analytics.component.scss'],
  standalone: false,
})
export class CaAnalyticsComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  kpiSummary: AdvocacyKpiSummary;
  channelPerformance: ChannelPerformance[] = [];
  channelColumns = ['channel', 'sent', 'delivered', 'opened', 'clicked', 'converted', 'conversion_rate'];

  referralTrendData: { name: string; series: { name: string; value: number }[] }[] = [];
  funnelData: { name: string; value: number }[] = [];

  chartView: [number, number] = [700, 280];
  funnelView: [number, number] = [500, 280];
  colorScheme = { domain: ['#1a237e', '#3949ab', '#5c6bc0', '#7986cb'] };

  dateRange = 'last_6_months';

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    const kpiSub = this.caService.getKpiSummary().subscribe(data => {
      this.kpiSummary = data;
      this.referralTrendData = [
        { name: 'Referrals', series: data.referral_trend.map(d => ({ name: d.name, value: d.value })) }
      ];
    });
    this.subs.push(kpiSub);

    const chSub = this.caService.getChannelPerformance().subscribe(data => {
      this.channelPerformance = data;
      const totals = data.reduce((acc, ch) => {
        acc.sent += ch.sent;
        acc.delivered += ch.delivered;
        acc.opened += ch.opened;
        acc.clicked += ch.clicked;
        acc.converted += ch.converted;
        return acc;
      }, { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 });

      this.funnelData = [
        { name: 'Sent', value: totals.sent },
        { name: 'Delivered', value: totals.delivered },
        { name: 'Opened', value: totals.opened },
        { name: 'Clicked', value: totals.clicked },
        { name: 'Converted', value: totals.converted },
      ];
    });
    this.subs.push(chSub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
