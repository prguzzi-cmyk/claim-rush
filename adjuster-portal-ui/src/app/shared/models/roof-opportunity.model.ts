/**
 * Roof Opportunity & Scoring Models
 *
 * Extends the existing RoofAnalysisRecord with scoring logic,
 * lead generation integration, and dashboard metrics.
 *
 * Does NOT duplicate:
 * - RoofAnalysisRecord (the existing data model — this extends it)
 * - StormEvent (storm data source — consumed by the scoring engine)
 * - Territory (routing — consumed via existing territory service)
 * - Lead/ManualLeadIntakeRequest (lead creation — produces compatible payloads)
 */

import { RoofAnalysisRecord } from 'src/app/models/roof-intelligence.model';

// ── Damage Probability ─────────────────────────────────────────

export type DamageProbability = 'low' | 'medium' | 'high' | 'critical';

export const DAMAGE_PROBABILITY_META: Record<DamageProbability, {
  label: string;
  icon: string;
  color: string;
  markerColor: string;
  minScore: number;
}> = {
  low:      { label: 'Low',      icon: 'check_circle',   color: '#4caf50', markerColor: '#22c55e', minScore: 0 },
  medium:   { label: 'Medium',   icon: 'info',           color: '#ff9800', markerColor: '#F39C12', minScore: 30 },
  high:     { label: 'High',     icon: 'warning',        color: '#e65100', markerColor: '#E5533D', minScore: 60 },
  critical: { label: 'Critical', icon: 'error',          color: '#c62828', markerColor: '#991b1b', minScore: 80 },
};

// ── Roof Opportunity ───────────────────────────────────────────

/** Enriched roof opportunity — a RoofAnalysisRecord with computed scoring. */
export interface RoofOpportunity {
  record: RoofAnalysisRecord;
  damageProbability: DamageProbability;
  inspectionPriority: number;
  estimatedClaimValue: number;
  shouldGenerateLead: boolean;
  leadGenerated: boolean;
  leadId: string | null;
}

// ── Scoring Inputs ─────────────────────────────────────────────

/** Inputs for the damage probability scoring function. */
export interface ScoringInputs {
  hailSizeInches: number | null;
  windSpeedMph: number | null;
  roofAgeYears: number | null;
  roofType: string | null;
  stormDurationMinutes: number | null;
  roofSizeSqft: number | null;
}

// ── Roof Material Risk Factor ──────────────────────────────────

export const ROOF_MATERIAL_RISK: Record<string, number> = {
  'asphalt_shingle':   1.0,
  'asphalt':           1.0,
  'shingle':           1.0,
  'three_tab':         1.2,
  '3_tab':             1.2,
  'architectural':     0.9,
  'dimensional':       0.9,
  'wood_shake':        1.3,
  'wood':              1.3,
  'tile':              0.7,
  'clay_tile':         0.7,
  'concrete_tile':     0.6,
  'metal':             0.5,
  'standing_seam':     0.4,
  'slate':             0.3,
  'flat':              0.8,
  'tpo':               0.7,
  'epdm':              0.7,
  'modified_bitumen':  0.8,
  'unknown':           1.0,
};

// ── Dashboard Metrics ──────────────────────────────────────────

export interface RoofDashboardMetrics {
  propertiesAnalyzed: number;
  highProbabilityRoofs: number;
  criticalProbabilityRoofs: number;
  leadsGenerated: number;
  leadsConverted: number;
  avgDamageScore: number;
  byProbability: Record<DamageProbability, number>;
  byStormType: Record<string, number>;
  topTerritories: { territoryName: string; count: number; avgScore: number }[];
}

// ── Map Marker ─────────────────────────────────────────────────

export interface RoofMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  probability: DamageProbability;
  address: string;
  damageScore: number;
  ownerName: string | null;
  tooltipHtml: string;
}
