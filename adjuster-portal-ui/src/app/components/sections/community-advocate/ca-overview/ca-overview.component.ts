import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { AdvocacyKpiSummary, AdvocateProfile, AdvocacyChartData, CaRole } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-overview',
  templateUrl: './ca-overview.component.html',
  styleUrls: ['./ca-overview.component.scss'],
  standalone: false,
})
export class CaOverviewComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  @Output() navigateToTab = new EventEmitter<number>();

  kpiSummary: AdvocacyKpiSummary;
  advocates: AdvocateProfile[] = [];
  referralTrendData: { name: string; series: { name: string; value: number }[] }[] = [];
  topAdvocates: AdvocateProfile[] = [];

  // Chart config
  chartView: [number, number] = [700, 280];
  colorScheme = { domain: ['#1a237e', '#3949ab', '#5c6bc0', '#7986cb', '#9fa8da', '#c5cae9'] };
  xAxisLabel = 'Month';
  yAxisLabel = 'Referrals';

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

    const advSub = this.caService.getAdvocates().subscribe(data => {
      this.advocates = data;
      this.topAdvocates = [...data]
        .filter(a => a.status === 'active')
        .sort((a, b) => b.metrics.referrals_generated - a.metrics.referrals_generated)
        .slice(0, 5);
    });
    this.subs.push(advSub);
  }

  goToTab(index: number): void {
    this.navigateToTab.emit(index);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
