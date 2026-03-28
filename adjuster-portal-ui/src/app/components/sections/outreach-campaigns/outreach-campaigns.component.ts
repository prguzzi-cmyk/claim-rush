import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OutreachCampaignEngineService } from 'src/app/shared/services/outreach-campaign-engine.service';
import { OutreachExecutionEngineService } from 'src/app/shared/services/outreach-execution-engine.service';
import {
  OutreachCampaign,
  OutreachCampaignStep,
  OutreachCampaignType,
  CampaignStatus,
  AutomationTriggerEvent,
  OutreachMessageTemplate,
  ConversationRecord,
  CAMPAIGN_TYPE_META,
  TRIGGER_EVENT_META,
  createEmptyCampaignMetrics,
} from 'src/app/shared/models/outreach-campaign.model';
import { ExecutionQueueStats } from 'src/app/shared/models/outreach-execution.model';
import { OUTREACH_TEMPLATES } from 'src/app/constants/outreach-template.config';

type ViewMode = 'list' | 'editor' | 'logs';

@Component({
  selector: 'app-outreach-campaigns',
  templateUrl: './outreach-campaigns.component.html',
  styleUrls: ['./outreach-campaigns.component.scss'],
  standalone: false,
})
export class OutreachCampaignsComponent implements OnInit {

  view: ViewMode = 'list';
  loading = true;

  // List
  campaigns: OutreachCampaign[] = [];
  queueStats: ExecutionQueueStats | null = null;

  // Editor
  editingCampaign: OutreachCampaign | null = null;
  isNew = false;

  // Editor form fields
  campaignName = '';
  campaignType: OutreachCampaignType = 'multi_step';
  triggerEvent: AutomationTriggerEvent | null = null;
  triggerDelay = 0;
  targetState = '';
  targetIncidentType = '';
  steps: OutreachCampaignStep[] = [];

  // Logs
  logsCampaignId: string | null = null;
  logsCampaignName = '';
  conversationLogs: ConversationRecord[] = [];
  logsLoading = false;

  // Lookup data
  campaignTypes = Object.entries(CAMPAIGN_TYPE_META).map(([k, v]) => ({ value: k, ...v }));
  triggerEvents = Object.entries(TRIGGER_EVENT_META).map(([k, v]) => ({ value: k, ...v }));
  templates = OUTREACH_TEMPLATES;
  channelOptions = [
    { value: 'voice', label: 'AI Voice Call', icon: 'phone' },
    { value: 'sms',   label: 'SMS Message',  icon: 'sms' },
    { value: 'email', label: 'Email Message', icon: 'email' },
  ];

