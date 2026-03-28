import { Component, OnInit } from '@angular/core';
import { OutreachService } from 'src/app/services/outreach.service';
import { OutreachMetrics, OutreachAttempt, OutreachCampaign } from 'src/app/models/outreach.model';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-outreach-dashboard',
  templateUrl: './outreach-dashboard.component.html',
  styleUrls: ['./outreach-dashboard.component.scss'],
  standalone: false,
})
export class OutreachDashboardComponent implements OnInit {
  metrics: OutreachMetrics = new OutreachMetrics();
  campaigns: OutreachCampaign[] = [];
  selectedCampaignId: string = '';

  displayedColumns: string[] = [
    'sn', 'channel', 'status', 'attempt_number', 'recipient_phone', 'recipient_email', 'created_at',
  ];
  dataSource: MatTableDataSource<OutreachAttempt> = new MatTableDataSource([]);

  constructor(
    private outreachService: OutreachService,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit() {
    this.loadCampaigns();
    this.loadMetrics();
    this.loadAttempts();
  }

  loadCampaigns() {
    this.outreachService.getCampaigns().subscribe((campaigns) => {
      this.campaigns = campaigns;
    });
  }

  loadMetrics() {
    this.spinner.show();
    const campaignId = this.selectedCampaignId || undefined;
    this.outreachService.getMetrics(campaignId).subscribe((metrics) => {
      this.metrics = metrics;
      this.spinner.hide();
    });
  }

  loadAttempts() {
    const params: any = {};
    if (this.selectedCampaignId) {
      params.campaign_id = this.selectedCampaignId;
    }
    this.outreachService.getAttempts(params).subscribe((attempts) => {
      this.dataSource = new MatTableDataSource(attempts);
    });
  }

  onFilterChange() {
    this.loadMetrics();
    this.loadAttempts();
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'accent',
      sent: 'primary',
      delivered: 'primary',
      failed: 'warn',
      responded: 'primary',
      appointment_booked: 'primary',
    };
    return colors[status] || '';
  }
}
