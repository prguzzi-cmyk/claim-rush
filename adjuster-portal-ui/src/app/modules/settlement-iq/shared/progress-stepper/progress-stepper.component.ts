import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Linear progress bar with a stage label. Drives off the backend's
 * progress_pct field on the /status endpoint (derived from audit-event
 * high-watermark on the server side).
 */
@Component({
  selector: 'si-progress-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress-stepper.component.html',
  styleUrls: ['./progress-stepper.component.scss'],
})
export class ProgressStepperComponent {
  @Input() progressPct: number | null = 0;
  @Input() label: string | null = null;
  @Input() errorMessage: string | null = null;

  get clampedPct(): number {
    const v = this.progressPct ?? 0;
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
  }
}