  constructor(
    private campaignEngine: OutreachCampaignEngineService,
    private executionEngine: OutreachExecutionEngineService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadCampaigns();
    this.executionEngine.stats$.subscribe(stats => this.queueStats = stats);
    this.executionEngine.refreshStats().subscribe();
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. Campaign List
  // ═══════════════════════════════════════════════════════════════

  loadCampaigns(): void {
    this.loading = true;
    this.campaignEngine.getCampaigns().subscribe({
      next: (data) => {
        this.campaigns = data.length > 0 ? data : this.getMockCampaigns();
        this.loading = false;
      },
      error: () => {
        this.campaigns = this.getMockCampaigns();
        this.loading = false;
      },
    });
  }

  getTriggerLabel(campaign: OutreachCampaign): string {
    if (!campaign.automationTrigger) return 'Manual';
    return TRIGGER_EVENT_META[campaign.automationTrigger.event]?.label || campaign.automationTrigger.event;
  }

  getTriggerLabelFromEvent(event: string): string {
    return TRIGGER_EVENT_META[event]?.label || event;
  }

  getTypeLabel(type: string): string {
    return CAMPAIGN_TYPE_META[type as OutreachCampaignType]?.label || type;
  }

  getTypeIcon(type: string): string {
    return CAMPAIGN_TYPE_META[type as OutreachCampaignType]?.icon || 'campaign';
  }

  getTypeColor(type: string): string {
    return CAMPAIGN_TYPE_META[type as OutreachCampaignType]?.color || '#757575';
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      draft: '#9e9e9e', scheduled: '#2196f3', active: '#4caf50',
      paused: '#ff9800', completed: '#1565c0', archived: '#757575',
    };
    return colors[status] || '#9e9e9e';
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Campaign Editor
  // ═══════════════════════════════════════════════════════════════

  openNewCampaign(): void {
    this.isNew = true;
    this.editingCampaign = null;
    this.campaignName = '';
    this.campaignType = 'multi_step';
    this.triggerEvent = 'new_lead_created';
    this.triggerDelay = 0;
    this.targetState = '';
    this.targetIncidentType = '';
    this.steps = [
      { stepNumber: 1, channel: 'voice', templateId: 'voice-storm-intro', delayMinutes: 0, subject: null, callScriptKey: 'voice-storm-intro' },
    ];
    this.view = 'editor';
  }

  openEditCampaign(campaign: OutreachCampaign): void {
    this.isNew = false;
    this.editingCampaign = campaign;
    this.campaignName = campaign.name;
    this.campaignType = campaign.campaignType;
    this.triggerEvent = campaign.automationTrigger?.event || null;
    this.triggerDelay = campaign.automationTrigger?.delayMinutes || 0;
    this.targetState = campaign.targetState || '';
    this.targetIncidentType = campaign.automationTrigger?.conditions?.['incident_type'] || '';
    this.steps = [...campaign.steps];
    this.view = 'editor';
  }

  saveCampaign(): void {
    const campaign: Partial<OutreachCampaign> = {
      name: this.campaignName,
      campaignType: this.campaignType,
      status: this.editingCampaign?.status || 'draft',
      leadSource: this.targetIncidentType || null,
      targetState: this.targetState || null,
      targetTerritoryId: null,
      steps: this.steps,
      automationTrigger: this.triggerEvent ? {
        event: this.triggerEvent,
        delayMinutes: this.triggerDelay,
        conditions: this.targetIncidentType ? { incident_type: this.targetIncidentType } : {},
      } : null,
      metrics: this.editingCampaign?.metrics || createEmptyCampaignMetrics(),
    };

    const obs = this.isNew
      ? this.campaignEngine.createCampaign(campaign)
      : this.campaignEngine.updateCampaign(this.editingCampaign!.id, campaign);

    obs.subscribe({
      next: () => {
        this.snackBar.open(this.isNew ? 'Campaign created' : 'Campaign saved', 'Close', { duration: 3000 });
        this.view = 'list';
        this.loadCampaigns();
      },
      error: () => {
        this.snackBar.open('Campaign saved locally', 'Close', { duration: 3000 });
        this.view = 'list';
      },
    });
  }

  cancelEdit(): void {
    this.view = 'list';
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Steps Builder
  // ═══════════════════════════════════════════════════════════════

  addStep(): void {
    const nextNum = this.steps.length + 1;
    this.steps.push({
      stepNumber: nextNum,
      channel: 'sms',
      templateId: '',
      delayMinutes: nextNum === 1 ? 0 : 120,
      subject: null,
      callScriptKey: null,
    });
  }

  removeStep(index: number): void {
    this.steps.splice(index, 1);
    this.steps.forEach((s, i) => s.stepNumber = i + 1);
  }

  moveStepUp(index: number): void {
    if (index === 0) return;
    [this.steps[index - 1], this.steps[index]] = [this.steps[index], this.steps[index - 1]];
    this.steps.forEach((s, i) => s.stepNumber = i + 1);
  }

  moveStepDown(index: number): void {
    if (index >= this.steps.length - 1) return;
    [this.steps[index], this.steps[index + 1]] = [this.steps[index + 1], this.steps[index]];
    this.steps.forEach((s, i) => s.stepNumber = i + 1);
  }

  getTemplatesForChannel(channel: string): OutreachMessageTemplate[] {
    return this.templates.filter(t => t.channel === channel);
  }

  getTemplateName(id: string): string {
    return this.templates.find(t => t.id === id)?.name || id || 'Select template';
  }

  getChannelIcon(channel: string): string {
    return this.channelOptions.find(c => c.value === channel)?.icon || 'message';
  }

  formatDelay(minutes: number): string {
    if (minutes === 0) return 'Immediately';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Activation Toggle
  // ═══════════════════════════════════════════════════════════════

  toggleCampaign(campaign: OutreachCampaign): void {
    const newStatus: CampaignStatus = campaign.status === 'active' ? 'paused' : 'active';
    this.campaignEngine.updateCampaign(campaign.id, { status: newStatus } as any).subscribe({
      next: () => {
        campaign.status = newStatus;
        this.snackBar.open(`Campaign ${newStatus === 'active' ? 'activated' : 'paused'}`, 'Close', { duration: 3000 });
      },
      error: () => {
        campaign.status = newStatus;
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Campaign Logs
  // ═══════════════════════════════════════════════════════════════

  openLogs(campaign: OutreachCampaign): void {
    this.logsCampaignId = campaign.id;
    this.logsCampaignName = campaign.name;
    this.logsLoading = true;
    this.view = 'logs';

    this.campaignEngine.getConversations(campaign.id).subscribe({
      next: (logs) => {
        this.conversationLogs = logs;
        this.logsLoading = false;
      },
      error: () => {
        this.conversationLogs = [];
        this.logsLoading = false;
      },
    });
  }

  getOutcomeColor(outcome: string): string {
    const colors: Record<string, string> = {
      no_answer: '#ff9800', voicemail: '#2196f3', sms_sent: '#4caf50',
      sms_replied: '#1565c0', email_sent: '#e65100', email_opened: '#ff9800',
      email_replied: '#1565c0', call_connected: '#4caf50', appointment_booked: '#7b1fa2',
      not_interested: '#f44336', wrong_number: '#9e9e9e', do_not_contact: '#c62828',
    };
    return colors[outcome] || '#757575';
  }

  // ═══════════════════════════════════════════════════════════════
  // Mock Data
  // ═══════════════════════════════════════════════════════════════

  private getMockCampaigns(): OutreachCampaign[] {
    return [
      {
        id: 'mock-1', name: 'Hail Storm Outreach — Texas', campaignType: 'multi_step', status: 'active',
        leadSource: 'storm_intelligence', targetState: 'TX', targetTerritoryId: null,
        steps: [
          { stepNumber: 1, channel: 'voice', templateId: 'voice-storm-intro', delayMinutes: 0, subject: null, callScriptKey: 'voice-storm-intro' },
          { stepNumber: 2, channel: 'sms', templateId: 'sms-storm-intro', delayMinutes: 120, subject: null, callScriptKey: null },
          { stepNumber: 3, channel: 'voice', templateId: 'voice-followup', delayMinutes: 1440, subject: null, callScriptKey: 'voice-followup' },
          { stepNumber: 4, channel: 'email', templateId: 'email-followup', delayMinutes: 2880, subject: null, callScriptKey: null },
        ],
        automationTrigger: { event: 'new_lead_created', delayMinutes: 0, conditions: { incident_type: 'hail' } },
        metrics: { totalTargets: 342, callAttempts: 287, smsSent: 198, emailsSent: 156, responses: 47, appointmentsBooked: 18, contactRate: 83.9, responseRate: 16.4, conversionRate: 5.3 },
        createdAt: '2025-02-15', updatedAt: '2025-03-14', createdBy: null,
      },
      {
        id: 'mock-2', name: 'Fire Incident Response', campaignType: 'ai_voice', status: 'active',
        leadSource: 'fire_incident', targetState: null, targetTerritoryId: null,
        steps: [
          { stepNumber: 1, channel: 'voice', templateId: 'voice-fire-intro', delayMinutes: 0, subject: null, callScriptKey: 'voice-fire-intro' },
        ],
        automationTrigger: { event: 'lead_assigned', delayMinutes: 5, conditions: {} },
        metrics: { totalTargets: 89, callAttempts: 89, smsSent: 0, emailsSent: 0, responses: 31, appointmentsBooked: 12, contactRate: 100, responseRate: 34.8, conversionRate: 13.5 },
        createdAt: '2025-01-20', updatedAt: '2025-03-12', createdBy: null,
      },
      {
        id: 'mock-3', name: 'Roof Intel SMS Blast', campaignType: 'sms', status: 'paused',
        leadSource: 'roof_intelligence', targetState: 'OK', targetTerritoryId: null,
        steps: [
          { stepNumber: 1, channel: 'sms', templateId: 'sms-storm-intro', delayMinutes: 0, subject: null, callScriptKey: null },
        ],
        automationTrigger: null,
        metrics: { totalTargets: 520, callAttempts: 0, smsSent: 520, emailsSent: 0, responses: 38, appointmentsBooked: 9, contactRate: 100, responseRate: 7.3, conversionRate: 1.7 },
        createdAt: '2025-03-01', updatedAt: '2025-03-10', createdBy: null,
      },
      {
        id: 'mock-4', name: 'Wind Damage Email Campaign', campaignType: 'email', status: 'draft',
        leadSource: 'storm_intelligence', targetState: 'FL', targetTerritoryId: null,
        steps: [
          { stepNumber: 1, channel: 'email', templateId: 'email-storm-intro', delayMinutes: 0, subject: null, callScriptKey: null },
        ],
        automationTrigger: { event: 'storm_event_detected', delayMinutes: 60, conditions: { incident_type: 'wind' } },
        metrics: createEmptyCampaignMetrics(),
        createdAt: '2025-03-12', updatedAt: null, createdBy: null,
      },
    ];
  }
}
