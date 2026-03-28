import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';

import {
  VoiceCallRecord,
  VoiceCallOutcome,
  AICallStatus,
  CALL_OUTCOME_META,
  VoiceCampaign,
  VoiceCampaignStatus,
  VoiceCampaignLeadSource,
  VOICE_CAMPAIGN_SCRIPTS,
  VoiceCampaignScript,
  QuickCallResult,
  QUICK_CALL_RESULT_META,
} from '../../../../shared/models/voice-outreach.model';
import { InitiateCallDialogComponent } from '../initiate-call-dialog/initiate-call-dialog.component';
import { RecordOutcomeDialogComponent } from '../record-outcome-dialog/record-outcome-dialog.component';

// ── Local Interfaces ──

interface KpiCard {
  label: string;
  value: string;
  icon: string;
  color: string;
  bgColor: string;
}

interface LeadSelection {
  id: string;
  name: string;
  phone: string;
  source: string;
  peril: string;
  address: string;
  selected: boolean;
}

@Component({
  selector: 'app-voice-outreach-dashboard',
  templateUrl: './voice-outreach-dashboard.component.html',
  styleUrls: ['./voice-outreach-dashboard.component.scss'],
  standalone: false,
})
export class VoiceOutreachDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTabIndex = 0;

  // ── KPI Metrics ──
  kpiCards: KpiCard[] = [];
  callsPlacedToday = 0;
  connectionRate = 0;
  appointmentsBooked = 0;
  clientsSigned = 0;

  // ── Campaigns ──
  campaigns: VoiceCampaign[] = [];
  showCampaignBuilder = false;
  editingCampaign: VoiceCampaign | null = null;
  campaignForm = {
    name: '',
    leadSource: 'all_leads' as VoiceCampaignLeadSource,
    scriptId: '',
    scheduledDate: '',
    scheduledTime: '',
    assignedAgentName: '',
  };
  availableScripts: VoiceCampaignScript[] = VOICE_CAMPAIGN_SCRIPTS;
  leadSourceOptions: { value: VoiceCampaignLeadSource; label: string }[] = [
    { value: 'all_leads', label: 'All Leads' },
    { value: 'fire_leads', label: 'Fire Leads' },
    { value: 'storm_leads', label: 'Storm Leads' },
    { value: 'hail_leads', label: 'Hail Leads' },
    { value: 'wind_leads', label: 'Wind Leads' },
    { value: 'flood_leads', label: 'Flood Leads' },
    { value: 'rotation_leads', label: 'Rotation Leads' },
    { value: 'manual_selection', label: 'Manual Selection' },
  ];
  agentOptions: string[] = [
    'Marcus Rivera', 'Angela Watts', 'David Kim', 'Sarah Chen', 'AI Voice Agent',
  ];

  // ── Call Log Table ──
  allCalls: VoiceCallRecord[] = [];
  dataSource: MatTableDataSource<VoiceCallRecord>;
  displayedColumns: string[] = [
    'phoneNumber', 'status', 'duration', 'result', 'agent', 'timestamp', 'actions',
  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  // ── Quick Results ──
  quickResults = QUICK_CALL_RESULT_META;
  quickResultKeys = Object.keys(QUICK_CALL_RESULT_META) as QuickCallResult[];

  // ── Lead Selection for Campaign ──
  availableLeads: LeadSelection[] = [];
  leadSearchQuery = '';
  selectAllLeads = false;

  // ── Active Call Panel ──
  activeCalls: VoiceCallRecord[] = [];

  outcomeMeta = CALL_OUTCOME_META;

  readonly statusColors: Record<string, string> = {
    pending: '#9e9e9e',
    initiated: '#2196f3',
    ringing: '#ff9800',
    connected: '#4caf50',
    no_answer: '#f44336',
    voicemail: '#ff9800',
    failed: '#f44336',
    completed: '#4caf50',
    skipped: '#9e9e9e',
  };

  readonly campaignStatusColors: Record<string, string> = {
    draft: '#9e9e9e',
    scheduled: '#1565c0',
    active: '#2e7d32',
    paused: '#e65100',
    completed: '#6b7280',
  };

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadMockData();
    this.computeKPIs();
    this.buildTable();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ══════════════════════════════════════════════════════════════
  // KPI / METRICS
  // ══════════════════════════════════════════════════════════════

  private computeKPIs(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCalls = this.allCalls.filter(c =>
      c.createdAt && new Date(c.createdAt).getTime() >= today.getTime()
    );

    this.callsPlacedToday = todayCalls.length;
    const connected = todayCalls.filter(c => c.status === 'connected' || c.status === 'completed').length;
    this.connectionRate = this.callsPlacedToday > 0
      ? Math.round((connected / this.callsPlacedToday) * 100)
      : 0;

    this.appointmentsBooked = todayCalls.filter(c =>
      c.outcome === 'qualified_lead' || c.outcome === 'possible_claim'
    ).length;

    this.clientsSigned = todayCalls.filter(c =>
      c.outcome === 'existing_client'
    ).length + 3; // mock boost

    this.kpiCards = [
      { label: 'Calls Placed Today', value: String(this.callsPlacedToday), icon: 'phone_in_talk', color: '#1565c0', bgColor: '#e3f2fd' },
      { label: 'Connection Rate', value: `${this.connectionRate}%`, icon: 'call_made', color: '#2e7d32', bgColor: '#e8f5e9' },
      { label: 'Appointments Booked', value: String(this.appointmentsBooked), icon: 'event_available', color: '#e65100', bgColor: '#fff3e0' },
      { label: 'Clients Signed', value: String(this.clientsSigned), icon: 'how_to_reg', color: '#7b1fa2', bgColor: '#f3e5f5' },
    ];

    this.activeCalls = this.allCalls.filter(c =>
      c.status === 'initiated' || c.status === 'ringing' || c.status === 'connected'
    );
  }

  // ══════════════════════════════════════════════════════════════
  // CAMPAIGN BUILDER
  // ══════════════════════════════════════════════════════════════

  openCampaignBuilder(): void {
    this.showCampaignBuilder = true;
    this.editingCampaign = null;
    this.campaignForm = {
      name: '', leadSource: 'all_leads', scriptId: '',
      scheduledDate: '', scheduledTime: '', assignedAgentName: '',
    };
  }

  closeCampaignBuilder(): void {
    this.showCampaignBuilder = false;
    this.editingCampaign = null;
  }

  saveCampaign(): void {
    if (!this.campaignForm.name || !this.campaignForm.scriptId) {
      this.snackBar.open('Please fill in campaign name and select a script', '', { duration: 3000 });
      return;
    }
    const script = this.availableScripts.find(s => s.id === this.campaignForm.scriptId);
    const selectedLeadCount = this.campaignForm.leadSource === 'manual_selection'
      ? this.availableLeads.filter(l => l.selected).length
      : this.getLeadCountForSource(this.campaignForm.leadSource);

    const newCampaign: VoiceCampaign = {
      id: 'vc-' + Date.now(),
      name: this.campaignForm.name,
      leadSource: this.campaignForm.leadSource,
      scriptId: this.campaignForm.scriptId,
      scriptName: script?.name || '',
      assignedAgentId: null,
      assignedAgentName: this.campaignForm.assignedAgentName || 'AI Voice Agent',
      status: this.campaignForm.scheduledDate ? 'scheduled' : 'draft',
      scheduledDate: this.campaignForm.scheduledDate || null,
      scheduledTime: this.campaignForm.scheduledTime || null,
      leadCount: selectedLeadCount,
      callsPlaced: 0,
      callsConnected: 0,
      appointmentsBooked: 0,
      clientsSigned: 0,
      createdAt: new Date().toISOString(),
    };

    this.campaigns.unshift(newCampaign);
    this.showCampaignBuilder = false;
    this.snackBar.open(`Campaign "${newCampaign.name}" created`, '', { duration: 3000 });
  }

  launchCampaign(campaign: VoiceCampaign): void {
    campaign.status = 'active';
    this.snackBar.open(`Campaign "${campaign.name}" launched — AI dialer starting`, '', { duration: 3500 });
  }

  pauseCampaign(campaign: VoiceCampaign): void {
    campaign.status = 'paused';
    this.snackBar.open(`Campaign "${campaign.name}" paused`, '', { duration: 2500 });
  }

  resumeCampaign(campaign: VoiceCampaign): void {
    campaign.status = 'active';
    this.snackBar.open(`Campaign "${campaign.name}" resumed`, '', { duration: 2500 });
  }

  getCampaignStatusColor(status: VoiceCampaignStatus): string {
    return this.campaignStatusColors[status] || '#9e9e9e';
  }

  getLeadSourceLabel(source: VoiceCampaignLeadSource): string {
    return this.leadSourceOptions.find(o => o.value === source)?.label || source;
  }

  private getLeadCountForSource(source: VoiceCampaignLeadSource): number {
    const map: Record<string, number> = {
      all_leads: 486, fire_leads: 57, storm_leads: 215, hail_leads: 342,
      wind_leads: 186, flood_leads: 128, rotation_leads: 94, manual_selection: 0,
    };
    return map[source] || 0;
  }

  // ══════════════════════════════════════════════════════════════
  // CALL LOG TABLE
  // ══════════════════════════════════════════════════════════════

  private buildTable(): void {
    this.dataSource = new MatTableDataSource(this.allCalls);
    setTimeout(() => {
      if (this.paginator) this.dataSource.paginator = this.paginator;
      if (this.sort) this.dataSource.sort = this.sort;
    });
  }

  applyCallFilter(value: string): void {
    this.dataSource.filter = value.trim().toLowerCase();
  }

  // ══════════════════════════════════════════════════════════════
  // QUICK RESULT ACTIONS
  // ══════════════════════════════════════════════════════════════

  setQuickResult(call: VoiceCallRecord, result: QuickCallResult): void {
    const outcomeMap: Record<QuickCallResult, VoiceCallOutcome> = {
      no_answer: 'no_answer',
      left_voicemail: 'left_voicemail',
      call_back_later: 'call_back_later',
      not_interested: 'not_interested',
      wants_information: 'possible_claim',
      signed_client: 'existing_client',
    };
    call.outcome = outcomeMap[result];
    const meta = QUICK_CALL_RESULT_META[result];
    this.snackBar.open(`Result set: ${meta.label}`, '', { duration: 2000 });
    this.computeKPIs();
  }

  // ══════════════════════════════════════════════════════════════
  // LEAD SELECTION (for manual campaign building)
  // ══════════════════════════════════════════════════════════════

  get filteredLeads(): LeadSelection[] {
    if (!this.leadSearchQuery) return this.availableLeads;
    const q = this.leadSearchQuery.toLowerCase();
    return this.availableLeads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.source.toLowerCase().includes(q) ||
      l.address.toLowerCase().includes(q)
    );
  }

  get selectedLeadCount(): number {
    return this.availableLeads.filter(l => l.selected).length;
  }

  toggleSelectAllLeads(): void {
    const val = !this.selectAllLeads;
    this.selectAllLeads = val;
    this.filteredLeads.forEach(l => l.selected = val);
  }

  // ══════════════════════════════════════════════════════════════
  // AI VOICE CALLER
  // ══════════════════════════════════════════════════════════════

  openNewCallDialog(): void {
    const ref = this.dialog.open(InitiateCallDialogComponent, { width: '520px' });
    ref.afterClosed().subscribe(result => {
      if (result?.success) {
        this.loadMockData();
        this.computeKPIs();
        this.buildTable();
      }
    });
  }

  openRecordOutcome(call: VoiceCallRecord, event: Event): void {
    event.stopPropagation();
    const ref = this.dialog.open(RecordOutcomeDialogComponent, {
      width: '460px',
      data: { callId: call.id },
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.computeKPIs();
        this.buildTable();
      }
    });
  }

  openCallDetail(call: VoiceCallRecord): void {
    this.router.navigate(['/app/voice-outreach', call.id]);
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  getStatusColor(status: string): string {
    return this.statusColors[status] || '#9e9e9e';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getOutcomeLabel(outcome: VoiceCallOutcome | null): string {
    if (!outcome) return '—';
    return CALL_OUTCOME_META[outcome]?.label || outcome;
  }

  getOutcomeColor(outcome: VoiceCallOutcome | null): string {
    if (!outcome) return '#9e9e9e';
    return CALL_OUTCOME_META[outcome]?.color || '#9e9e9e';
  }

  getOutcomeIcon(outcome: VoiceCallOutcome | null): string {
    if (!outcome) return '';
    return CALL_OUTCOME_META[outcome]?.icon || '';
  }

  formatDuration(seconds: number | null): string {
    if (seconds == null) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  isLiveStatus(status: AICallStatus): boolean {
    return status === 'initiated' || status === 'ringing' || status === 'connected';
  }

  refresh(): void {
    this.loadMockData();
    this.computeKPIs();
    this.buildTable();
    this.snackBar.open('Data refreshed', '', { duration: 1500 });
  }

  // ══════════════════════════════════════════════════════════════
  // MOCK DATA
  // ══════════════════════════════════════════════════════════════

  private loadMockData(): void {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    this.campaigns = [
      { id: 'vc-1', name: 'Hail Storm — North Dallas', leadSource: 'hail_leads', scriptId: 'storm_followup', scriptName: 'Storm Follow-Up', assignedAgentId: null, assignedAgentName: 'AI Voice Agent', status: 'active', scheduledDate: today, scheduledTime: '08:00', leadCount: 342, callsPlaced: 187, callsConnected: 62, appointmentsBooked: 18, clientsSigned: 5, createdAt: '2026-03-15T08:00:00Z' },
      { id: 'vc-2', name: 'Wind Damage — Fort Worth', leadSource: 'wind_leads', scriptId: 'claim_qualification', scriptName: 'Claim Qualification', assignedAgentId: null, assignedAgentName: 'Marcus Rivera', status: 'active', scheduledDate: today, scheduledTime: '09:00', leadCount: 186, callsPlaced: 94, callsConnected: 34, appointmentsBooked: 11, clientsSigned: 3, createdAt: '2026-03-14T10:30:00Z' },
      { id: 'vc-3', name: 'Fire Damage — Plano', leadSource: 'fire_leads', scriptId: 'intro_inspection', scriptName: 'Intro & Free Inspection', assignedAgentId: null, assignedAgentName: 'Angela Watts', status: 'paused', scheduledDate: '2026-03-13', scheduledTime: '07:00', leadCount: 57, callsPlaced: 42, callsConnected: 19, appointmentsBooked: 8, clientsSigned: 2, createdAt: '2026-03-10T09:00:00Z' },
      { id: 'vc-4', name: 'Flood Zone — Irving', leadSource: 'flood_leads', scriptId: 'appointment_setter', scriptName: 'Appointment Setter', assignedAgentId: null, assignedAgentName: 'David Kim', status: 'scheduled', scheduledDate: '2026-03-18', scheduledTime: '06:00', leadCount: 128, callsPlaced: 0, callsConnected: 0, appointmentsBooked: 0, clientsSigned: 0, createdAt: '2026-03-16T14:00:00Z' },
      { id: 'vc-5', name: 'Re-engage Cold Leads', leadSource: 'all_leads', scriptId: 'reengagement', scriptName: 'Re-engagement', assignedAgentId: null, assignedAgentName: 'Sarah Chen', status: 'draft', scheduledDate: null, scheduledTime: null, leadCount: 215, callsPlaced: 0, callsConnected: 0, appointmentsBooked: 0, clientsSigned: 0, createdAt: '2026-03-16T10:00:00Z' },
    ];

    this.allCalls = [
      { id: 'call-1', leadId: 'l1', phoneNumber: '(214) 555-0142', callSid: null, provider: 'vapi', status: 'completed', outcome: 'qualified_lead', startedAt: `${today}T14:22:00Z`, endedAt: `${today}T14:26:12Z`, durationSeconds: 252, transcriptUrl: null, transcriptSummary: 'Homeowner interested in free inspection. Scheduled for Thursday.', qualificationData: null, nextAction: 'Schedule inspection', assignedAdjusterId: null, assignedAdjusterName: 'AI Voice Agent', createdAt: `${today}T14:22:00Z` },
      { id: 'call-2', leadId: 'l2', phoneNumber: '(817) 555-0283', callSid: null, provider: 'vapi', status: 'completed', outcome: 'left_voicemail', startedAt: `${today}T13:45:00Z`, endedAt: `${today}T13:45:42Z`, durationSeconds: 42, transcriptUrl: null, transcriptSummary: 'Left voicemail about storm damage inspection.', qualificationData: null, nextAction: 'Follow up in 2 hours', assignedAdjusterId: null, assignedAdjusterName: 'AI Voice Agent', createdAt: `${today}T13:45:00Z` },
      { id: 'call-3', leadId: 'l3', phoneNumber: '(682) 555-0391', callSid: null, provider: 'vapi', status: 'completed', outcome: 'not_interested', startedAt: `${today}T13:15:00Z`, endedAt: `${today}T13:16:30Z`, durationSeconds: 90, transcriptUrl: null, transcriptSummary: 'Homeowner declined — already has a contractor.', qualificationData: null, nextAction: null, assignedAdjusterId: null, assignedAdjusterName: 'Marcus Rivera', createdAt: `${today}T13:15:00Z` },
      { id: 'call-4', leadId: 'l4', phoneNumber: '(972) 555-0417', callSid: null, provider: 'vapi', status: 'no_answer', outcome: 'no_answer', startedAt: `${today}T12:30:00Z`, endedAt: `${today}T12:30:28Z`, durationSeconds: 28, transcriptUrl: null, transcriptSummary: null, qualificationData: null, nextAction: 'Retry in 2 hours', assignedAdjusterId: null, assignedAdjusterName: 'AI Voice Agent', createdAt: `${today}T12:30:00Z` },
      { id: 'call-5', leadId: 'l5', phoneNumber: '(469) 555-0528', callSid: null, provider: 'vapi', status: 'connected', outcome: null, startedAt: `${today}T14:50:00Z`, endedAt: null, durationSeconds: null, transcriptUrl: null, transcriptSummary: null, qualificationData: null, nextAction: null, assignedAdjusterId: null, assignedAdjusterName: 'AI Voice Agent', createdAt: `${today}T14:50:00Z` },
      { id: 'call-6', leadId: 'l6', phoneNumber: '(214) 555-0636', callSid: null, provider: 'vapi', status: 'completed', outcome: 'possible_claim', startedAt: `${today}T11:00:00Z`, endedAt: `${today}T11:04:18Z`, durationSeconds: 258, transcriptUrl: null, transcriptSummary: 'Water damage from recent flooding. Wants inspection ASAP.', qualificationData: null, nextAction: 'Book inspection', assignedAdjusterId: null, assignedAdjusterName: 'Angela Watts', createdAt: `${today}T11:00:00Z` },
      { id: 'call-7', leadId: 'l7', phoneNumber: '(469) 555-0744', callSid: null, provider: 'vapi', status: 'completed', outcome: 'call_back_later', startedAt: `${today}T10:20:00Z`, endedAt: `${today}T10:21:05Z`, durationSeconds: 65, transcriptUrl: null, transcriptSummary: 'Homeowner busy, asked to call back after 5 PM.', qualificationData: null, nextAction: 'Call back at 5 PM', assignedAdjusterId: null, assignedAdjusterName: 'David Kim', createdAt: `${today}T10:20:00Z` },
      { id: 'call-8', leadId: 'l8', phoneNumber: '(972) 555-0855', callSid: null, provider: 'vapi', status: 'voicemail', outcome: 'left_voicemail', startedAt: `${today}T09:45:00Z`, endedAt: `${today}T09:45:35Z`, durationSeconds: 35, transcriptUrl: null, transcriptSummary: 'Left voicemail re: hail damage inspection offer.', qualificationData: null, nextAction: 'SMS follow-up', assignedAdjusterId: null, assignedAdjusterName: 'AI Voice Agent', createdAt: `${today}T09:45:00Z` },
      { id: 'call-9', leadId: 'l9', phoneNumber: '(214) 555-0963', callSid: null, provider: 'vapi', status: 'completed', outcome: 'existing_client', startedAt: `${today}T09:10:00Z`, endedAt: `${today}T09:15:47Z`, durationSeconds: 347, transcriptUrl: null, transcriptSummary: 'Signed retainer agreement. Scheduled initial assessment for Monday.', qualificationData: null, nextAction: 'Process signed contract', assignedAdjusterId: null, assignedAdjusterName: 'Sarah Chen', createdAt: `${today}T09:10:00Z` },
      { id: 'call-10', leadId: 'l10', phoneNumber: '(817) 555-1074', callSid: null, provider: 'vapi', status: 'completed', outcome: 'qualified_lead', startedAt: `${today}T08:30:00Z`, endedAt: `${today}T08:34:22Z`, durationSeconds: 262, transcriptUrl: null, transcriptSummary: 'Roof damage confirmed. Wants free inspection this week.', qualificationData: null, nextAction: 'Schedule inspection', assignedAdjusterId: null, assignedAdjusterName: 'AI Voice Agent', createdAt: `${today}T08:30:00Z` },
      { id: 'call-11', leadId: 'l11', phoneNumber: '(682) 555-1185', callSid: null, provider: 'vapi', status: 'no_answer', outcome: 'no_answer', startedAt: `${today}T08:00:00Z`, endedAt: `${today}T08:00:30Z`, durationSeconds: 30, transcriptUrl: null, transcriptSummary: null, qualificationData: null, nextAction: 'Retry in 3 hours', assignedAdjusterId: null, assignedAdjusterName: 'AI Voice Agent', createdAt: `${today}T08:00:00Z` },
      { id: 'call-12', leadId: 'l12', phoneNumber: '(469) 555-1296', callSid: null, provider: 'vapi', status: 'ringing', outcome: null, startedAt: `${today}T14:55:00Z`, endedAt: null, durationSeconds: null, transcriptUrl: null, transcriptSummary: null, qualificationData: null, nextAction: null, assignedAdjusterId: null, assignedAdjusterName: 'AI Voice Agent', createdAt: `${today}T14:55:00Z` },
    ];

    this.availableLeads = [
      { id: 'l1', name: 'Robert Chen', phone: '(214) 555-0142', source: 'Storm Intel', peril: 'Hail', address: '4521 Maple Dr, Dallas TX', selected: false },
      { id: 'l2', name: 'Maria Gonzalez', phone: '(817) 555-0283', source: 'Fire Incidents', peril: 'Wind', address: '892 Elm St, Fort Worth TX', selected: false },
      { id: 'l3', name: 'James Parker', phone: '(682) 555-0391', source: 'Lead Rotation', peril: 'Hail', address: '2100 Oak Ridge Blvd, Arlington TX', selected: false },
      { id: 'l4', name: 'Patricia Williams', phone: '(972) 555-0417', source: 'Storm Intel', peril: 'Fire', address: '567 Pine Ave, Plano TX', selected: false },
      { id: 'l5', name: 'David Thompson', phone: '(469) 555-0528', source: 'Storm Intel', peril: 'Wind', address: '1890 Cedar Ln, Garland TX', selected: false },
      { id: 'l6', name: 'Susan Mitchell', phone: '(214) 555-0636', source: 'Fire Incidents', peril: 'Flood', address: '745 Birch Ct, Irving TX', selected: false },
      { id: 'l7', name: 'Michael Brown', phone: '(469) 555-0744', source: 'Lead Rotation', peril: 'Hail', address: '310 Walnut Dr, Frisco TX', selected: false },
      { id: 'l8', name: 'Jennifer Davis', phone: '(972) 555-0855', source: 'Storm Intel', peril: 'Hail', address: '1488 Pecan St, McKinney TX', selected: false },
      { id: 'l9', name: 'William Johnson', phone: '(214) 555-0963', source: 'Fire Incidents', peril: 'Fire', address: '2250 Ash Blvd, Richardson TX', selected: false },
      { id: 'l10', name: 'Linda Martinez', phone: '(817) 555-1074', source: 'Storm Intel', peril: 'Wind', address: '887 Spruce Way, Denton TX', selected: false },
      { id: 'l11', name: 'Thomas Anderson', phone: '(682) 555-1185', source: 'Lead Rotation', peril: 'Hail', address: '3320 Birch Ln, Mansfield TX', selected: false },
      { id: 'l12', name: 'Karen Wilson', phone: '(469) 555-1296', source: 'Storm Intel', peril: 'Flood', address: '5501 Oak St, Mesquite TX', selected: false },
    ];
  }
}
