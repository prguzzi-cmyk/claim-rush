import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ConsultationRequestPayload } from '../../core/settlement-iq.models';
import { SettlementIqService } from '../../core/settlement-iq.service';

/**
 * Settlement IQ — Consultation Request form.
 *
 * Captures contact info + scan_id and POSTs to
 * /v1/settlement-iq/consultation. The backend handler is a Phase 1.5
 * follow-up (it will fan out to the tenant's configured PA firm by
 * tenant_id + scan context).
 *
 * Until the backend handler ships, submissions return 404. This
 * component handles that explicitly with a graceful fallback rather
 * than pretending the submission succeeded.
 */
@Component({
  selector: 'si-consultation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './consultation.component.html',
  styleUrls: ['./consultation.component.scss'],
})
export class ConsultationComponent implements OnInit {
  scanId: string | null = null;
  isSubmitting = false;
  submitted = false;
  fallbackMode = false;
  errorMessage: string | null = null;

  readonly form = this.fb.group({
    full_name: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', [Validators.required, Validators.maxLength(40)]],
    preferred_contact_time: ['anytime' as const, [Validators.required]],
    message: ['', [Validators.maxLength(1000)]],
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly service: SettlementIqService,
  ) {}

  ngOnInit(): void {
    this.scanId = this.route.snapshot.paramMap.get('scanId');
  }

  submit(): void {
    if (!this.scanId) {
      this.errorMessage = 'Missing scan ID — please return to your report and try again.';
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const payload: ConsultationRequestPayload = {
      scan_id: this.scanId,
      full_name: v.full_name!,
      phone: v.phone!,
      preferred_contact_time: v.preferred_contact_time!,
      message: (v.message || '').trim() || null,
    };

    this.isSubmitting = true;
    this.errorMessage = null;

    this.service.submitConsultationRequest(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.submitted = true;
        this.fallbackMode = false;
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting = false;
        // 404 means the backend handler isn't shipped yet. We fall back
        // gracefully — record the request locally (no-op for now) and
        // show a "please contact us directly" message rather than
        // pretending success.
        if (err.status === 404) {
          this.submitted = true;
          this.fallbackMode = true;
        } else {
          this.errorMessage =
            'We couldn\'t submit your request right now. Please try again in a moment, or call directly using the contact information shown below.';
        }
      },
    });
  }
}
