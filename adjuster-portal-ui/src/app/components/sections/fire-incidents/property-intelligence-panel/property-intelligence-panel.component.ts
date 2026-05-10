import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FireIncident, PropertyIntelligence } from 'src/app/models/fire-incident.model';
import { FireIncidentService } from 'src/app/services/fire-incident.service';
import {
  LeadTimelineResponse,
  OperationsService,
  TickerSeverity,
} from 'src/app/services/operations.service';
import { ConvertToLeadDialogComponent } from '../convert-to-lead-dialog/convert-to-lead-dialog.component';

@Component({
  selector: 'app-property-intelligence-panel',
  templateUrl: './property-intelligence-panel.component.html',
  styleUrls: ['./property-intelligence-panel.component.scss'],
  standalone: false,
})
export class PropertyIntelligencePanelComponent implements OnChanges {
  @Input() incident: FireIncident | null = null;
  @Output() closed = new EventEmitter<void>();

  intel: PropertyIntelligence | null = null;
  isLoading = false;
  errorMsg: string | null = null;

  // Orchestration data (Phase B-6a + Mission Control)
  leadTimeline: LeadTimelineResponse | null = null;
  isLoadingTimeline = false;
  timelineErrorMsg: string | null = null;

  // UI state
  timelineExpanded = false;

  severityClass: Record<TickerSeverity, string> = {
    critical: 'sev-critical',
    engagement: 'sev-engagement',
    info: 'sev-info',
    warning: 'sev-warning',
    muted: 'sev-muted',
  };

  constructor(
    private fireIncidentService: FireIncidentService,
    private operationsService: OperationsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['incident'] && this.incident) {
      this.leadTimeline = null;
      this.timelineErrorMsg = null;
      this.timelineExpanded = false;
      this.loadIntelligence();
      this.loadLeadTimeline();
    }
  }

  // ── Data loaders ────────────────────────────────────────────────
  loadIntelligence(): void {
    if (!this.incident) return;
    this.isLoading = true;
    this.errorMsg = null;
    this.intel = null;

    this.fireIncidentService.getPropertyIntelligence(this.incident.id).subscribe({
      next: (data) => {
        this.intel = data;
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'Unable to load property intelligence.';
        this.isLoading = false;
      },
    });
  }

  loadLeadTimeline(): void {
    // Only fetch when the incident has been converted to a lead.
    const leadId = this.incident?.lead_id;
    if (!leadId) {
      this.leadTimeline = null;
      return;
    }
    this.isLoadingTimeline = true;
    this.timelineErrorMsg = null;
    this.operationsService.leadTimeline(leadId).subscribe({
      next: (data) => {
        this.leadTimeline = data;
        this.isLoadingTimeline = false;
      },
      error: () => {
        this.timelineErrorMsg = 'Unable to load orchestration timeline.';
        this.isLoadingTimeline = false;
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  // ── Single allowed outreach action ──────────────────────────────
  // Opens the Convert-to-Lead dialog, which is the canonical entry
  // point to start an outreach sequence. The drawer itself is
  // read-only; this is the only mutation surface here.
  startOutreach(): void {
    if (!this.incident) return;
    this.dialog.open(ConvertToLeadDialogComponent, {
      width: '500px',
      data: { incident: this.incident, intel: this.intel },
    });
  }

  toggleTimeline(): void {
    this.timelineExpanded = !this.timelineExpanded;
  }

  // ── Display helpers ─────────────────────────────────────────────
  getStatusClass(status: string): string {
    switch (status) {
      case 'enriched': return 'status-enriched';
      case 'failed': return 'status-failed';
      default: return 'status-pending';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'enriched': return 'check_circle';
      case 'failed': return 'error';
      default: return 'schedule';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'enriched': return 'Enriched';
      case 'failed': return 'Enrichment Failed';
      default: return 'Pending Enrichment';
    }
  }

  getPhoneTypeClass(phoneType: string | null): string {
    if (!phoneType) return 'type-unknown';
    switch (phoneType.toLowerCase()) {
      case 'cell': return 'type-cell';
      case 'landline': return 'type-landline';
      default: return 'type-unknown';
    }
  }

  priorityClass(score: number | null | undefined): string {
    if (score == null) return 'pri-none';
    if (score >= 90) return 'pri-critical';
    if (score >= 70) return 'pri-high';
    if (score >= 40) return 'pri-med';
    return 'pri-low';
  }

  agoLabel(iso: string | null | undefined): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const sec = Math.max(0, (Date.now() - then) / 1000);
    if (sec < 60) return `${Math.round(sec)}s ago`;
    if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
    return `${Math.round(sec / 86400)}d ago`;
  }

  visibleTimelineEvents() {
    if (!this.leadTimeline) return [];
    const events = this.leadTimeline.timeline || [];
    return this.timelineExpanded ? events : events.slice(-10).reverse();
  }
}
