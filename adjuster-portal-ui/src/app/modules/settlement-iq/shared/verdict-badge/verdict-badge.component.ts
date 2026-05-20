import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { Verdict } from '../../core/settlement-iq.models';

interface VerdictMeta {
  label: string;
  cssClass: string;
}

/**
 * Color-coded verdict pill. Visual continuity with the server-side HTML
 * report's verdict-card block — same palette, same labels.
 */
@Component({
  selector: 'si-verdict-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verdict-badge.component.html',
  styleUrls: ['./verdict-badge.component.scss'],
})
export class VerdictBadgeComponent {
  @Input() verdict: Verdict | null = null;

  private static readonly META: Record<Verdict, VerdictMeta> = {
    strong_reopen:     { label: 'Strong Recovery Candidate',  cssClass: 'is-strong' },
    possible_reopen:   { label: 'Possible Recovery Candidate', cssClass: 'is-possible' },
    weak_reopen:       { label: 'Limited Recovery Indicated',  cssClass: 'is-weak' },
    open_claim:        { label: 'Open Claim',                  cssClass: 'is-open' },
    released_decline:  { label: 'Released Claim',              cssClass: 'is-released' },
    statute_expired:   { label: 'Statute Expired',             cssClass: 'is-expired' },
  };

  get meta(): VerdictMeta | null {
    return this.verdict ? VerdictBadgeComponent.META[this.verdict] : null;
  }
}
