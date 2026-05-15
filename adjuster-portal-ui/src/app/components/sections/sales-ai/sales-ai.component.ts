import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

// ── Interfaces ───────────────────────────────────────────────────────
export type WorkflowStage =
  | 'lead_detected'
  | 'ai_qualification'
  | 'meeting_scheduled'
  | 'contract_handoff'
  | 'client_file_created';

export interface SalesLead {
  id: string;
  leadName: string;
  incidentType: string;
  propertyAddress: string;
  city: string;
  state: string;
  contactStatus: 'not_contacted' | 'contacted' | 'follow_up' | 'converted';
  qualificationStatus: 'pending' | 'qualified' | 'disqualified';
  notes: string;
  stage: WorkflowStage;
  aiScore: number | null;
  createdAt: string;
  assignedAgent: string;
}

export interface MeetingBooking {
  id: string;
  leadId: string;
  leadName: string;
  meetingDate: string;
  meetingTime: string;
  assignedAgent: string;
  meetingType: 'teams' | 'zoom' | 'google_meet' | 'phone_call';
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string;
}

export interface ContractHandoff {
  id: string;
  leadId: string;
  leadName: string;
  contractStatus: 'pending_review' | 'sent_for_signing' | 'signed' | 'client_file_created';
  sentAt: string | null;
  signedAt: string | null;
  clientFileId: string | null;
  assignedAgent: string;
}

interface WorkflowNode {
  stage: WorkflowStage;
  label: string;
  icon: string;
  count: number;
}

// ── Component ────────────────────────────────────────────────────────
@Component({
  selector: 'app-sales-ai',
  templateUrl: './sales-ai.component.html',
  styleUrls: ['./sales-ai.component.scss'],
  standalone: false,
})
export class SalesAiComponent implements OnInit {

  // Workflow
  workflowNodes: WorkflowNode[] = [];

  // Leads
  leads: SalesLead[] = [];
  selectedLead: SalesLead | null = null;
  qualifyingId: string | null = null;

  // Meetings
  meetings: MeetingBooking[] = [];
  meetingForm = { date: '', time: '', agent: '', type: 'teams' as MeetingBooking['meetingType'], notes: '' };
  timeSlots: string[] = [];
  // Empty until a real agent-roster endpoint is wired. Was previously
  // seeded with 5 fake agent names (Sarah Mitchell, James Carter, Maria
  // Santos, David Kim, Emily Parker) that appeared in the meeting-
  // scheduler dropdown — operators could pick a fake name to "schedule"
  // a meeting that resolved against nobody.
  agents: string[] = [];
  meetingTypes: { value: MeetingBooking['meetingType']; label: string }[] = [
    { value: 'teams', label: 'Microsoft Teams' },
    { value: 'zoom', label: 'Zoom' },
    { value: 'google_meet', label: 'Google Meet' },
    { value: 'phone_call', label: 'Phone Call' },
  ];

  // Contracts
  contracts: ContractHandoff[] = [];

  constructor(private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.buildTimeSlots();
    this.loadMockData();
    this.refreshWorkflow();
  }

  // ── Time Slots ─────────────────────────────────────────────────────
  private buildTimeSlots(): void {
    for (let h = 8; h <= 17; h++) {
      for (const m of ['00', '30']) {
        if (h === 17 && m === '30') continue;
        const suffix = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : h;
        this.timeSlots.push(`${displayHour}:${m} ${suffix}`);
      }
    }
  }

  // No-op until a real backend endpoint is wired. Was previously seeded
  // with 5 fake leads (Robert Williams, Jennifer Martinez, Michael
  // Thompson, Lisa Anderson, Thomas Garcia), 2 fake scheduled meetings
  // (Teams + Zoom), and 3 fake contracts INCLUDING one in "signed"
  // state — which had real legal-implication risk if shown to a
  // prospect as evidence of platform activity.
  private loadMockData(): void {
    this.leads = [];
    this.meetings = [];
    this.contracts = [];
  }

  // ── Workflow Bar ───────────────────────────────────────────────────
  refreshWorkflow(): void {
    const stages: { stage: WorkflowStage; label: string; icon: string }[] = [
      { stage: 'lead_detected', label: 'Lead Detected', icon: 'person_search' },
      { stage: 'ai_qualification', label: 'AI Qualification', icon: 'psychology' },
      { stage: 'meeting_scheduled', label: 'Meeting Scheduled', icon: 'event' },
      { stage: 'contract_handoff', label: 'Contract Handoff', icon: 'description' },
      { stage: 'client_file_created', label: 'Client File Created', icon: 'folder_shared' },
    ];
    this.workflowNodes = stages.map(s => ({
      ...s,
      count: this.leads.filter(l => l.stage === s.stage).length,
    }));
  }

