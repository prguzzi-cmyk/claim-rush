import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommunicationService } from '../../../services/communication.service';
import { LeadService } from '../../../services/leads.service';
import {
  CommunicationLog,
  MessageTemplate,
  VoiceScript,
  DashboardMetrics,
} from '../../../models/communication-log.model';
import { Lead } from '../../../models/lead.model';
import {
  CountryRule,
  ComplianceDashboardMetrics,
  ConsentChannel,
} from '../../../shared/models/communications-compliance.model';

interface KpiCard {
  label: string;
  value: string;
  icon: string;
  color: string;
}

interface ConversationThread {
  leadId: string;
  leadName: string;
  phone: string;
  email: string;
  lastMessage: string;
  lastChannel: string;
  lastTimestamp: string;
  messages: CommunicationLog[];
}

@Component({
  selector: 'app-communications-hub',
  templateUrl: './communications-hub.component.html',
  styleUrls: ['./communications-hub.component.scss'],
  standalone: false,
})
export class CommunicationsHubComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  activeTabIndex = 0;
  loading = false;

  // Dashboard
  kpiCards: KpiCard[] = [];
  metrics: DashboardMetrics = { messages_sent_today: 0, calls_placed_today: 0, response_rate: 0, appointments_created: 0 };

  // Lead Selection
  leads: Lead[] = [];
  selectedLeads: Lead[] = [];
  leadSearchTerm = '';
  leadSearchResults: Lead[] = [];
  showLeadSearch = false;

  // Messaging
  actionChannel: 'sms' | 'email' | 'voice' | 'skip_trace' = 'sms';
  messageBody = '';
  messageSubject = '';
  selectedTemplateId = '';
  selectedScriptId = '';
  sendingAction = false;

  // Templates & Scripts
  templates: MessageTemplate[] = [];
  voiceScripts: VoiceScript[] = [];

  // Attachments (email)
  attachments: File[] = [];

  // Communication Logs
  commLogs: CommunicationLog[] = [];
  voiceLogs: CommunicationLog[] = [];
  logStatusFilter = '';

  // Conversations
  conversations: ConversationThread[] = [];
  smsConversations: ConversationThread[] = [];
  filteredConversations: ConversationThread[] = [];
  selectedConversation: ConversationThread | null = null;
  inboxChannelFilter = '';

  // Campaigns
  bulkActionChannel: 'sms' | 'email' | 'voice' | null = null;

  // Compliance
  complianceMetrics: ComplianceDashboardMetrics = {
    total_opted_in: 4218,
    total_opted_out: 312,
    total_dnc_entries: 1847,
    blocked_today: 23,
    compliance_rate: 98.4,
    countries_enabled: 3,
    consent_by_channel: {
      sms: { opted_in: 3842, opted_out: 198 },
      email: { opted_in: 4102, opted_out: 287 },
      voice: { opted_in: 2956, opted_out: 412 },
    },
  };

  countryRules: CountryRule[] = [
    { id: 'us', country_code: 'US', country_name: 'United States', sms_enabled: true, voice_enabled: true, email_enabled: true, quiet_hours_start: '21:00', quiet_hours_end: '08:00', timezone: 'America/New_York', max_daily_sms: 3, max_daily_calls: 2, require_opt_in: true, tcpa_compliant: true, notes: null, is_active: true },
    { id: 'ca', country_code: 'CA', country_name: 'Canada', sms_enabled: true, voice_enabled: true, email_enabled: true, quiet_hours_start: '21:00', quiet_hours_end: '08:00', timezone: 'America/Toronto', max_daily_sms: 3, max_daily_calls: 2, require_opt_in: true, tcpa_compliant: false, notes: 'CASL compliance', is_active: true },
    { id: 'pr', country_code: 'PR', country_name: 'Puerto Rico', sms_enabled: true, voice_enabled: true, email_enabled: true, quiet_hours_start: '21:00', quiet_hours_end: '08:00', timezone: 'America/Puerto_Rico', max_daily_sms: 3, max_daily_calls: 2, require_opt_in: true, tcpa_compliant: true, notes: null, is_active: true },
    { id: 'uk', country_code: 'GB', country_name: 'United Kingdom', sms_enabled: false, voice_enabled: false, email_enabled: true, quiet_hours_start: null, quiet_hours_end: null, timezone: 'Europe/London', max_daily_sms: null, max_daily_calls: null, require_opt_in: true, tcpa_compliant: false, notes: 'GDPR — email only', is_active: false },
  ];

  constructor(
    private commService: CommunicationService,
    private leadService: LeadService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadTemplates();
    this.loadVoiceScripts();
    this.loadCommunicationLogs();
    this.loadConversations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Dashboard ──────────────────────────────────────────────────

  loadDashboard(): void {
    this.commService.getDashboardMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (m) => {
          this.metrics = m;
          this.kpiCards = this.buildKpiCards(m);
        },
        error: () => {
          this.kpiCards = this.buildKpiCards(this.metrics);
        },
      });
  }

  private buildKpiCards(m: DashboardMetrics): KpiCard[] {
    return [
      { label: 'Messages Sent Today', value: String(m.messages_sent_today), icon: 'send', color: '#1565c0' },
      { label: 'Calls Placed Today', value: String(m.calls_placed_today), icon: 'phone_in_talk', color: '#2e7d32' },
      { label: 'Response Rate', value: m.response_rate.toFixed(1) + '%', icon: 'trending_up', color: '#e65100' },
      { label: 'Appointments Created', value: String(m.appointments_created), icon: 'event_available', color: '#7b1fa2' },
    ];
  }

  // ── Lead Selection ─────────────────────────────────────────────

  searchLeads(): void {
    if (!this.leadSearchTerm || this.leadSearchTerm.length < 2) {
      this.leadSearchResults = [];
      return;
    }
    this.leadService.searchLeads(1, 20, this.leadSearchTerm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.leadSearchResults = res.items || res.data || res || [];
          this.showLeadSearch = true;
        },
        error: () => { this.leadSearchResults = []; },
      });
  }

  selectLead(lead: Lead): void {
    if (!this.selectedLeads.find(l => l.id === lead.id)) {
      this.selectedLeads.push(lead);
    }
    this.leadSearchTerm = '';
    this.leadSearchResults = [];
    this.showLeadSearch = false;
  }

  removeLead(lead: Lead): void {
    this.selectedLeads = this.selectedLeads.filter(l => l.id !== lead.id);
  }

  getLeadName(lead: Lead): string { return lead.contact?.full_name || 'Unknown'; }
  getLeadPhone(lead: Lead): string { return lead.contact?.phone_number || 'N/A'; }
  getLeadEmail(lead: Lead): string { return lead.contact?.email || 'N/A'; }

  // ── Templates & Scripts ────────────────────────────────────────

  get smsTemplates(): MessageTemplate[] {
    return this.templates.filter(t => t.channel === 'sms');
  }

  get emailTemplates(): MessageTemplate[] {
    return this.templates.filter(t => t.channel === 'email');
  }

  loadTemplates(): void {
    this.commService.getTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (t) => { this.templates = t; },
        error: () => { this.templates = this.getDefaultTemplates(); },
      });
  }

  loadVoiceScripts(): void {
    this.commService.getVoiceScripts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (s) => { this.voiceScripts = s; },
        error: () => { this.voiceScripts = this.getDefaultScripts(); },
      });
  }

  onTemplateSelected(): void {
    const tpl = this.templates.find(t => t.id === this.selectedTemplateId);
    if (tpl) {
      this.messageBody = tpl.body;
      this.messageSubject = tpl.subject || '';
    }
  }

  // ── Send Actions ───────────────────────────────────────────────

  sendSms(): void {
    this.sendingAction = true;
    const leadIds = this.selectedLeads.map(l => l.id);
    this.commService.sendSms({ lead_ids: leadIds, template_id: this.selectedTemplateId || undefined, message: this.messageBody })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.onActionSuccess('SMS messages queued'),
        error: (e) => this.onActionError(e),
      });
  }

  sendEmail(): void {
    this.sendingAction = true;
    const leadIds = this.selectedLeads.map(l => l.id);
    this.commService.sendEmail({ lead_ids: leadIds, template_id: this.selectedTemplateId || undefined, subject: this.messageSubject, message: this.messageBody })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.onActionSuccess('Emails queued'),
        error: (e) => this.onActionError(e),
      });
  }

  initiateVoiceCall(): void {
    this.sendingAction = true;
    const leadIds = this.selectedLeads.map(l => l.id);
    this.commService.sendVoiceCall({ lead_ids: leadIds, script_id: this.selectedScriptId || undefined, notes: this.messageBody })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.onActionSuccess('Voice calls initiated'),
        error: (e) => this.onActionError(e),
      });
  }

  // ── Campaigns (Bulk Actions) ───────────────────────────────────

  executeBulkAction(channel: 'sms' | 'email' | 'voice'): void {
    this.bulkActionChannel = channel;
    this.messageBody = '';
    this.messageSubject = '';
    this.selectedTemplateId = '';
    this.selectedScriptId = '';
  }

  executeBulkSend(): void {
    if (!this.bulkActionChannel) return;
    this.sendingAction = true;
    const leadIds = this.selectedLeads.map(l => l.id);

    switch (this.bulkActionChannel) {
      case 'sms':
        this.commService.sendSms({ lead_ids: leadIds, template_id: this.selectedTemplateId || undefined, message: this.messageBody })
          .pipe(takeUntil(this.destroy$))
          .subscribe({ next: () => this.onBulkSuccess('Bulk SMS campaign launched'), error: (e) => this.onActionError(e) });
        break;
      case 'email':
        this.commService.sendEmail({ lead_ids: leadIds, template_id: this.selectedTemplateId || undefined, subject: this.messageSubject, message: this.messageBody })
          .pipe(takeUntil(this.destroy$))
          .subscribe({ next: () => this.onBulkSuccess('Bulk email campaign launched'), error: (e) => this.onActionError(e) });
        break;
      case 'voice':
        this.commService.sendVoiceCall({ lead_ids: leadIds, script_id: this.selectedScriptId || undefined, notes: this.messageBody })
          .pipe(takeUntil(this.destroy$))
          .subscribe({ next: () => this.onBulkSuccess('AI call campaign launched'), error: (e) => this.onActionError(e) });
        break;
    }
  }

  private onBulkSuccess(msg: string): void {
    this.sendingAction = false;
    this.bulkActionChannel = null;
    this.snackBar.open(msg, 'Close', { duration: 4000 });
    this.selectedLeads = [];
    this.messageBody = '';
    this.messageSubject = '';
    this.loadDashboard();
  }

  private onActionSuccess(msg: string): void {
    this.sendingAction = false;
    this.snackBar.open(msg, 'Close', { duration: 3000 });
    this.selectedLeads = [];
    this.messageBody = '';
    this.messageSubject = '';
    this.loadDashboard();
    this.loadCommunicationLogs();
  }

  private onActionError(err: any): void {
    this.sendingAction = false;
    this.snackBar.open('Action failed: ' + (err?.error?.detail || 'Unknown error'), 'Close', { duration: 5000 });
  }

  // ── Attachments (Email) ────────────────────────────────────────

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.attachments.push(...Array.from(input.files));
    }
    input.value = '';
  }

  removeAttachment(index: number): void {
    this.attachments.splice(index, 1);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1048576).toFixed(1) + 'MB';
  }

  // ── Communication Logs ─────────────────────────────────────────

  loadCommunicationLogs(): void {
    const params: any = { page: '1', size: '100' };
    if (this.logStatusFilter) params.status = this.logStatusFilter;

    this.commService.getCommunications(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.commLogs = res.items || res.data || res || [];
          this.voiceLogs = this.commLogs.filter(l => l.channel === 'voice');
        },
        error: () => { this.commLogs = []; this.voiceLogs = []; },
      });
  }

  // ── Conversations ──────────────────────────────────────────────

  loadConversations(): void {
    this.commService.getCommunications({ page: '1', size: '200' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const logs: CommunicationLog[] = res.items || res.data || res || [];
          this.conversations = this.buildConversationThreads(logs);
          this.smsConversations = this.conversations.filter(c => c.lastChannel === 'sms');
          this.filterInbox(this.inboxChannelFilter);
        },
        error: () => { this.conversations = []; this.smsConversations = []; this.filteredConversations = []; },
      });
  }

  private buildConversationThreads(logs: CommunicationLog[]): ConversationThread[] {
    const grouped = new Map<string, CommunicationLog[]>();
    for (const log of logs) {
      if (!log.lead_id) continue;
      const existing = grouped.get(log.lead_id) || [];
      existing.push(log);
      grouped.set(log.lead_id, existing);
    }

    const threads: ConversationThread[] = [];
    grouped.forEach((messages, leadId) => {
      const sorted = messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const last = sorted[sorted.length - 1];
      threads.push({
        leadId,
        leadName: last.lead?.contact?.full_name || 'Lead #' + leadId.substring(0, 8),
        phone: last.recipient_phone || last.lead?.contact?.phone_number || 'N/A',
        email: last.recipient_email || last.lead?.contact?.email || 'N/A',
        lastMessage: last.body_preview || last.subject || 'No content',
        lastChannel: last.channel,
        lastTimestamp: last.created_at,
        messages: sorted,
      });
    });

    return threads.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
  }

  filterInbox(channel: string): void {
    this.inboxChannelFilter = channel;
    this.filteredConversations = channel
      ? this.conversations.filter(c => c.lastChannel === channel)
      : this.conversations;
  }

  selectConversation(conv: ConversationThread): void {
    this.selectedConversation = conv;
    this.commService.getConversationThread(conv.leadId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (msgs) => {
          if (this.selectedConversation?.leadId === conv.leadId) {
            this.selectedConversation.messages = msgs.sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          }
        },
        error: () => {},
      });
  }

  clearConversation(): void { this.selectedConversation = null; }

  // ── Compliance ─────────────────────────────────────────────────

  getConsentPercent(channel: string, type: 'opted_in' | 'opted_out'): number {
    const ch = this.complianceMetrics.consent_by_channel[channel as ConsentChannel];
    if (!ch) return 0;
    const total = ch.opted_in + ch.opted_out;
    return total > 0 ? (ch[type] / total) * 100 : 0;
  }

  getConsentCount(channel: string, type: 'opted_in' | 'opted_out'): number {
    return this.complianceMetrics.consent_by_channel[channel as ConsentChannel]?.[type] || 0;
  }

  // ── Navigation ─────────────────────────────────────────────────

  navigateToLead(leadId: string): void {
    this.router.navigate(['/app/leads', leadId]);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  // ── Utility ────────────────────────────────────────────────────

  timeAgo(ts: string): string {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  getChannelIcon(channel: string): string {
    const map: Record<string, string> = { sms: 'sms', email: 'email', voice: 'phone', multi: 'route' };
    return map[channel] || 'message';
  }

  getChannelColor(channel: string): string {
    const map: Record<string, string> = { sms: '#2e7d32', email: '#e65100', voice: '#1565c0', multi: '#7b1fa2' };
    return map[channel] || '#6b7280';
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = { sent: '#2e7d32', delivered: '#1565c0', pending: '#e65100', failed: '#c62828', queued: '#6b7280', bounced: '#c62828' };
    return map[status] || '#6b7280';
  }

  getDirectionIcon(direction: string): string {
    return direction === 'inbound' ? 'call_received' : 'call_made';
  }

  getDirectionColor(direction: string): string {
    return direction === 'inbound' ? '#2e7d32' : '#1565c0';
  }

  // ── Default Data ───────────────────────────────────────────────

  private getDefaultTemplates(): MessageTemplate[] {
    return [
      { id: 'tpl-1', name: 'Fire Incident Outreach', category: 'fire_incident', channel: 'sms', subject: null, body: 'Hi {name}, we detected a fire incident near your property at {address}. We offer free damage assessments. Reply YES to schedule.', is_active: true, created_by_id: null, created_at: '', updated_at: null },
      { id: 'tpl-2', name: 'Storm Damage Outreach', category: 'storm_damage', channel: 'sms', subject: null, body: 'Hi {name}, recent storm activity was reported near {address}. Our team provides free roof and property inspections. Reply YES for details.', is_active: true, created_by_id: null, created_at: '', updated_at: null },
      { id: 'tpl-3', name: 'Claim Follow-Up', category: 'claim_followup', channel: 'email', subject: 'Update on Your Property Claim', body: 'Dear {name},\n\nWe wanted to follow up on your property claim. Our team is available to assist with any questions about the claims process.\n\nBest regards,\nACI Team', is_active: true, created_by_id: null, created_at: '', updated_at: null },
      { id: 'tpl-4', name: 'Appointment Confirmation', category: 'appointment_confirmation', channel: 'sms', subject: null, body: 'Hi {name}, confirming your inspection appointment on {date} at {time} at {address}. Reply C to confirm or R to reschedule.', is_active: true, created_by_id: null, created_at: '', updated_at: null },
    ];
  }

  private getDefaultScripts(): VoiceScript[] {
    return [
      { id: 'vs-1', name: 'Fire Damage Assessment Call', description: 'Initial outreach for fire-affected properties', category: 'fire_outreach', script_text: 'Hello, my name is {agent_name} calling from ACI...', greeting: 'Good morning/afternoon, am I speaking with {name}?', closing: 'Thank you for your time.', objection_handling: 'I completely understand your concern.', is_active: true, created_by_id: null, created_at: '', updated_at: null },
      { id: 'vs-2', name: 'Storm Damage Follow-Up', description: 'Follow-up call for storm damage leads', category: 'storm_outreach', script_text: 'Hello {name}, this is {agent_name} from ACI...', greeting: 'Hi, is this {name}?', closing: 'Great, I\'ll get that inspection scheduled for you.', objection_handling: 'Our inspections are completely free.', is_active: true, created_by_id: null, created_at: '', updated_at: null },
      { id: 'vs-3', name: 'Appointment Setter', description: 'Book inspection appointments', category: 'appointment_setter', script_text: 'Hello {name}, I\'m calling to schedule your free property inspection.', greeting: 'Good day, may I speak with {name}?', closing: 'Perfect, you\'re all set!', objection_handling: null, is_active: true, created_by_id: null, created_at: '', updated_at: null },
    ];
  }
}
