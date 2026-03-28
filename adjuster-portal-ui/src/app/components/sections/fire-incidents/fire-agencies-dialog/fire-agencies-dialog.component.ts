import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FireAgency } from 'src/app/models/fire-incident.model';
import { FireIncidentService } from 'src/app/services/fire-incident.service';

@Component({
  selector: 'app-fire-agencies-dialog',
  templateUrl: './fire-agencies-dialog.component.html',
  styleUrls: ['./fire-agencies-dialog.component.scss'],
  standalone: false,
})
export class FireAgenciesDialogComponent implements OnInit {
  agencies: FireAgency[] = [];
  addForm: FormGroup;
  isAdding = false;
  isPolling: { [id: string]: boolean } = {};

  constructor(
    private dialogRef: MatDialogRef<FireAgenciesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { agencies: FireAgency[] },
    private fb: FormBuilder,
    private fireIncidentService: FireIncidentService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.agencies = [...(this.data.agencies || [])];
    this.addForm = this.fb.group({
      agency_id: ['', [Validators.required, Validators.maxLength(50)]],
      name: ['', [Validators.required, Validators.maxLength(200)]],
      state: ['', [Validators.maxLength(2)]],
    });
  }

  addAgency(): void {
    if (this.addForm.invalid) return;
    this.isAdding = true;
    this.fireIncidentService.addAgency(this.addForm.value).subscribe({
      next: (agency) => {
        this.agencies = [...this.agencies, agency];
        this.addForm.reset();
        this.isAdding = false;
        this.snackBar.open(`Agency "${agency.name}" added.`, 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.isAdding = false;
        const msg = err?.error?.detail || 'Failed to add agency.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  toggleActive(agency: FireAgency): void {
    this.fireIncidentService
      .updateAgency(agency.id, { is_active: !agency.is_active })
      .subscribe({
        next: (updated) => {
          const idx = this.agencies.findIndex((a) => a.id === updated.id);
          if (idx !== -1) this.agencies[idx] = updated;
          this.agencies = [...this.agencies];
        },
        error: () => {
          this.snackBar.open('Failed to update agency.', 'Close', { duration: 3000 });
        },
      });
  }

  pollNow(agency: FireAgency): void {
    this.isPolling[agency.id] = true;
    this.fireIncidentService.pollAgency(agency.id).subscribe({
      next: (res) => {
        this.isPolling[agency.id] = false;
        this.snackBar.open(res?.msg || 'Poll complete.', 'OK', { duration: 4000 });
      },
      error: () => {
        this.isPolling[agency.id] = false;
        this.snackBar.open('Poll failed. RIN network may be unavailable.', 'Close', { duration: 4000 });
      },
    });
  }

  deleteAgency(agency: FireAgency): void {
    if (!confirm(`Delete agency "${agency.name}"? This will also delete all associated incidents.`)) return;
    this.fireIncidentService.deleteAgency(agency.id).subscribe({
      next: () => {
        this.agencies = this.agencies.filter((a) => a.id !== agency.id);
        this.snackBar.open('Agency deleted.', 'OK', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete agency.', 'Close', { duration: 3000 });
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
