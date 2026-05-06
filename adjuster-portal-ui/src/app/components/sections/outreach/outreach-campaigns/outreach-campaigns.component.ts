import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { OutreachService } from 'src/app/services/outreach.service';
import {
  OutreachCampaign,
  CampaignDashboardMetrics,
  CAMPAIGN_STATUS_OPTIONS,
} from 'src/app/models/outreach.model';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { CreateCampaignFromLeadsDialogComponent } from '../create-campaign-from-leads-dialog/create-campaign-from-leads-dialog.component';

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
    'name', 'lead_count', 'status', 'created_at', 'actions',
  ];
  dataSource: MatTableDataSource<OutreachCampaign> = new MatTableDataSource([]);

  constructor(
    private outreachService: OutreachService,
    private spinner: NgxSpinnerService,
    private router: Router,
    private dialog: MatDialog,
  ) {}

  openCreateFromLeads() {
    const ref = this.dialog.open(CreateCampaignFromLeadsDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      panelClass: 'create-campaign-dialog',
      autoFocus: false,
    });
    ref.afterClosed().subscribe((result?: { created?: boolean }) => {
      if (result?.created) {
        this.loadCampaigns();
        this.loadMetrics();
      }
    });
  }

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
    // V1: temporary — flip the campaign state to active. No real send logic yet
    // (Celery dispatch via the backend's /launch endpoint is intentionally
    // bypassed). We use the plain update endpoint so no outreach is triggered.
    if (!confirm(`Mark campaign "${campaign.name}" as active? (No outreach will be sent in V1.)`)) {
      return;
    }
    console.log('[CampaignManager] Launch clicked — flipping status→active for', {
      id: campaign.id, name: campaign.name, lead_count: campaign.lead_count,
    });
    this.spinner.show();
    this.outreachService.updateCampaign(campaign.id, { status: 'active', is_active: true }).subscribe({
      next: (updated) => {
        console.log('[CampaignManager] Status updated', { id: updated.id, status: updated.status });
        this.loadCampaigns();
        this.loadMetrics();
      },
      error: (err) => {
        this.spinner.hide();
        console.error('[CampaignManager] Launch failed', err);
      },
    });
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
