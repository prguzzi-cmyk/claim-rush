import { GapAnalysisResult } from './policy-document.model';

export type EstimateType = 'pa_estimate' | 'carrier_estimate' | 'supplement_estimate';

/**
 * Links a claim to its policy and up to 3 estimate documents.
 * Used by the Gap Analysis engine to determine what data is available
 * for comparison.
 */
export interface ClaimDocumentBundle {
  claimId: string;
  policyId: string | null;
  paEstimateId: string | null;
  carrierEstimateId: string | null;
  supplementEstimateId: string | null;
}

/**
 * Tracks which documents are present and whether gap analysis
 * can proceed.
 */
export interface GapAnalysisReadiness {
  hasPolicy: boolean;
  hasPaEstimate: boolean;
  hasCarrierEstimate: boolean;
  hasSupplementEstimate: boolean;
  canRunAnalysis: boolean;
  message: string;
}

/**
 * Full gap analysis context: the bundle, readiness check, and
 * (when available) the analysis result.
 */
export interface GapAnalysisContext {
  bundle: ClaimDocumentBundle;
  readiness: GapAnalysisReadiness;
  result: GapAnalysisResult | null;
}

// ── Gap Analysis Engine Types ──

export type GapCategory =
  | 'missing_scope'
  | 'underpaid'
  | 'code_upgrade'
  | 'matching_violation'
  | 'coverage_limit'
  | 'ale_gap'
  | 'deductible_issue';

export type GapSeverity = 'info' | 'warning' | 'critical';

export interface NormalizedLineItem {
  id: string;
  room: string;
  description: string;
  descriptionNorm: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  source: 'pa' | 'carrier';
  category?: string;
}

export interface LineItemComparison {
  paItem: NormalizedLineItem | null;
  carrierItem: NormalizedLineItem | null;
  matchScore: number;
  priceDifference: number;
  quantityDifference: number;
  status: 'matched' | 'pa_only' | 'carrier_only';
}

export interface GapFinding {
  id: string;
  category: GapCategory;
  severity: GapSeverity;
  title: string;
  description: string;
  paAmount?: number;
  carrierAmount?: number;
  difference?: number;
  relatedItems?: string[];
  recommendation?: string;
}

export interface GapAnalysisReport {
  id: string;
  caseId: string;
  createdAt: Date;
  paEstimateTotal: number;
  carrierEstimateTotal: number;
  totalGap: number;
  comparisons: LineItemComparison[];
  findings: GapFinding[];
  summary: string;
  supplementLetter?: string;
}

export interface CarrierEstimateData {
  lineItems: NormalizedLineItem[];
  totalCost: number;
  rawText?: string;
}

// ── Negotiation Command Center Types ──

export type PositionStrength = 'strong' | 'moderate' | 'weak';
export type NegotiationApproach = 'aggressive' | 'collaborative' | 'appraisal';
export type DocumentType = 'demand_letter' | 'estimate_defense' | 'followup_letter';

export interface NegotiationStrategy {
  positionStrength: PositionStrength;
  strengthScore: number;
  approach: NegotiationApproach;
  leveragePoints: string[];
  risks: string[];
  recommendedActions: string[];
}

export interface SettlementScenario {
  settlementPercentage: number;
  settlementAmount: number;
  paTotal: number;
  carrierTotal: number;
  gapRecovered: number;
  gapRecoveryPercent: number;
  netAfterDeductible: number;
  deductibleAmount: number;
}

export interface GeneratedDocument {
  type: DocumentType;
  title: string;
  content: string;
  generatedAt: Date;
  clausesReferenced: string[];
}

export interface NegotiationRound {
  id: string;
  roundNumber: number;
  date: string;
  carrierOfferAmount: number;
  paCounterAmount: number;
  notes: string;
  outcome?: string;
}
