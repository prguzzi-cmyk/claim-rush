import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { DataRequestResponse } from '../core/settlement-iq.models';
import { SettlementIqService } from '../core/settlement-iq.service';

/**
 * Data-removal request — right-to-delete by email.
 *
 * POSTs to /v1/settlement-iq/data-request. The backend hashes the
 * email, finds matching scans (if any), bumps their purge_scheduled_at
 * forward by 24 hours, and writes an AUDIT_RIGHT_TO_DELETE event for
 * each match. The endpoint does NOT confirm whether a match was
 * found — the response always carries the same shape so it can't be
 * used as an oracle for "is this email in the system?"
 */
@Component({
  selector: 'si-data-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './data-request.component.html',
  styleUrls: ['./data-request.component.scss'],
})
export class DataRequestComponent {
  isSubmitting = false;
  submitted = false;
  response: DataRequestResponse | null = null;
  errorMessage: string | null = null;

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly service: SettlementIqService,
  ) {}

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    this.errorMessage = null;
    this.service.submitDataRequest(this.form.value.email!).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.submitted = true;
        this.response = res;
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.errorMessage =
          err.status === 0
            ? 'Could not reach the service. Check your connection and try again.'
            : 'Could not submit your request. Please try again in a moment.';
      },
    });
  }
}
