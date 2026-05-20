import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { SettlementIqService } from '../../core/settlement-iq.service';
import { FileDropzoneComponent } from '../../shared/file-dropzone/file-dropzone.component';
import { ProgressStepperComponent } from '../../shared/progress-stepper/progress-stepper.component';

/**
 * Settlement IQ — Upload (screen 2).
 *
 * Drag/drop document + email capture → POST scan → poll status →
 * navigate to /report/:id on completion.
 *
 * Progress bar derives its label from the current `progress_pct` value
 * returned by the backend's audit-event-based progress heuristic.
 */
@Component({
  selector: 'si-upload',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FileDropzoneComponent,
    ProgressStepperComponent,
  ],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss'],
})
export class UploadComponent implements OnDestroy {
  selectedFile: File | null = null;
  fileError: string | null = null;
  submitError: string | null = null;
  isSubmitting = false;
  progressPct: number | null = null;
  progressLabel: string | null = null;

  readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  private statusSub?: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly service: SettlementIqService,
    private readonly router: Router,
  ) {}

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }

  onFileSelected(file: File): void {
    this.selectedFile = file;
    this.fileError = null;
  }

  onFileRejected(reason: string): void {
    this.selectedFile = null;
    this.fileError = reason;
  }

  get canSubmit(): boolean {
    return !this.isSubmitting && this.selectedFile !== null && this.emailForm.valid;
  }

  submit(): void {
    if (!this.canSubmit || !this.selectedFile) {
      return;
    }
    const email = this.emailForm.value.email!;
    this.isSubmitting = true;
    this.submitError = null;
    this.progressPct = 0;
    this.progressLabel = 'Uploading document';

    this.service.submitScan(this.selectedFile, email).subscribe({
      next: (res) => {
        this.startPolling(res.scan_id);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.progressPct = null;
        this.submitError = this.humanizeSubmitError(err);
      },
    });
  }

  private startPolling(scanId: string): void {
    this.statusSub = this.service.pollStatus(scanId).subscribe({
      next: (s) => {
        this.progressPct = s.progress_pct ?? this.progressPct ?? 0;
        this.progressLabel = this.labelForProgress(this.progressPct);
        if (s.status === 'complete') {
          this.router.navigate(['/settlement-iq/residential/report', scanId]);
        } else if (s.status === 'failed') {
          this.isSubmitting = false;
          this.submitError = this.humanizeBackendFailure(s.failure_reason);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = this.humanizeSubmitError(err);
      },
    });
  }

  private labelForProgress(pct: number | null): string {
    const v = pct ?? 0;
    if (v < 15) return 'Reading the document';
    if (v < 40) return 'Extracting claim details';
    if (v < 90) return 'Running forensic checks';
    return 'Generating report';
  }

  private humanizeSubmitError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 413) {
        return 'That file is over the 25 MB limit. Most settlement documents are well under that — if yours is a scanned photo, try a digital PDF export from your insurer\'s portal.';
      }
      if (err.status === 415) {
        return 'Settlement IQ accepts PDF or DOCX in this phase. Image and scanned-photograph support is in development.';
      }
      if (err.status === 0) {
        return 'We couldn\'t reach the analysis service. Check your connection and try again. If the issue persists, it is on our side and a retry in a few minutes should succeed.';
      }
      if (err.status >= 500) {
        return 'The analysis service is having a problem on our side. A retry in a few minutes should succeed; if not, the issue has been logged.';
      }
      const detail = (err.error as { detail?: string })?.detail;
      if (detail) {
        return detail;
      }
    }
    return 'Something went wrong submitting the scan. Try again, or refresh and start over.';
  }

  private humanizeBackendFailure(reason: string | null): string {
    if (!reason) {
      return 'The analysis did not complete. This can happen with unusually formatted or partially redacted documents.';
    }
    if (reason.toLowerCase().includes('scanned')) {
      return 'The document was readable, but no text could be extracted. This typically means the PDF is a scanned image rather than a digital export. Try requesting a digital copy from your insurer.';
    }
    return `The analysis did not complete. Reason: ${reason}`;
  }
}
