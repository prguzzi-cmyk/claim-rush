import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { FireIncident, SkipTraceResident } from 'src/app/models/fire-incident.model';
import { FireIncidentService } from 'src/app/services/fire-incident.service';

const SKIP_TRACE_CALL_TYPES = ['SF', 'CF'];

@Component({
  selector: 'app-convert-to-lead-dialog',
  templateUrl: './convert-to-lead-dialog.component.html',
  styleUrls: ['./convert-to-lead-dialog.component.scss'],
  standalone: false,
})
export class ConvertToLeadDialogComponent implements OnInit {
  form: FormGroup;
  isSubmitting = false;

  // Skip trace state
  isLoadingSkipTrace = false;
  skipTraceEnabled = false;
  residents: SkipTraceResident[] = [];
  selectedResidentIndex: number | null = null;
  skipTraceSource = '';

  constructor(
    private dialogRef: MatDialogRef<ConvertToLeadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { incident: FireIncident },
    private fb: FormBuilder,
    private fireIncidentService: FireIncidentService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    const incident = this.data.incident;
    this.form = this.fb.group({
      full_name: ['', Validators.required],
      phone_number: ['', Validators.required],
      email: [''],
      peril: [incident.call_type_description || incident.call_type || ''],
      loss_date: [incident.received_at ? new Date(incident.received_at) : null],
      insurance_company: [''],
      instructions_or_notes: [''],
    });

    // Auto skip trace for eligible call types
    const callType = (incident.call_type || '').toUpperCase();
    if (SKIP_TRACE_CALL_TYPES.includes(callType)) {
      this.skipTraceEnabled = true;
      this.runSkipTrace();
    }
  }

  runSkipTrace(): void {
    this.isLoadingSkipTrace = true;
    this.fireIncidentService.skipTrace(this.data.incident.id).subscribe({
      next: (response) => {
        this.isLoadingSkipTrace = false;
        this.skipTraceSource = response.source;
        if (response.residents && response.residents.length > 0) {
          this.residents = response.residents;
          this.selectResident(0);
        }
      },
      error: () => {
        this.isLoadingSkipTrace = false;
        // Silently fail — user can still manually enter info
      },
    });
  }

  selectResident(index: number): void {
    if (index < 0 || index >= this.residents.length) return;
    this.selectedResidentIndex = index;
    const resident = this.residents[index];

    this.form.patchValue({
      full_name: resident.full_name,
      phone_number: resident.phone_numbers.length > 0 ? resident.phone_numbers[0] : '',
      email: resident.emails.length > 0 ? resident.emails[0] : '',
    });
  }

  selectPhone(phone: string): void {
    this.form.patchValue({ phone_number: phone });
  }

  selectEmail(email: string): void {
    this.form.patchValue({ email: email });
  }

  get isSkipTraced(): boolean {
    return this.residents.length > 0 && this.selectedResidentIndex !== null;
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.isSubmitting = true;

    const val = this.form.value;
    const payload: any = {
      full_name: val.full_name,
      phone_number: val.phone_number,
      skip_traced: this.isSkipTraced,
    };
    if (val.email) payload.email = val.email;
    if (val.peril) payload.peril = val.peril;
    if (val.loss_date) {
      payload.loss_date = val.loss_date instanceof Date
        ? val.loss_date.toISOString()
        : val.loss_date;
    }
    if (val.insurance_company) payload.insurance_company = val.insurance_company;
    if (val.instructions_or_notes) payload.instructions_or_notes = val.instructions_or_notes;

    this.fireIncidentService.convertToLead(this.data.incident.id, payload).subscribe({
      next: (lead) => {
        this.isSubmitting = false;
        this.snackBar.open('Lead created successfully!', 'View Lead', { duration: 5000 })
          .onAction()
          .subscribe(() => {
            this.router.navigate(['/app/leads', lead.id]);
          });
        this.dialogRef.close({ converted: true, lead });
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err.error?.detail || 'Failed to convert incident to lead.';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
