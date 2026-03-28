export interface CarrierLineItem {
  id?: string;
  description?: string;
  quantity: number;
  unit?: string;
  unit_cost?: number;
  total_cost?: number;
  category?: string;
  line_item_code?: string;
  confidence?: 'high' | 'medium' | 'low';
  room_name?: string;
  matched_room_id?: string;
  sort_order?: number;
  carrier_estimate_id?: string;
}

export interface CarrierEstimate {
  id?: string;
  carrier_name: string;
  upload_type?: string;
  file_name?: string;
  file_key?: string;
  status?: string;
  parser_type?: 'xactimate' | 'generic' | 'paste';
  parse_confidence?: 'high' | 'medium' | 'low';
  total_cost?: number;
  notes?: string;
  project_id?: string;
  line_items?: CarrierLineItem[];
  created_at?: string;
  updated_at?: string;
}

export interface CarrierPreviewLineItem {
  description?: string;
  quantity: number;
  unit?: string;
  unit_cost?: number;
  total_cost?: number;
  category?: string;
  line_item_code?: string;
  confidence?: 'high' | 'medium' | 'low';
  room_name?: string;
}

export interface CarrierPreviewResult {
  items: CarrierPreviewLineItem[];
  parser_type?: 'xactimate' | 'generic' | 'paste';
  parse_confidence?: 'high' | 'medium' | 'low';
  item_count: number;
  total_cost: number;
  file_key?: string;
}

export interface CarrierConfirmRequest {
  carrier_name: string;
  file_key?: string;
  file_name?: string;
  upload_type: string;
  parser_type?: string;
  parse_confidence?: string;
  pasted_text?: string;
  items: CarrierPreviewLineItem[];
}

export interface ComparisonLineItem {
  room_name?: string;
  description?: string;
  aci_quantity?: number;
  aci_unit?: string;
  aci_unit_cost?: number;
  aci_total?: number;
  carrier_quantity?: number;
  carrier_unit?: string;
  carrier_unit_cost?: number;
  carrier_total?: number;
  difference?: number;
  status: 'match' | 'price_diff' | 'aci_only' | 'carrier_only';
  category?: string;
  match_confidence?: 'high' | 'medium' | 'low';
  match_score?: number;
}

export interface CategoryBreakdown {
  category: string;
  aci_total: number;
  carrier_total: number;
  difference: number;
  item_count: number;
}

export interface TopUnderpaidItem {
  description: string;
  room_name?: string;
  aci_total: number;
  carrier_total: number;
  difference: number;
  status: string;
}

export interface ComparisonRoom {
  room_name: string;
  items: ComparisonLineItem[];
  aci_subtotal: number;
  carrier_subtotal: number;
  difference: number;
}

export interface ComparisonResult {
  project_id?: string;
  carrier_estimate_id?: string;
  rooms: ComparisonRoom[];
  aci_total: number;
  carrier_total: number;
  supplement_total: number;
  match_count: number;
  aci_only_count: number;
  carrier_only_count: number;
  price_diff_count: number;
  price_threshold: number;
  category_breakdown?: CategoryBreakdown[];
  top_underpaid_items?: TopUnderpaidItem[];
}

// ── Supplement Defense Package ──────────────────────────────────────────────

/** Structured output for supplement-defense workflow.
 *  Generated from ComparisonResult + claim context. */
export interface SupplementDefensePackage {
  claimSummary: DefenseClaimSummary;
  underpaymentSummary: DefenseUnderpaymentSummary;
  omittedScopeSummary: DefenseOmittedScopeSummary;
  pricingVarianceSummary: DefensePricingVarianceSummary;
  defenseNotes: DefenseNotes;
  recommendedNextAction: string;
  generatedAt: string;
}

export interface DefenseClaimSummary {
  projectName: string;
  carrierName: string;
  claimNumber: string;
  insuredName: string;
  propertyAddress: string;
  aciTotal: number;
  carrierTotal: number;
  supplementTotal: number;
  percentDifference: number;
}

export interface DefenseUnderpaymentSummary {
  totalUnderpaidAmount: number;
  underpaidItemCount: number;
  items: DefenseLineItemEntry[];
}

export interface DefenseOmittedScopeSummary {
  totalOmittedAmount: number;
  omittedItemCount: number;
  items: DefenseLineItemEntry[];
}

export interface DefensePricingVarianceSummary {
  totalVarianceAmount: number;
  varianceItemCount: number;
  items: DefensePricingVarianceEntry[];
}

export interface DefenseLineItemEntry {
  room: string;
  description: string;
  aciAmount: number;
  carrierAmount: number;
  difference: number;
}

export interface DefensePricingVarianceEntry {
  room: string;
  description: string;
  aciUnitPrice: number;
  carrierUnitPrice: number;
  aciQuantity: number;
  carrierQuantity: number;
  totalDifference: number;
  varianceType: 'price' | 'quantity' | 'both';
}

/**
 * Editable defense narrative sections.
 * Persisted via estimate-projects/{id}/defense-notes endpoint.
 * Each field maps to a labeled section in the supplement-defense PDF.
 *
 * Future-ready: AI-generated drafts and template insertion will populate
 * these fields; the adjuster can then edit before exporting.
 */
export interface DefenseNotes {
  /** Code / standard pricing defense — cite pricing databases, local market rates, code requirements. */
  pricingDefense: string;
  /** Omitted scope defense — explain why missing items are required for proper restoration. */
  omittedScopeDefense: string;
  /** Matching / continuity rationale — flooring continuity, paint matching, roofing uniformity. */
  matchingContinuityDefense: string;
  /** Quantity / scope correction — measurement corrections, field inspection findings. */
  quantityScopeDefense: string;
  /** Code and standard support — building codes, manufacturer specs, industry standards. */
  codeStandardSupport: string;
  /** Recommended next action narrative — adjuster's notes on what should happen next. */
  recommendedActionNotes: string;
}

/** Shape sent to / received from the defense-notes API endpoint. */
export interface DefenseNotesPayload {
  pricing_defense?: string;
  omitted_scope_defense?: string;
  matching_continuity_defense?: string;
  quantity_scope_defense?: string;
  code_standard_support?: string;
  recommended_action_notes?: string;
}

/** Default empty defense notes (used for initialization). */
export function createEmptyDefenseNotes(): DefenseNotes {
  return {
    pricingDefense: '',
    omittedScopeDefense: '',
    matchingContinuityDefense: '',
    quantityScopeDefense: '',
    codeStandardSupport: '',
    recommendedActionNotes: '',
  };
}

/** Convert API snake_case payload to camelCase DefenseNotes. */
export function defenseNotesFromPayload(p: DefenseNotesPayload): DefenseNotes {
  return {
    pricingDefense: p.pricing_defense || '',
    omittedScopeDefense: p.omitted_scope_defense || '',
    matchingContinuityDefense: p.matching_continuity_defense || '',
    quantityScopeDefense: p.quantity_scope_defense || '',
    codeStandardSupport: p.code_standard_support || '',
    recommendedActionNotes: p.recommended_action_notes || '',
  };
}

/** Convert camelCase DefenseNotes to API snake_case payload. */
export function defenseNotesToPayload(n: DefenseNotes): DefenseNotesPayload {
  return {
    pricing_defense: n.pricingDefense,
    omitted_scope_defense: n.omittedScopeDefense,
    matching_continuity_defense: n.matchingContinuityDefense,
    quantity_scope_defense: n.quantityScopeDefense,
    code_standard_support: n.codeStandardSupport,
    recommended_action_notes: n.recommendedActionNotes,
  };
}
