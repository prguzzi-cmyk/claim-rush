import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RotationLeadService } from '../../../../services/rotation-lead.service';
import { RotationLead } from '../../../../models/rotation-lead.model';
import { VoiceOutreachEngineService } from '../../../../shared/services/voice-outreach-engine.service';

@Component({
  selector: 'app-initiate-call-dialog',
  templateUrl: './initiate-call-dialog.component.html',
  styleUrls: ['./initiate-call-dialog.component.scss'],
  standalone: false,
})
export class InitiateCallDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  leads: RotationLead[] = [];
  filteredLeads: RotationLead[] = [];
  searchTerm = '';
  selectedLead: RotationLead | null = null;
  phoneNumber = '';
  loading = true;
  initiating = false;

  constructor(
    private dialogRef: MatDialogRef<InitiateCallDialogComponent>,
    private rotationLeadService: RotationLeadService,
    private voiceService: VoiceOutreachEngineService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.rotationLeadService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.leads = Array.isArray(data) ? data : (data as any)?.items || [];
          this.filteredLeads = this.leads;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.snackBar.open('Failed to load leads', '', { duration: 3000 });
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  filterLeads(): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredLeads = this.leads.filter(l =>
      (l.owner_name || '').toLowerCase().includes(term) ||
      (l.phone || '').includes(term) ||
      (l.property_address || '').toLowerCase().includes(term)
    );
  }

  selectLead(lead: RotationLead): void {
    this.selectedLead = lead;
    this.phoneNumber = lead.phone || '';
  }

  initiateCall(): void {
    if (!this.selectedLead || !this.phoneNumber) return;
    this.initiating = true;

    const request = {
      leadId: this.selectedLead.id,
      phoneNumber: this.phoneNumber,
      leadContext: this.voiceService.buildLeadContext(this.selectedLead),
    };

    this.voiceService.initiateCall(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.initiating = false;
          if (res.success) {
            this.snackBar.open('Call initiated successfully', '', { duration: 3000 });
            this.dialogRef.close(res);
          } else {
            this.snackBar.open(res.error || 'Call initiation failed', '', { duration: 4000 });
          }
        },
        error: () => {
          this.initiating = false;
          this.snackBar.open('Call initiation failed', '', { duration: 3000 });
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
