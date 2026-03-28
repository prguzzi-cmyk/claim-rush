import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LeadService } from 'src/app/services/leads.service';
import { OUTCOME_CATEGORIES, OutcomeOption } from 'src/app/models/lead-outcome.model';

@Component({
    selector: 'app-record-result-dialog',
    templateUrl: './record-result-dialog.component.html',
    styleUrls: ['./record-result-dialog.component.scss'],
    standalone: false
})
export class RecordResultDialogComponent implements OnInit {
  lead_id: string;
  formDisabled = false;
  outcomeCategories = OUTCOME_CATEGORIES;
  categoryKeys = Object.keys(OUTCOME_CATEGORIES);
  showAppointmentDate = false;
  showCallbackDate = false;
  selectedOption: OutcomeOption | null = null;

  outcomeForm = new FormGroup({
    outcome_status: new FormControl('', [Validators.required]),
    notes: new FormControl(''),
    appointment_date: new FormControl(null),
    callback_date: new FormControl(null),
    callback_time: new FormControl(''),
  });

  constructor(
    private dialogRef: MatDialogRef<RecordResultDialogComponent>,
    private leadService: LeadService,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data?.lead?.id) {
      this.lead_id = data.lead.id;
    }
  }

  ngOnInit(): void {
    this.outcomeForm.get('outcome_status')?.valueChanges.subscribe(value => {
      this.selectedOption = this.findOption(value);
      this.showAppointmentDate = value === 'appointment-scheduled';
      this.showCallbackDate = value === 'call-back-later-today' || value === 'call-back-tomorrow';

      if (this.showAppointmentDate) {
        this.outcomeForm.get('appointment_date')?.setValidators([Validators.required]);
      } else {
        this.outcomeForm.get('appointment_date')?.clearValidators();
        this.outcomeForm.get('appointment_date')?.setValue(null);
      }
      this.outcomeForm.get('appointment_date')?.updateValueAndValidity();

      if (!this.showCallbackDate) {
        this.outcomeForm.get('callback_date')?.setValue(null);
        this.outcomeForm.get('callback_time')?.setValue('');
      }
    });
  }

  private findOption(value: string): OutcomeOption | null {
    for (const key of this.categoryKeys) {
      const found = this.outcomeCategories[key].find(o => o.value === value);
      if (found) return found;
    }
    return null;
  }

  submit() {
    if (!this.outcomeForm.valid) return;

    this.formDisabled = true;
    const formValue = this.outcomeForm.value;

    const payload: any = {
      outcome_status: formValue.outcome_status,
    };
    if (formValue.notes) {
      payload.notes = formValue.notes;
    }
    if (formValue.appointment_date) {
      payload.appointment_date = new Date(formValue.appointment_date).toISOString();
    }
    if (formValue.callback_date) {
      const cbDate = new Date(formValue.callback_date);
      if (formValue.callback_time) {
        const [hours, minutes] = formValue.callback_time.split(':').map(Number);
        cbDate.setHours(hours || 0, minutes || 0);
      }
      payload.callback_date = cbDate.toISOString();
    }

    this.leadService.recordOutcome(this.lead_id, payload).subscribe({
      next: (result) => {
        this.formDisabled = false;
        this.snackBar.open('Outcome recorded successfully', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });

        if (result?.automation_triggered) {
          this.snackBar.open(
            'Automation triggered: ' + result.automation_triggered,
            'Close',
            { duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom' }
          );
        }

        this.dialogRef.close(true);
      },
      error: (err) => {
        this.formDisabled = false;
        this.snackBar.open('Failed to record outcome', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      }
    });
  }

  close() {
    this.dialogRef.close(false);
  }
}
