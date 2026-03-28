import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FireIncident, PropertyIntelligence } from 'src/app/models/fire-incident.model';
import { FireIncidentService } from 'src/app/services/fire-incident.service';
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

  // Action state
  smsSending = false;
  smsSent = false;
  skipTraceRunning = false;
  smsMessage = '';

  private readonly defaultSmsTemplate =
    'Hi {owner_name}, this is UPA. We noticed a fire incident at your property. We help homeowners with insurance claims at no upfront cost. Reply YES if you\'d like to learn more.';

  constructor(
    private fireIncidentService: FireIncidentService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['incident'] && this.incident) {
      this.smsSent = false;
      this.loadIntelligence();
    }
  }

  loadIntelligence(): void {
    if (!this.incident) return;
    this.isLoading = true;
    this.errorMsg = null;
    this.intel = null;

    this.fireIncidentService.getPropertyIntelligence(this.incident.id).subscribe({
      next: (data) => {
        this.intel = data;
        this.isLoading = false;
        this.buildSmsMessage();
      },
      error: () => {
        this.errorMsg = 'Unable to load property intelligence.';
        this.isLoading = false;
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  // --- Action Methods ---

  buildSmsMessage(): void {
    const ownerName = this.intel?.owner_name || 'there';
    this.smsMessage = this.defaultSmsTemplate.replace('{owner_name}', ownerName);
  }

  sendSms(): void {
    if (!this.incident || !this.intel?.phone || this.smsSending) return;
    this.smsSending = true;

    this.fireIncidentService.sendOutreachSms(
      this.incident.id,
      this.intel.phone,
      this.smsMessage,
    ).subscribe({
      next: (res) => {
        this.smsSending = false;
        this.smsSent = true;
        this.snackBar.open(
          res.success ? 'SMS sent successfully' : `SMS failed: ${res.message}`,
          'OK',
          { duration: 4000 },
        );
      },
      error: (err) => {
        this.smsSending = false;
        this.snackBar.open(
          err.error?.detail || 'Failed to send SMS',
          'OK',
          { duration: 4000 },
        );
      },
    });
  }

  runSkipTrace(): void {
    if (!this.incident || this.skipTraceRunning) return;
    this.skipTraceRunning = true;

    this.fireIncidentService.skipTrace(this.incident.id).subscribe({
      next: (result) => {
        this.skipTraceRunning = false;
        if (result.residents && result.residents.length > 0) {
          this.snackBar.open('Skip trace completed — owner data found', 'OK', { duration: 3000 });
          // Reload intelligence to pick up new data
          this.loadIntelligence();
        } else {
          this.snackBar.open('Skip trace completed — no residents found', 'OK', { duration: 3000 });
        }
      },
      error: () => {
        this.skipTraceRunning = false;
        this.snackBar.open('Skip trace failed', 'OK', { duration: 3000 });
      },
    });
  }

  openConvertToLead(): void {
    if (!this.incident) return;
    this.dialog.open(ConvertToLeadDialogComponent, {
      width: '500px',
      data: { incident: this.incident, intel: this.intel },
    });
  }

  // --- Status Helpers ---

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
}
