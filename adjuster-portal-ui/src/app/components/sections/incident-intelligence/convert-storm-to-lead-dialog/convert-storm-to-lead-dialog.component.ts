import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { StormEvent } from 'src/app/models/storm-event.model';
import { StormDataService } from 'src/app/services/storm-data.service';

@Component({
  selector: 'app-convert-storm-to-lead-dialog',
  templateUrl: './convert-storm-to-lead-dialog.component.html',
  styleUrls: ['./convert-storm-to-lead-dialog.component.scss'],
  standalone: false,
})
export class ConvertStormToLeadDialogComponent implements OnInit {
  form!: FormGroup;
  isSubmitting = false;

  constructor(
    private dialogRef: MatDialogRef<ConvertStormToLeadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { event: StormEvent },
    private fb: FormBuilder,
    private stormService: StormDataService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const event = this.data.event;
    const reportedAt: any = event.reported_at;
    const reportedDate = reportedAt instanceof Date
      ? reportedAt
      : (reportedAt ? new Date(reportedAt) : null);

    this.form = this.fb.group({
      full_name: ['', Validators.required],
      phone_number: ['', Validators.required],
      email: [''],
      address_loss: ['', Validators.required],
      peril: [event.event_type || ''],
      loss_date: [reportedDate],
      insurance_company: [''],
      instructions_or_notes: [''],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.isSubmitting = true;

    const val = this.form.value;
    const payload: any = {
      full_name: val.full_name,
      phone_number: val.phone_number,
      address_loss: val.address_loss,
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

    this.stormService.convertToLead(this.data.event.id, payload).subscribe({
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
        const msg = err?.error?.detail || 'Failed to convert storm event to lead.';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
