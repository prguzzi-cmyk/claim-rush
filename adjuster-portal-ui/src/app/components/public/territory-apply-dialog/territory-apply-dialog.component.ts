import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface TerritoryApplyData {
  name: string;
  state: string | null;
  county: string | null;
  territory_type: string;
  applicationRole: 'chapter_president' | 'agent';
  dialogTitle: string;
}

@Component({
  selector: 'app-territory-apply-dialog',
  templateUrl: './territory-apply-dialog.component.html',
  styleUrls: ['./territory-apply-dialog.component.scss'],
  standalone: false,
})
export class TerritoryApplyDialogComponent {
  submitted = false;

  licenseOptions = ['Licensed', 'In Process', 'Not Licensed'];

  applyForm = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    lastName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    phone: new FormControl('', [Validators.required]),
    companyName: new FormControl(''),
    licenseStatus: new FormControl('', [Validators.required]),
    statesCovered: new FormControl(this.data?.state || ''),
    countiesCovered: new FormControl(
      this.data?.county || (this.data?.applicationRole === 'agent' ? 'To be assigned' : '')
    ),
    yearsExperience: new FormControl(''),
    notes: new FormControl(''),
  });

  constructor(
    private dialogRef: MatDialogRef<TerritoryApplyDialogComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: TerritoryApplyData
  ) {}

  onSubmit(): void {
    if (this.applyForm.invalid) return;

    const payload = {
      ...this.applyForm.value,
      territory: {
        name: this.data.name,
        state: this.data.state,
        county: this.data.county,
        type: this.data.territory_type,
      },
      applicationRole: this.data.applicationRole,
      submittedAt: new Date().toISOString(),
    };

    console.log('[Territory Application]', payload);

    this.submitted = true;
    this.snackBar.open('Application submitted successfully!', 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
