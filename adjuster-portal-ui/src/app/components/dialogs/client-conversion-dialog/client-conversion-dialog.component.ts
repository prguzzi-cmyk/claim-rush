import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LeadService } from 'src/app/services/leads.service';

@Component({
    selector: 'app-client-conversion-dialog',
    templateUrl: './client-conversion-dialog.component.html',
    styleUrls: ['./client-conversion-dialog.component.scss'],
    standalone: false
})
export class ClientConversionDialogComponent implements OnInit {
  leadId: string;
  leadName: string;
  formDisabled = false;

  conversionForm = new FormGroup({
    contract_sign_date: new FormControl(new Date()),
    fee_type: new FormControl('percentage'),
    fee: new FormControl(10.0),
    notes: new FormControl(''),
  });

  constructor(
    private dialogRef: MatDialogRef<ClientConversionDialogComponent>,
    private leadService: LeadService,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data?.lead) {
      this.leadId = data.lead.id;
      this.leadName = data.lead.contact?.full_name || 'Lead';
    }
  }

  ngOnInit(): void {}

  submit() {
    this.formDisabled = true;
    const formValue = this.conversionForm.value;

    const payload: any = {};
    if (formValue.contract_sign_date) {
      const d = new Date(formValue.contract_sign_date);
      payload.contract_sign_date = d.toISOString().split('T')[0];
    }
    if (formValue.fee_type) payload.fee_type = formValue.fee_type;
    if (formValue.fee != null) payload.fee = formValue.fee;
    if (formValue.notes) payload.notes = formValue.notes;

    this.leadService.convertLead(this.leadId, payload).subscribe({
      next: (result) => {
        this.formDisabled = false;
        this.snackBar.open('Lead converted to client successfully', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.formDisabled = false;
        const msg = err?.error?.detail || 'Failed to convert lead';
        this.snackBar.open(msg, 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      },
    });
  }

  close() {
    this.dialogRef.close(false);
  }
}
