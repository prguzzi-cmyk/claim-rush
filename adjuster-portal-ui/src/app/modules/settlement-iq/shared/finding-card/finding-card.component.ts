import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { FindingPublic, FindingType } from '../../core/settlement-iq.models';

/**
 * Single forensic finding tile — severity-coded left border, finding-type
 * label, description, dollar impact (if known), and a citation line.
 *
 * Visual continuity with the server-side HTML report's `.finding` block.
 */
@Component({
  selector: 'si-finding-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './finding-card.component.html',
  styleUrls: ['./finding-card.component.scss'],
})
export class FindingCardComponent {
  @Input() finding!: FindingPublic;

  private static readonly TYPE_LABELS: Record<FindingType, string> = {
    scope_omission:               'Scope Omission',
    pricing_discrepancy:          'Pricing Discrepancy',
    depreciation_error:           'Depreciation Error',
    code_violation:               'Code Violation',
    policy_provision_misapplied:  'Policy Provision',
  };

  get typeLabel(): string {
    return FindingCardComponent.TYPE_LABELS[this.finding.finding_type] ?? this.finding.finding_type;
  }

  /** Formatted dollar string for the impact field. Returns null when impact is null. */
  get impactDollars(): string | null {
    if (this.finding.estimated_dollar_impact_cents == null) {
      return null;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(this.finding.estimated_dollar_impact_cents / 100);
  }
}
