import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
export class UploadComponent implements OnInit, OnDestroy {
  /** All files the user has added to the upload list. Multi-file
   *  picking is supported in the UI; per the Phase-1 backend contract,
   *  only `selectedFiles[0]` is sent to the analysis chain on submit.
   *  Additional files in the list are visible to the user but
   *  explicitly labeled "(not analyzed)". */
  selectedFiles: File[] = [];
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
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Deep-link support: a user can land directly at /upload?rep=<slug>
    // (skipping the Door screen). Pick up the param either way; Door
    // already wrote it to the service if they came through there.
    const rep = this.route.snapshot.queryParamMap.get('rep');
    if (rep) {
      this.service.setReferralRepSlug(rep);
    }
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }

  /** Active rep slug from the service. Surfaced in the template as
   *  a quiet "Referred by:" chip so the homeowner sees they're being
   *  attributed correctly. Null hides the chip. */
  get repSlug(): string | null {
    return this.service.currentReferralRepSlug;
  }

  /** Manual dismissal for the chip. Clears the slug — submission will
   *  no longer be attributed. Two real scenarios: privacy preference,
   *  or correction (link from one rep but actually referred by another). */
  dismissRepSlug(): void {
    this.service.setReferralRepSlug(null);
  }

  onFileSelected(file: File): void {
    // Dedupe by (name, size) so the same picked-twice file doesn't
    // double-list. Real duplicates are rare; this prevents drag-then-
    // browse-with-same-file from showing two entries.
    const dupe = this.selectedFiles.some(
      (f) => f.name === file.name && f.size === file.size,
    );
    if (!dupe) {
      this.selectedFiles = [...this.selectedFiles, file];
    }
    this.fileError = null;
  }

  onFileRejected(reason: string): void {
    // Note: do NOT clear the existing list — earlier valid files stay.
    // Only the rejected file is dropped, and we surface the reason.
    this.fileError = reason;
  }

  removeFile(index: number): void {
    if (index < 0 || index >= this.selectedFiles.length) return;
    this.selectedFiles = this.selectedFiles.filter((_, i) => i !== index);
  }

  clearAll(): void {
    this.selectedFiles = [];
    this.fileError = null;
  }

  /** Files the user can SEE in the list but that will NOT be sent to the
   *  backend on submit. Always indices >= 1 in the current Phase-1 design. */
  isAnalyzed(index: number): boolean {
    return index === 0;
  }

  get canSubmit(): boolean {
    return !this.isSubmitting && this.selectedFiles.length > 0 && this.emailForm.valid;
  }

  /** Human-readable reason the button is disabled, or null when ready.
   *  Surfaced below the CTA so the user knows what's gating them. */
  get disabledReason(): string | null {
    if (this.isSubmitting) {
      return null;
    }
    const noFile = this.selectedFiles.length === 0;
    const emailValue = (this.emailForm.value.email || '').trim();
    const noEmail = emailValue.length === 0;
    const invalidEmail = !noEmail && this.emailForm.invalid;
    if (noFile && noEmail) {
      return 'Drop your settlement document above and enter your email to begin.';
    }
    if (noFile) {
      return 'Drop your settlement document above to begin.';
    }
    if (noEmail) {
      return 'Enter the email address where we should send your report.';
    }
    if (invalidEmail) {
      return 'That email address doesn\'t look right — double-check it.';
    }
    return null;
  }

  submit(): void {
    if (!this.canSubmit || this.selectedFiles.length === 0) {
      return;
    }
    // Phase-1 backend accepts ONE file per scan. The UI displays every
    // selected file so the user knows what they attached, but only
    // selectedFiles[0] is sent. Indices >= 1 are flagged "(not analyzed)"
    // in the list. Backend multi-file is a Phase 1.5 slice.
    const primaryFile = this.selectedFiles[0];
    const email = this.emailForm.value.email!;
    this.isSubmitting = true;
    this.submitError = null;
    this.progressPct = 0;
    this.progressLabel = 'Uploading document';

    this.service.submitScan(primaryFile, email, null, this.repSlug).subscribe({
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
