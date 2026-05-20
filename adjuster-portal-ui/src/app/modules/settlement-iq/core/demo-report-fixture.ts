import { ReportPayload } from './settlement-iq.models';

/**
 * Hard-coded sample ReportPayload for visual review of the Report
 * screen without a live backend. Wired into SettlementIqService via
 * the special scan_id 'demo' — the service short-circuits the HTTP
 * call and returns this fixture.
 *
 * Numbers are arithmetically consistent with the backend's
 * recovery_calculator (LOW = (major+moderate sum) * 0.7, HIGH = all
 * findings sum) so the fixture demonstrates the engine's behavior
 * end-to-end, not just the visuals.
 *
 * Findings breakdown:
 *   major + moderate sum:  $3,500 + $2,800 + $2,200 + $1,500 = $10,000
 *   LOW = $10,000 * 0.7  = $7,000
 *   all sum (incl. minor): $10,000 + $650 = $10,650
 *   HIGH = $10,650
 */
export const DEMO_REPORT: ReportPayload = {
  scan_id: 'demo',
  verdict: 'strong_reopen',
  recovery_low_cents: 700_000,
  recovery_high_cents: 1_065_000,
  statute_window_days: 287,

  carrier_name: 'Citizens Property Insurance',
  loss_date: '2024-08-12',
  settlement_date: '2024-12-18',
  settlement_amount_cents: 1_184_000,  // $11,840.00
  peril: 'wind',
  state: 'FL',
  county: 'Hillsborough',

  findings: [
    {
      finding_type: 'scope_omission',
      severity: 'major',
      description:
        'Drip edge at eaves and rakes was not included in the scope of repair. ' +
        'Florida Building Code requires drip edge on all asphalt-shingle roof systems; ' +
        'replacement of the roof without restoring drip edge is a code violation.',
      estimated_dollar_impact_cents: 350_000,
      evidence_citation: 'FBC §1507.2.8.2',
      sort_order: 0,
    },
    {
      finding_type: 'code_violation',
      severity: 'major',
      description:
        'Ice & water shield (or equivalent self-adhering polymer-modified bitumen underlayment) ' +
        'in valleys and at transitions is not reflected in the scope. Florida HVHZ counties require ' +
        'this material on shingle replacement projects.',
      estimated_dollar_impact_cents: 280_000,
      evidence_citation: 'FBC §1507.2.8.1.1',
      sort_order: 1,
    },
    {
      finding_type: 'pricing_discrepancy',
      severity: 'moderate',
      description:
        'Unit price for architectural composition shingle (RFG-COMP-AR) is approximately 14% below the ' +
        'regional norm for Hillsborough County based on comparable recent settlements.',
      estimated_dollar_impact_cents: 220_000,
      evidence_citation: 'Xactimate RFG-COMP-AR, Hillsborough County comparable',
      sort_order: 2,
    },
    {
      finding_type: 'depreciation_error',
      severity: 'moderate',
      description:
        'Labor depreciation was applied to shingle installation. Florida statutory guidance restricts ' +
        'labor depreciation in property-insurance loss adjustments; the depreciation applied may exceed ' +
        'what is recoverable by the carrier.',
      estimated_dollar_impact_cents: 150_000,
      evidence_citation: 'Fla. Stat. §627.7011 guidance + Sebo v. American Home Assurance',
      sort_order: 3,
    },
    {
      finding_type: 'scope_omission',
      severity: 'minor',
      description:
        'Ridge vent and ridge cap restoration are not included in the scope. Roof replacement requires ' +
        'restoration of ventilation per code.',
      estimated_dollar_impact_cents: 65_000,
      evidence_citation: 'FBC §1507.2.9.3',
      sort_order: 4,
    },
  ],

  report_version: 'v1.0',
  report_sha256: '7f2c8a4b1e6d9c3a5f8b2e4d6a8c1f3e5b7d9a2c4e6f8b1d3a5c7e9f2b4d6a8c',
  generated_at: new Date().toISOString(),
};
