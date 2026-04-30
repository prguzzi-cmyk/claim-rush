import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LaunchControlService } from '../../../../services/launch-control.service';
import { EnrollResponse, EnrollTerritoryInput } from '../../../../models/launch-control.model';

type Step = 'form' | 'success';

@Component({
  selector: 'app-enroll-user-dialog',
  templateUrl: './enroll-user-dialog.component.html',
  styleUrls: ['./enroll-user-dialog.component.scss'],
  standalone: false,
})
export class EnrollUserDialogComponent {
  step: Step = 'form';
  saving = false;
  errorMessage: string | null = null;
  result: EnrollResponse | null = null;

  readonly roles = ['cp', 'rvp', 'agent'] as const;
  readonly territoryTypes = ['state', 'county', 'zip'] as const;

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private svc: LaunchControlService,
    private snack: MatSnackBar,
    private dialogRef: MatDialogRef<EnrollUserDialogComponent>,
  ) {
    this.form = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['cp', Validators.required],
      manager_email: [''],
      territories: this.fb.array([this.buildTerritoryGroup()]),
      password: [''],
    });
  }

  // ----- Territories FormArray ------------------------------------------

  get territories(): FormArray {
    return this.form.get('territories') as FormArray;
  }

  territoryGroupAt(i: number): FormGroup {
    return this.territories.at(i) as FormGroup;
  }

  private buildTerritoryGroup(): FormGroup {
    return this.fb.group({
      territory_type: ['state', Validators.required],
      state: [''],
      county: [''],
      zip_code: [''],
    });
  }

  addTerritory(): void {
    this.territories.push(this.buildTerritoryGroup());
  }

  removeTerritory(i: number): void {
    if (this.territories.length <= 1) return;
    this.territories.removeAt(i);
  }

  // ----- Submit ---------------------------------------------------------

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const cleaned: EnrollTerritoryInput[] = [];

    for (let i = 0; i < this.territories.length; i++) {
      const t = this.territories.at(i).value;
      const ttype = t.territory_type as 'state' | 'county' | 'zip';
      const state = (t.state || '').trim().toUpperCase() || null;
      const county = (t.county || '').trim() || null;
      const zip = (t.zip_code || '').trim() || null;

      const label = `Territory #${i + 1}`;
      if (ttype === 'state' && !state) {
        this.errorMessage = `${label}: state is required.`;
        return;
      }
      if (ttype === 'county' && !(state && county)) {
        this.errorMessage = `${label}: state and county are required.`;
        return;
      }
      if (ttype === 'zip' && !zip) {
        this.errorMessage = `${label}: ZIP is required.`;
        return;
      }
      cleaned.push({ territory_type: ttype, state, county, zip_code: zip });
    }

    if (cleaned.length === 0) {
      this.errorMessage = 'At least one territory is required.';
      return;
    }

    this.errorMessage = null;
    this.saving = true;
    this.svc
      .enroll({
        full_name: v.full_name.trim(),
        email: v.email.trim(),
        role: v.role,
        manager_email: (v.manager_email || '').trim() || null,
        territories: cleaned,
        password: (v.password || '').trim() || null,
      })
      .subscribe({
        next: (resp) => {
          this.result = resp;
          this.step = 'success';
          this.saving = false;
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err?.error?.detail || 'Enrollment failed. Please try again.';
        },
      });
  }

  // -- Success-card actions ----------------------------------------------

  openPortal(): void {
    if (!this.result) return;
    window.open(this.result.portal_url, '_blank', 'noopener');
  }

  openIntake(): void {
    if (!this.result?.intake_url) return;
    window.open(this.result.intake_url, '_blank', 'noopener');
  }

  copyLogin(): void {
    if (!this.result) return;
    const summary =
      `Login URL:    ${this.result.login_url}\n` +
      `Email:        ${this.result.login_email}\n` +
      `Password:     ${this.result.temporary_password}\n` +
      `Portal URL:   ${this.result.portal_url}\n` +
      `Intake URL:   ${this.result.intake_url || '(none)'}\n`;
    navigator.clipboard?.writeText(summary).then(
      () => this.snack.open('Login info copied to clipboard', 'OK', { duration: 2000 }),
      () => this.snack.open('Could not copy', 'Dismiss', { duration: 2500 }),
    );
  }

  close(refreshList: boolean = false): void {
    this.dialogRef.close({ enrolled: refreshList && !!this.result, result: this.result });
  }

  resetForAnother(): void {
    this.result = null;
    this.step = 'form';
    this.form.reset({
      full_name: '', email: '', role: 'cp', manager_email: '', password: '',
    });
    while (this.territories.length > 1) this.territories.removeAt(1);
    this.territoryGroupAt(0).reset({
      territory_type: 'state', state: '', county: '', zip_code: '',
    });
  }

  // Display helpers -------------------------------------------------------

  territorySummary(r: EnrollResponse): string {
    if (r.territories && r.territories.length > 0) {
      return r.territories.map((t) => t.value).join(', ');
    }
    const parts: string[] = [r.territory_type];
    if (r.territory_state) parts.push(r.territory_state);
    if (r.territory_county) parts.push(r.territory_county);
    if (r.territory_zip) parts.push(r.territory_zip);
    return parts.join(' · ');
  }
}
