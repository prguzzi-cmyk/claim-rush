import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Recovery range card — $LOW – $HIGH formatted in USD, plus the
 * statute-of-limitations window remaining for the claim. Matches the
 * "Estimated Additional Recovery" block in the server-side HTML report.
 *
 * When low/high are both null/undefined, renders an honest "Not calculated"
 * — never a misleading $0.
 */
@Component({
  selector: 'si-recovery-range-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recovery-range-display.component.html',
  styleUrls: ['./recovery-range-display.component.scss'],
})
export class RecoveryRangeDisplayComponent {
  @Input() lowCents: number | null = null;
  @Input() highCents: number | null = null;
  @Input() statuteWindowDays: number | null = null;

  private readonly fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  get rangeDisplay(): string {
    if (this.lowCents == null || this.highCents == null) {
      return 'Not calculated';
    }
    return `${this.fmt.format(this.lowCents / 100)} – ${this.fmt.format(this.highCents / 100)}`;
  }

  get windowDisplay(): string | null {
    if (this.statuteWindowDays == null) {
      return null;
    }
    if (this.statuteWindowDays <= 0) {
      return 'Window has closed';
    }
    const unit = this.statuteWindowDays === 1 ? 'day' : 'days';
    return `${this.statuteWindowDays.toLocaleString()} ${unit} remaining`;
  }

  get windowState(): 'expired' | 'narrow' | 'open' | null {
    if (this.statuteWindowDays == null) return null;
    if (this.statuteWindowDays <= 0) return 'expired';
    if (this.statuteWindowDays <= 90) return 'narrow';
    return 'open';
  }
}
