/**
 * Defense Template Library
 *
 * Pre-built supplement-defense language templates organized by category.
 * Adjusters can insert these into defense note sections as starting points,
 * then edit to match the specific claim context.
 *
 * To add new templates: append to the DEFENSE_TEMPLATES array below.
 * No code changes are needed elsewhere — the UI reads from this array.
 */

export interface DefenseTemplate {
  id: string;
  name: string;
  category: string;
  text: string;
}

export type DefenseTemplateCategory =
  | 'pricing_defense'
  | 'omitted_scope_defense'
  | 'matching_continuity_defense'
  | 'quantity_scope_defense'
  | 'code_standard_support'
  | 'recommended_action_notes';

export const DEFENSE_TEMPLATES: DefenseTemplate[] = [

  // ── Pricing Defense ──────────────────────────────────────────

  {
    id: 'pricing-xactimate-market',
    name: 'Xactimate Market Rate Defense',
    category: 'pricing_defense',
    text:
      'The unit pricing in our estimate reflects current Xactimate pricing data for this geographic region. ' +
      'Xactimate is the industry-standard estimating platform used by the majority of carriers and adjusters nationwide. ' +
      'The carrier\'s pricing falls below the published Xactimate rates for the applicable zip code and pricing period. ' +
      'We request that the carrier adjust their unit pricing to reflect the current Xactimate pricing database, ' +
      'which represents fair and reasonable costs for materials and labor in this market area.',
  },
  {
    id: 'pricing-local-labor',
    name: 'Local Labor Rate Justification',
    category: 'pricing_defense',
    text:
      'Our unit pricing reflects actual labor rates obtained from licensed and insured contractors operating in ' +
      'this market area. Local labor costs have increased significantly due to demand from recent storm events ' +
      'and general construction industry inflation. The carrier\'s pricing does not reflect the actual cost ' +
      'to hire qualified contractors to perform this work. We have obtained competitive bids from multiple ' +
      'contractors that confirm our pricing is consistent with current market conditions.',
  },
  {
    id: 'pricing-material-cost',
    name: 'Material Cost Increase Defense',
    category: 'pricing_defense',
    text:
      'Material costs for the items in dispute have increased above the carrier\'s pricing due to supply chain ' +
      'factors and market conditions. The materials specified in our estimate represent like-kind-and-quality ' +
      'replacements as required by the policy. We can provide supplier invoices and current pricing sheets ' +
      'that demonstrate the actual cost of these materials in this market. The carrier\'s pricing does not ' +
      'reflect current material availability and cost.',
  },

  // ── Omitted Scope Defense ────────────────────────────────────

  {
    id: 'omitted-code-required',
    name: 'Code-Required Scope Items',
    category: 'omitted_scope_defense',
    text:
      'The items omitted from the carrier\'s estimate are required by applicable building codes to properly ' +
      'restore the property to its pre-loss condition. Under the International Residential Code (IRC) and ' +
      'local building code amendments, these items must be included when performing the repairs scoped by ' +
      'the carrier. Omitting code-required work items results in a repair that does not meet minimum building ' +
      'standards and would not pass inspection by the local authority having jurisdiction.',
  },
  {
    id: 'omitted-industry-standard',
    name: 'Industry Standard Practice',
    category: 'omitted_scope_defense',
    text:
      'The omitted items represent standard construction practices that are necessary to properly complete ' +
      'the repairs already approved by the carrier. No licensed contractor would perform the approved repairs ' +
      'without also completing these related items. For example, removing and reinstalling drywall requires ' +
      'taping, finishing, priming, and painting — these are not optional add-ons but mandatory steps in the ' +
      'repair sequence. Omitting intermediate steps results in an incomplete and unworkmanlike repair.',
  },
  {
    id: 'omitted-manufacturer-specs',
    name: 'Manufacturer Specification Requirements',
    category: 'omitted_scope_defense',
    text:
      'The omitted items are required by the manufacturer\'s installation specifications. Failure to include ' +
      'these items would void the manufacturer\'s warranty on the installed materials and may result in ' +
      'premature failure of the repair. The policy requires restoration to pre-loss condition, which includes ' +
      'installation according to manufacturer specifications to ensure proper performance and warranty coverage.',
  },

  // ── Matching / Continuity ────────────────────────────────────

  {
    id: 'matching-flooring',
    name: 'Flooring Continuity / Matching',
    category: 'matching_continuity_defense',
    text:
      'The damaged flooring extends across a continuous area that cannot be partially replaced without creating ' +
      'a visible and obvious mismatch. The existing flooring material is no longer available in the same color, ' +
      'pattern, and lot number. Partial replacement would result in a noticeable difference in appearance that ' +
      'does not meet the policy requirement of restoring the property to its pre-loss condition. We request ' +
      'replacement of the entire continuous flooring area to achieve a uniform, matching result.',
  },
  {
    id: 'matching-roofing',
    name: 'Roofing Uniformity',
    category: 'matching_continuity_defense',
    text:
      'The roof system requires uniform replacement across the affected slope(s) to maintain a consistent ' +
      'appearance. Patching individual shingles or sections results in visible color and weathering differences ' +
      'that are plainly noticeable from ground level. The existing shingles have weathered and the replacement ' +
      'shingles, while the same product line, will not match in color or appearance. Industry practice and ' +
      'most policy matching provisions require replacement of the full slope to achieve a uniform result.',
  },
  {
    id: 'matching-paint',
    name: 'Paint Color Matching Across Rooms',
    category: 'matching_continuity_defense',
    text:
      'Painting requires matching across all surfaces within the affected area to avoid visible color ' +
      'differences. Paint colors shift over time due to UV exposure, age, and environmental factors. ' +
      'Spot-painting or painting only the repaired surface will create a visible demarcation between new ' +
      'and existing paint. Standard practice requires painting the entire wall surface, and in open-concept ' +
      'areas, all contiguous walls to achieve a uniform color match.',
  },

  // ── Quantity / Scope Correction ──────────────────────────────

  {
    id: 'qty-field-measurement',
    name: 'Field Measurement Correction',
    category: 'quantity_scope_defense',
    text:
      'Our quantities are based on actual field measurements taken during our on-site inspection. ' +
      'The carrier\'s quantities appear to be based on estimating software defaults or satellite imagery, ' +
      'which do not account for actual field conditions including waste factors, complex geometry, ' +
      'and areas not visible from aerial views. We can provide our field measurement documentation ' +
      'including photographs showing the areas measured.',
  },
  {
    id: 'qty-waste-factor',
    name: 'Waste Factor Justification',
    category: 'quantity_scope_defense',
    text:
      'Our quantities include appropriate waste factors consistent with industry standards. Xactimate and ' +
      'other estimating platforms include built-in waste factors that account for cuts, fitting, damage during ' +
      'installation, and material defects. The carrier\'s quantities do not appear to include adequate waste, ' +
      'which would result in insufficient material to complete the repairs. Standard waste factors range from ' +
      '10-15% for most materials and up to 20% for complex installations.',
  },
  {
    id: 'qty-missed-areas',
    name: 'Areas Missed During Carrier Inspection',
    category: 'quantity_scope_defense',
    text:
      'Our inspection identified additional damaged areas that were not included in the carrier\'s scope. ' +
      'These areas may not have been visible during the carrier\'s initial inspection due to access limitations, ' +
      'concealed conditions, or damage that became apparent after demolition of surface materials. ' +
      'We documented these additional areas with photographs and measurements during our field inspection.',
  },

  // ── Code & Standard Support ──────────────────────────────────

  {
    id: 'code-irc-general',
    name: 'IRC General Code Compliance',
    category: 'code_standard_support',
    text:
      'The scope items in dispute are required under the International Residential Code (IRC) as adopted ' +
      'by the local jurisdiction. When repairs disturb existing construction, the IRC requires that the ' +
      'repaired area comply with current code standards. This includes but is not limited to: proper vapor ' +
      'barriers, insulation values meeting current energy code, proper fastening patterns, and fire-rated ' +
      'assemblies where required. The carrier\'s estimate does not include these code-required items.',
  },
  {
    id: 'code-iicrc-water',
    name: 'IICRC S500 Water Damage Standard',
    category: 'code_standard_support',
    text:
      'The water mitigation and restoration scope follows the IICRC S500 Standard and Reference Guide for ' +
      'Professional Water Damage Restoration. This industry standard establishes the procedures for water ' +
      'damage restoration including proper extraction, structural drying, monitoring, and antimicrobial ' +
      'application. The carrier\'s estimate does not include all steps required by the IICRC S500 standard ' +
      'to properly mitigate and restore water-damaged materials.',
  },
  {
    id: 'code-nec-electrical',
    name: 'NEC Electrical Code Requirements',
    category: 'code_standard_support',
    text:
      'When electrical systems are disturbed during repairs, the National Electrical Code (NEC) requires ' +
      'that the repaired or replaced electrical work comply with current code standards. This may include ' +
      'GFCI/AFCI protection, proper circuit loading, updated wiring methods, and inspection by the local ' +
      'authority having jurisdiction. These code-upgrade items are covered under the policy\'s Ordinance ' +
      'or Law provisions and must be included in the estimate.',
  },
  {
    id: 'code-manufacturer-install',
    name: 'Manufacturer Installation Standards',
    category: 'code_standard_support',
    text:
      'The manufacturer\'s installation instructions constitute the minimum standard for proper installation ' +
      'of the replacement materials. Building codes (IRC Section R703.1.1, R905.2) require that materials ' +
      'be installed according to manufacturer specifications. Failure to follow these specifications voids ' +
      'the warranty and may not pass code inspection. Our estimate includes all steps required by the ' +
      'manufacturer\'s installation guide.',
  },

  // ── Recommended Next Action ──────────────────────────────────

  {
    id: 'action-supplement-demand',
    name: 'Submit Supplement Demand',
    category: 'recommended_action_notes',
    text:
      'Send the completed supplement demand package to the carrier adjuster via email with the Blackout ' +
      'Estimate report attached. Request a written response within 15 business days. If no response is ' +
      'received, follow up with a second written request and escalate to the carrier\'s supervisor or ' +
      'manager. Document all communication attempts for the claim file.',
  },
  {
    id: 'action-reinspection',
    name: 'Request Joint Reinspection',
    category: 'recommended_action_notes',
    text:
      'Request a joint reinspection with the carrier adjuster to review the disputed items on-site. ' +
      'Prepare a punch list of all omitted and underpaid items with supporting photographs and measurements. ' +
      'During the reinspection, walk the carrier adjuster through each disputed item and document their ' +
      'response. A joint inspection often resolves scope disputes more efficiently than written correspondence.',
  },
  {
    id: 'action-appraisal',
    name: 'Invoke Appraisal Clause',
    category: 'recommended_action_notes',
    text:
      'If the carrier does not agree to the supplement demand after written correspondence and reinspection, ' +
      'consider invoking the policy\'s Appraisal clause. Send a written demand for appraisal per the policy ' +
      'terms. Each party selects a competent, independent appraiser within 20 days. The two appraisers then ' +
      'select an umpire. Agreement by any two of the three sets the loss amount. This process is binding ' +
      'and typically more efficient than litigation.',
  },
];

/** Get all templates for a specific category. */
export function getTemplatesByCategory(category: string): DefenseTemplate[] {
  return DEFENSE_TEMPLATES.filter(t => t.category === category);
}
