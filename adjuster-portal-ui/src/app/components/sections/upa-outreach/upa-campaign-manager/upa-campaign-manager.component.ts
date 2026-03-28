import { Component, OnInit } from '@angular/core';
import { NgxSpinnerService } from 'ngx-spinner';
import {
  UpaOutreachService,
  SequenceStep,
  FunnelMetrics,
  OutreachProfile,
  CONTACT_STATUS_OPTIONS,
} from 'src/app/services/upa-outreach.service';

@Component({
  selector: 'app-upa-campaign-manager',
  templateUrl: './upa-campaign-manager.component.html',
  styleUrls: ['./upa-campaign-manager.component.scss'],
  standalone: false,
})
export class UpaCampaignManagerComponent implements OnInit {
  sequence: SequenceStep[] = [];
  metrics: FunnelMetrics = { new: 0, sent: 0, engaged: 0, opted_out: 0, aci_ready: 0, closed: 0, total: 0 };
  profiles: OutreachProfile[] = [];
  statusOptions = CONTACT_STATUS_OPTIONS;

  constructor(
    private upaOutreach: UpaOutreachService,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.spinner.show();
    this.upaOutreach.getSequence().subscribe((data) => {
      this.sequence = data;
    });
    this.upaOutreach.getFunnelMetrics().subscribe((data) => {
      this.metrics = data;
      this.spinner.hide();
    });
    this.upaOutreach.getProfiles().subscribe((data) => {
      this.profiles = data;
    });
  }

  getChannelIcon(channel: string): string {
    switch (channel) {
      case 'sms': return 'sms';
      case 'email': return 'email';
      case 'voice': return 'phone';
      case 'system': return 'settings';
      default: return 'send';
    }
  }

  getChannelColor(channel: string): string {
    switch (channel) {
      case 'sms': return '#2196f3';
      case 'email': return '#ff9800';
      case 'system': return '#9c27b0';
      default: return '#4caf50';
    }
  }

  getTriggerLabel(trigger: string): string {
    switch (trigger) {
      case 'new_lead': return 'On new lead';
      case 'no_reply': return 'If no reply';
      case 'positive_reply': return 'On positive reply';
      case 'aci_ready': return 'When ACI ready';
      default: return trigger;
    }
  }

  getStatusColor(status: string): string {
    const found = this.statusOptions.find(s => s.value === status);
    return found ? found.color : '#9e9e9e';
  }

  getLinkedProfile(stepName: string): OutreachProfile | undefined {
    return this.profiles.find(p => p.name === stepName);
  }

  getFunnelPercentage(value: number): number {
    return this.metrics.total > 0 ? Math.round((value / this.metrics.total) * 100) : 0;
  }
}
