import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { VoiceOutreachAgentService, VoiceAgentCampaign, VoiceScript, CampaignStatus, LeadSource } from '../voice-outreach-agent.service';

@Component({
  selector: 'app-voice-campaign-manager',
  templateUrl: './voice-campaign-manager.component.html',
  styleUrls: ['./voice-campaign-manager.component.scss'],
  standalone: false,
})
export class VoiceCampaignManagerComponent implements OnInit, OnDestroy {
  campaigns: VoiceAgentCampaign[] = [];
  scripts: VoiceScript[] = [];
  statusFilter: CampaignStatus | 'all' = 'all';
  showCreateForm = false;
  private subs: Subscription[] = [];

  leadSources: { value: LeadSource; label: string }[] = [
    { value: 'storm_intelligence', label: 'Storm Intelligence' },
    { value: 'fire_incident', label: 'Fire Incidents' },
    { value: 'rotation_engine', label: 'Lead Rotation Engine' },
    { value: 'community_advocate', label: 'Community Advocate' },
    { value: 'manual', label: 'Manual Upload' },
  ];

  timezones = ['EST', 'CST', 'MST', 'PST'];

  form: Partial<VoiceAgentCampaign> = this.defaultForm();

  constructor(
    private service: VoiceOutreachAgentService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.service.getCampaigns().subscribe(c => this.campaigns = c),
      this.service.getScripts().subscribe(s => this.scripts = s),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  get filteredCampaigns(): VoiceAgentCampaign[] {
    if (this.statusFilter === 'all') return this.campaigns;
    return this.campaigns.filter(c => c.status === this.statusFilter);
  }

  private defaultForm(): Partial<VoiceAgentCampaign> {
    return {
      name: '', leadSource: 'storm_intelligence', scriptId: '', scriptName: '',
      callingHoursStart: '09:00', callingHoursEnd: '18:00', timezone: 'CST',
      maxCallsPerDay: 100, maxRetries: 3, retryDelayMinutes: 60, throttleCallsPerMinute: 5,
    };
  }

  onScriptChange(): void {
    const script = this.scripts.find(s => s.id === this.form.scriptId);
    if (script) this.form.scriptName = script.name;
  }

  createCampaign(): void {
    if (!this.form.name || !this.form.scriptId || !this.form.leadSource) {
      this.snackBar.open('Please fill all required fields', 'OK', { duration: 3000 });
      return;
    }
    const campaign: VoiceAgentCampaign = {
      id: 'VOC-' + String(this.campaigns.length + 1).padStart(3, '0'),
      name: this.form.name!,
      status: 'draft',
      leadSource: this.form.leadSource as LeadSource,
      scriptId: this.form.scriptId!,
      scriptName: this.form.scriptName!,
      callingHoursStart: this.form.callingHoursStart!,
      callingHoursEnd: this.form.callingHoursEnd!,
      timezone: this.form.timezone!,
      maxCallsPerDay: this.form.maxCallsPerDay!,
      maxRetries: this.form.maxRetries!,
      retryDelayMinutes: this.form.retryDelayMinutes!,
      throttleCallsPerMinute: this.form.throttleCallsPerMinute!,
      totalLeads: 0, callsPlaced: 0, callsConnected: 0, leadsGenerated: 0, appointmentsBooked: 0,
      createdAt: new Date().toISOString(), launchedAt: null,
    };
    this.service.createCampaign(campaign);
    this.showCreateForm = false;
    this.form = this.defaultForm();
    this.snackBar.open(`Campaign "${campaign.name}" created`, 'OK', { duration: 3500 });
  }

  launchCampaign(c: VoiceAgentCampaign): void {
    this.service.updateCampaignStatus(c.id, 'active');
    this.snackBar.open(`Campaign "${c.name}" launched`, 'OK', { duration: 3500 });
  }

  pauseCampaign(c: VoiceAgentCampaign): void {
    this.service.updateCampaignStatus(c.id, 'paused');
    this.snackBar.open(`Campaign "${c.name}" paused`, 'OK', { duration: 3000 });
  }

  resumeCampaign(c: VoiceAgentCampaign): void {
    this.service.updateCampaignStatus(c.id, 'active');
    this.snackBar.open(`Campaign "${c.name}" resumed`, 'OK', { duration: 3000 });
  }

  getStatusBadgeClass(status: string): string {
    const m: Record<string, string> = { draft: 'badge-muted', active: 'badge-green', paused: 'badge-orange', completed: 'badge-blue' };
    return m[status] || 'badge-muted';
  }

  getSourceLabel(source: string): string {
    return this.leadSources.find(s => s.value === source)?.label || source;
  }

  getConnectionRate(c: VoiceAgentCampaign): number {
    return c.callsPlaced ? Math.round((c.callsConnected / c.callsPlaced) * 100) : 0;
  }

  timeAgo(ts: string): string {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }
}