  // ── Lead Selection ─────────────────────────────────────────────────
  selectLead(lead: SalesLead): void {
    this.selectedLead = this.selectedLead?.id === lead.id ? null : lead;
    if (this.selectedLead) {
      this.meetingForm.agent = this.selectedLead.assignedAgent;
    }
  }

  // ── AI Qualification ───────────────────────────────────────────────
  startQualification(lead: SalesLead): void {
    if (this.qualifyingId) return;
    this.qualifyingId = lead.id;
    setTimeout(() => {
      const score = Math.floor(Math.random() * 41) + 60; // 60–100
      lead.aiScore = score;
      lead.qualificationStatus = score >= 70 ? 'qualified' : 'disqualified';
      lead.stage = 'ai_qualification';
      this.qualifyingId = null;
      this.refreshWorkflow();
      this.snackBar.open(
        `AI Score: ${score} — ${lead.leadName} ${lead.qualificationStatus}`,
        'OK', { duration: 3500 }
      );
    }, 1500);
  }

  // ── Meeting Scheduler ──────────────────────────────────────────────
  scheduleMeeting(): void {
    if (!this.selectedLead) return;
    const f = this.meetingForm;
    if (!f.date || !f.time || !f.agent || !f.type) {
      this.snackBar.open('Please fill all required meeting fields', 'OK', { duration: 3000 });
      return;
    }
    const booking: MeetingBooking = {
      id: 'M' + String(this.meetings.length + 1).padStart(3, '0'),
      leadId: this.selectedLead.id,
      leadName: this.selectedLead.leadName,
      meetingDate: f.date,
      meetingTime: f.time,
      assignedAgent: f.agent,
      meetingType: f.type,
      status: 'scheduled',
      notes: f.notes,
    };
    this.meetings.unshift(booking);
    this.selectedLead.stage = 'meeting_scheduled';
    this.refreshWorkflow();
    this.meetingForm = { date: '', time: '', agent: '', type: 'teams', notes: '' };
    this.snackBar.open(`Meeting scheduled for ${booking.leadName}`, 'OK', { duration: 3500 });
  }

  // ── Contract Actions ───────────────────────────────────────────────
  sendForSigning(contract: ContractHandoff): void {
    contract.contractStatus = 'sent_for_signing';
    contract.sentAt = new Date().toISOString();
    const lead = this.leads.find(l => l.id === contract.leadId);
    if (lead) { lead.stage = 'contract_handoff'; this.refreshWorkflow(); }
    this.snackBar.open(`Document sent for signature — ${contract.leadName}`, 'OK', { duration: 3500 });
  }

  markSigned(contract: ContractHandoff): void {
    contract.contractStatus = 'signed';
    contract.signedAt = new Date().toISOString();
    this.snackBar.open(`Contract signed by ${contract.leadName}`, 'OK', { duration: 3500 });
  }

  createClientFile(contract: ContractHandoff): void {
    contract.contractStatus = 'client_file_created';
    contract.clientFileId = 'CF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const lead = this.leads.find(l => l.id === contract.leadId);
    if (lead) { lead.stage = 'client_file_created'; this.refreshWorkflow(); }
    this.snackBar.open(`Client file ${contract.clientFileId} created for ${contract.leadName}`, 'OK', { duration: 3500 });
  }

  // ── Helpers ────────────────────────────────────────────────────────
  getContactBadgeClass(status: string): string {
    const m: Record<string, string> = { not_contacted: 'badge-orange', contacted: 'badge-blue', follow_up: 'badge-yellow', converted: 'badge-green' };
    return m[status] || 'badge-muted';
  }

  getQualBadgeClass(status: string): string {
    const m: Record<string, string> = { pending: 'badge-muted', qualified: 'badge-green', disqualified: 'badge-red' };
    return m[status] || 'badge-muted';
  }

  getContractBadgeClass(status: string): string {
    const m: Record<string, string> = { pending_review: 'badge-orange', sent_for_signing: 'badge-blue', signed: 'badge-green', client_file_created: 'badge-purple' };
    return m[status] || 'badge-muted';
  }

  formatContractStatus(status: string): string {
    const m: Record<string, string> = { pending_review: 'Pending Review', sent_for_signing: 'Sent for Signing', signed: 'Signed', client_file_created: 'Client File Created' };
    return m[status] || status;
  }

  formatContactStatus(status: string): string {
    const m: Record<string, string> = { not_contacted: 'Not Contacted', contacted: 'Contacted', follow_up: 'Follow Up', converted: 'Converted' };
    return m[status] || status;
  }

  formatMeetingType(type: string): string {
    const m: Record<string, string> = { teams: 'Teams', zoom: 'Zoom', google_meet: 'Google Meet', phone_call: 'Phone Call' };
    return m[type] || type;
  }

  timeAgo(ts: string): string {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
  }
}
