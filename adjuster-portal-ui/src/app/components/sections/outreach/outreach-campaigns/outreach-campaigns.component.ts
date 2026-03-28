import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OutreachService } from 'src/app/services/outreach.service';
import {
  OutreachCampaign,
  CampaignDashboardMetrics,
  CAMPAIGN_STATUS_OPTIONS,
} from 'src/app/models/outreach.model';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-outreach-campaigns',
  templateUrl: './outreach-campaigns.component.html',
  styleUrls: ['./outreach-campaigns.component.scss'],
  standalone: false,
})
export class OutreachCampaignsComponent implements OnInit {
  campaigns: OutreachCampaign[] = [];
  metrics: CampaignDashboardMetrics | null = null;
  statusOptions = CAMPAIGN_STATUS_OPTIONS;

  displayedColumns: string[] = [
    'sn', 'name', 'campaign_type', 'status', 'incident_type', 'target_zip_code',
    'total_targeted', 'total_sent', 'total_responded', 'actions',
  ];
  dataSource: MatTableDataSource<OutreachCampaign> = new MatTableDataSource([]);

  constructor(
    private outreachService: OutreachService,
    private spinner: NgxSpinnerService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadCampaigns();
    this.loadMetrics();
  }

  loadCampaigns() {
    this.spinner.show();
    this.outreachService.getCampaigns().subscribe((data) => {
      this.campaigns = data;
      this.dataSource = new MatTableDataSource(data);
      this.spinner.hide();
    });
  }

  loadMetrics() {
    this.outreachService.getDashboardMetrics().subscribe((data) => {
      this.metrics = data;
    });
  }

  getStatusColor(status: string): string {
    const found = this.statusOptions.find((s) => s.value === status);
    return found ? found.color : '#9e9e9e';
  }

  getStatusLabel(status: string): string {
    const found = this.statusOptions.find((s) => s.value === status);
    return found ? found.label : status;
  }

  getCampaignTypeLabel(type: string): string {
    const map: Record<string, string> = {
      ai_voice: 'AI Voice',
      sms: 'SMS',
      email: 'Email',
      multi_step: 'Multi-Step',
    };
    return map[type] || type;
  }

  openBuilder() {
    this.router.navigate(['/app/outreach/campaigns/builder']);
  }

  editCampaign(campaign: OutreachCampaign) {
    this.router.navigate(['/app/outreach/campaigns/builder', campaign.id]);
  }

  launchCampaign(campaign: OutreachCampaign) {
    if (confirm(`Launch campaign "${campaign.name}"? This will begin outreach to targeted leads.`)) {
      this.spinner.show();
      this.outreachService.launchCampaign(campaign.id).subscribe(() => {
        this.loadCampaigns();
        this.loadMetrics();
      });
    }
  }

  pauseCampaign(campaign: OutreachCampaign) {
    this.spinner.show();
    this.outreachService.pauseCampaign(campaign.id).subscribe(() => {
      this.loadCampaigns();
      this.loadMetrics();
    });
  }

  deleteCampaign(id: string) {
    if (confirm('Delete this campaign?')) {
      this.outreachService.deleteCampaign(id).subscribe(() => this.loadCampaigns());
    }
  }
}
