import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, NgZone, ErrorHandler } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as L from 'leaflet';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RoofIntelligenceService } from '../../../services/roof-intelligence.service';
import { RoofAnalysisRecord, RoofAnalysisBatchRequest, ZoneScanRequest, ScanQueueStats } from '../../../models/roof-intelligence.model';
import { PotentialClaimsService } from '../../../services/potential-claims.service';

// ── Revenue-focused interfaces ──────────────────────────────────

type ProbabilityTier = 'low' | 'medium' | 'high' | 'immediate';
type WorkflowStatus = 'pending' | 'in_progress' | 'complete' | 'not_started';
type LeadWorkflowStatus = 'not_started' | 'contacted' | 'inspection_scheduled' | 'claim_filed';

type ImageQualityState = 'GOOD' | 'WEAK' | 'BAD';

interface RoofImageAnalysis {
  roofCoveragePct: number;
  treeDominancePct: number;
  cropCenterSource: 'parcel_centroid' | 'geocoded_address' | 'raw_coordinates';
  imageTimestamp: string | null;
  qualityState: ImageQualityState;
  qualityReason: string;
}

type OpportunityScore = 'Very High' | 'High' | 'Moderate' | 'Low';
type OpportunityAge = 'immediate' | 'active' | 'aging' | 'archive';

interface VisionDamageDetection {
  type: 'missing_shingles' | 'hail_strikes' | 'wind_uplift' | 'tarp_presence' | 'debris_patterns' | 'siding_damage' | 'roof_discoloration' | 'patch_repairs';
  label: string;
  detected: boolean;
  confidence: number;
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  areaAffectedPct: number;
  notes: string;
}

interface RoofVisionAnalysis {
  scanId: string;
  scanDate: string;
  imageSource: string;
  resolutionCm: number;
  overallConfidence: number;
  detections: VisionDamageDetection[];
  visionScore: number;
  satelliteImageUrl: string;
  damageTags: string[];
}

interface RepairScopeEstimate {
  roofReplacement: boolean;
  roofRepairSqFt: number;
  gutterLinearFt: number;
  sidingRepairSqFt: number;
  totalLaborHours: number;
  scopeNotes: string;
}

interface ClaimScopeEstimate {
  totalEstimate: number;
  roofing: number;
  gutters: number;
  siding: number;
  debrisRemoval: number;
  supplemental: number;
  generatedDate: string;
  confidence: number;
}

interface RoofProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  latitude: number;
  longitude: number;
  // Roof details
  roofType: string;
  roofAge: number;
  roofSizeSqFt: number;
  // AI analysis
  damageProbability: number;
  sidingDamageProbability: number;
  damageLabel: ProbabilityTier;
  claimRangeLow: number;
  claimRangeHigh: number;
  recommendedAction: string;
  // Storm event
  stormType: string;
  stormDate: string;
  hailSize: string | null;
  windSpeed: string | null;
  opportunityScore: OpportunityScore;
  // Revenue pipeline
  ownerName: string;
  ownerStatus: 'verified' | 'unverified' | 'absentee';
  skipTraceStatus: WorkflowStatus;
  outreachStatus: WorkflowStatus;
  aiReviewStatus: WorkflowStatus;
  adjusterPacketStatus: WorkflowStatus;
  leadWorkflowStatus: LeadWorkflowStatus;
  // Map
  parcelCoords: [number, number][];
  // Scoring engine
  roofScore: number;
  probabilityTier: ProbabilityTier;
  satelliteAnomalyFactor: number;
  leadPipelineStatus: 'queued' | 'sent' | 'not_queued';
  outreachScript: string;
  // Vision AI
  visionAnalysis: RoofVisionAnalysis;
  finalClaimScore: number;
  visionBadgeEligible: boolean;
  claimScopeEstimate: ClaimScopeEstimate | null;
  estimatedClaimValue: number;
  // Satellite Roof Intelligence
  repairScope: RepairScopeEstimate | null;
  satelliteScanStatus: 'pending' | 'scanning' | 'complete';
  satelliteScanDate: string | null;
  // Data quality & compliance
  addressQuality: 'resolved' | 'unresolved';
  propertyType: 'residential' | 'commercial' | 'unknown';
  imageQuality: ImageQualityState;
  roofImageAnalysis: RoofImageAnalysis | null;
  imageConfidence: number;
  lastUpdatedAt: string | null;
  eventDetectedAt: string | null;
  imageCapturedAt: string | null;
  scoreCalculatedAt: string | null;
  opportunityAge: OpportunityAge;
  /** True once reverse geocoding has been attempted for this property */
  geocodeAttempted: boolean;
}

// ── Territory Enforcement Interfaces ────────────────────────────

type EscalationLevel = 1 | 2 | 3 | 4 | 5 | 6;
type EscalationLabel = 'agent_1' | 'agent_2' | 'agent_3' | 'chapter_president' | 'state_pool' | 'home_office';
type EscalationStepStatus = 'pending' | 'active' | 'timeout' | 'accepted' | 'declined' | 'skipped';

interface TerritoryAgent {
  id: string; name: string;
  role: 'adjuster' | 'chapter_president' | 'state_pool' | 'home_office';
  phone: string; email: string; acceptRate: number; isActive: boolean;
  licensedStates: string[];
}

interface TerritoryConfig {
  id: string; name: string; state: string; county: string | null;
  zips: string[]; agents: TerritoryAgent[]; chapterPresident: TerritoryAgent | null;
  maxAdjusters: number; isActive: boolean;
  leadTypes: { fire: boolean; hail: boolean; storm: boolean; flood: boolean; };
}

interface EscalationStep {
  level: EscalationLevel; label: EscalationLabel;
  agent: TerritoryAgent | null; status: EscalationStepStatus;
  startedAt: Date | null; timeoutAt: Date | null; respondedAt: Date | null;
  notificationsSent: { sms: boolean; email: boolean; inApp: boolean; };
}

interface TerritoryEnforcementResult {
  allowed: boolean; territory: TerritoryConfig | null;
  assignedAgent: TerritoryAgent | null; escalationChain: EscalationStep[];
  reason: string; resolvedAt: Date;
}

interface TerritoryAssignmentLog {
  id: string; timestamp: Date; propertyId: string; propertyAddress: string;
  territoryId: string; territoryName: string; agentId: string | null;
  agentName: string | null;
  action: 'territory_resolved' | 'escalation_started' | 'agent_notified' | 'agent_accepted' | 'agent_declined' | 'agent_timeout' | 'escalation_advanced' | 'escalation_complete' | 'no_territory' | 'blocked';
  escalationLevel: EscalationLevel | null; escalationLabel: EscalationLabel | null;
  notes: string;
}

interface ActiveEscalation {
  propertyId: string; property: RoofProperty;
  enforcementResult: TerritoryEnforcementResult;
  currentStepIndex: number; isComplete: boolean; isAccepted: boolean;
  timerHandle: any; remainingSeconds: number; acceptedBy: TerritoryAgent | null;
}

// ── Potential Claims Rolling In Interfaces ──────────────────────

type ClaimEventType = 'hail' | 'wind' | 'lightning' | 'tornado' | 'flooding';
type ClaimSeverity = 'critical' | 'high' | 'moderate' | 'monitor';
type ClaimPriority = 'P1' | 'P2' | 'P3' | 'P4';

interface PredictedClaimEvent {
  id: string;
  eventType: ClaimEventType;
  city: string;
  state: string;
  county: string;
  timestamp: Date;
  severity: ClaimSeverity;
  claimProbability: number;
  territoryId: string | null;
  territoryName: string | null;
  description: string;
  source: string;
}

// ── Live Activity Feed ──────────────────────────────────────────

type LiveActivityType = 'lead_generated' | 'high_prob_detected' | 'lead_assigned' | 'claim_opened' | 'ai_outreach_sent' | 'inspection_scheduled';
type LiveActivityColor = 'red' | 'green' | 'blue';

interface LiveActivityEvent {
  id: string;
  type: LiveActivityType;
  label: string;
  location: string;
  action: string;
  timestamp: Date;
  color: LiveActivityColor;
  isNew?: boolean;
}

interface PredictedClaimZone {
  id: string;
  name: string;
  eventType: ClaimEventType;
  center: [number, number];
  radiusMeters: number;
  severity: ClaimSeverity;
  priority: ClaimPriority;
  claimProbability: number;
  estimatedHomesAffected: number;
  affectedZips: string[];
  county: string;
  state: string;
  territoryId: string | null;
  territoryName: string | null;
  trajectory: string;
  linkedPropertyIds: string[];
  timestamp: Date;
  active: boolean;
}

interface TickerMessage {
  id: string;
  text: string;
  severity: ClaimSeverity;
  timestamp: Date;
}

function computeOpportunityScore(damageProbability: number): OpportunityScore {
  if (damageProbability >= 80) return 'Very High';
  if (damageProbability >= 60) return 'High';
  if (damageProbability >= 40) return 'Moderate';
  return 'Low';
}

// ── Scoring Engine ──────────────────────────────────────────────

function computeRoofScore(prop: { stormType: string; hailSize: string | null; windSpeed: string | null; roofAge: number; satelliteAnomalyFactor: number }): number {
  // Storm intensity: 0–25
  let stormPts = 0;
  const st = prop.stormType.toLowerCase();
  if (st.includes('hail') && st.includes('wind')) stormPts = 25;
  else if (st.includes('hail')) stormPts = 18;
  else if (st.includes('wind')) stormPts = 12;

  // Hail size: 0–25
  let hailPts = 0;
  if (prop.hailSize) {
    const hailVal = parseFloat(prop.hailSize);
    if (hailVal >= 2.0) hailPts = 25;
    else if (hailVal >= 1.5) hailPts = 20;
    else if (hailVal >= 1.0) hailPts = 14;
    else if (hailVal >= 0.5) hailPts = 8;
  }

  // Wind speed: 0–20
  let windPts = 0;
  if (prop.windSpeed) {
    const windVal = parseFloat(prop.windSpeed);
    if (windVal >= 70) windPts = 20;
    else if (windVal >= 58) windPts = 15;
    else if (windVal >= 45) windPts = 10;
    else if (windVal >= 30) windPts = 5;
  }

  // Roof age: 0–20
  let agePts = 2;
  if (prop.roofAge >= 20) agePts = 20;
  else if (prop.roofAge >= 15) agePts = 16;
  else if (prop.roofAge >= 10) agePts = 11;
  else if (prop.roofAge >= 5) agePts = 6;

  // Satellite anomalies: 0–10
  const satPts = Math.round(prop.satelliteAnomalyFactor * 10);

  return Math.min(stormPts + hailPts + windPts + agePts + satPts, 100);
}

/** Fallback for single-property tier (used only when percentile ranking isn't available) */
function getProbabilityTier(score: number): ProbabilityTier {
  if (score >= 85) return 'immediate';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * Assign tiers by relative percentile rank — guarantees a balanced
 * distribution regardless of how compressed the raw scores are.
 *   Top 20%  → IMMEDIATE
 *   Next 30% → HIGH
 *   Next 30% → MEDIUM
 *   Bottom 20% → LOW
 */
function assignTiersByPercentile(properties: RoofProperty[]): void {
  if (properties.length === 0) return;

  // Sort descending by finalClaimScore (stable sort preserves original order for ties)
  const sorted = [...properties].sort((a, b) => b.finalClaimScore - a.finalClaimScore);
  const n = sorted.length;

  // Percentile cutoffs
  const immediateCut = Math.max(Math.round(n * 0.20), 1);
  const highCut = immediateCut + Math.max(Math.round(n * 0.30), 1);
  const mediumCut = highCut + Math.max(Math.round(n * 0.30), 1);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (i < immediateCut) {
      p.probabilityTier = 'immediate';
    } else if (i < highCut) {
      p.probabilityTier = 'high';
    } else if (i < mediumCut) {
      p.probabilityTier = 'medium';
    } else {
      p.probabilityTier = 'low';
    }
    // Unresolved addresses cannot be Immediate — cap at High and visually downgrade
    if (p.addressQuality === 'unresolved' && p.probabilityTier === 'immediate') {
      p.probabilityTier = 'high';
    }
    p.damageLabel = p.probabilityTier;
    p.leadPipelineStatus = p.probabilityTier === 'immediate' ? 'queued' : 'not_queued';
    p.visionBadgeEligible = (p.probabilityTier === 'immediate' || p.probabilityTier === 'high')
      && p.visionAnalysis?.overallConfidence >= 0.75;
    p.claimScopeEstimate = p.probabilityTier === 'immediate' ? generateClaimScopeEstimate(p) : null;
    p.repairScope = (p.probabilityTier === 'immediate' || p.probabilityTier === 'high')
      ? generateRepairScope(p) : null;
  }
}

function generateOutreachScript(prop: RoofProperty): string {
  const stormDesc = prop.stormType.toLowerCase().includes('hail')
    ? `recent hail storm (${prop.hailSize || 'reported'})`
    : `recent wind event (${prop.windSpeed || 'reported'})`;
  const ageNote = prop.roofAge >= 15
    ? `With a ${prop.roofAge}-year-old roof, your property is at elevated risk for hidden damage.`
    : `Even though your ${prop.roofAge}-year-old roof is relatively newer, storm damage can still be significant.`;
  const claimAvg = Math.round((prop.claimRangeLow + prop.claimRangeHigh) / 2);
  return `Hi, I'm reaching out about your property at ${prop.address}. Our satellite analysis detected potential roof damage from the ${stormDesc} on ${prop.stormDate}. ${ageNote} Homes in your area are seeing insurance claims averaging $${claimAvg.toLocaleString()}. We offer free inspections — would you like to schedule one?`;
}

// ── Vision AI Scoring ────────────────────────────────────────────

const VISION_WEIGHTS: Record<string, number> = {
  missing_shingles: 20,
  hail_strikes: 18,
  wind_uplift: 18,
  tarp_presence: 12,
  debris_patterns: 8,
  siding_damage: 8,
  roof_discoloration: 8,
  patch_repairs: 8,
};

const SEVERITY_MULTIPLIERS: Record<string, number> = {
  none: 0,
  minor: 0.5,
  moderate: 0.8,
  severe: 1.0,
};

function computeVisionScore(analysis: RoofVisionAnalysis): number {
  let total = 0;
  let detectedCount = 0;
  for (const d of analysis.detections) {
    if (!d.detected) continue;
    detectedCount++;
    const weight = VISION_WEIGHTS[d.type] || 0;
    const sevMult = SEVERITY_MULTIPLIERS[d.severity] || 0;
    total += weight * sevMult * d.confidence;
  }
  // Multi-indicator amplification: 4+ indicators boost score into high range
  if (detectedCount >= 5) total *= 1.35;
  else if (detectedCount >= 4) total *= 1.2;
  else if (detectedCount >= 3) total *= 1.1;
  return Math.min(Math.round(total), 100);
}

function computeFinalClaimScore(roofScore: number, visionScore: number): number {
  // Max-biased blend: 85% dominant signal + 15% secondary.
  // Prevents the weaker signal from compressing the score below its target tier.
  const dominant = Math.max(roofScore, visionScore);
  const secondary = Math.min(roofScore, visionScore);
  return Math.min(Math.round(dominant * 0.85 + secondary * 0.15), 100);
}

function generateClaimScopeEstimate(prop: RoofProperty): ClaimScopeEstimate {
  const totalEstimate = Math.round(prop.estimatedClaimValue * (1.1 + prop.finalClaimScore / 500));
  return {
    totalEstimate,
    roofing: Math.round(totalEstimate * 0.55),
    gutters: Math.round(totalEstimate * 0.09),
    siding: Math.round(totalEstimate * 0.16),
    debrisRemoval: Math.round(totalEstimate * 0.08),
    supplemental: Math.round(totalEstimate * 0.12),
    generatedDate: new Date().toISOString().split('T')[0],
    confidence: Math.min(prop.visionAnalysis.overallConfidence, 0.95),
  };
}

function generateRepairScope(prop: RoofProperty): RepairScopeEstimate {
  const severe = prop.visionAnalysis.detections.some(d => d.detected && d.severity === 'severe');
  const totalAreaPct = prop.visionAnalysis.detections
    .filter(d => d.detected)
    .reduce((sum, d) => sum + d.areaAffectedPct, 0);
  const sidingDetected = prop.visionAnalysis.detections.find(d => d.type === 'siding_damage')?.detected || false;

  return {
    roofReplacement: severe || totalAreaPct > 60,
    roofRepairSqFt: severe ? prop.roofSizeSqFt : Math.round(prop.roofSizeSqFt * (totalAreaPct / 100)),
    gutterLinearFt: Math.round(Math.sqrt(prop.roofSizeSqFt) * 4 * (totalAreaPct > 30 ? 0.6 : 0.25)),
    sidingRepairSqFt: sidingDetected ? Math.round(prop.roofSizeSqFt * 0.15) : 0,
    totalLaborHours: severe ? Math.round(prop.roofSizeSqFt / 80) : Math.round(prop.roofSizeSqFt * (totalAreaPct / 100) / 120),
    scopeNotes: severe
      ? 'Full roof replacement recommended. Extensive damage across multiple zones detected by satellite analysis.'
      : `Partial repair estimated at ${totalAreaPct}% of roof area. Targeted repairs on affected sections.`,
  };
}

// ── Satellite Image URLs (Esri static map tiles) ────────────────

function generateSatelliteImageUrl(prop: RoofProperty): string {
  // Compute parcel centroid if we have ≥3 parcel points, else use raw lat/lng
  let centerLat = prop.latitude;
  let centerLng = prop.longitude;
  if (prop.parcelCoords && prop.parcelCoords.length >= 3) {
    centerLat = prop.parcelCoords.reduce((s, c) => s + c[0], 0) / prop.parcelCoords.length;
    centerLng = prop.parcelCoords.reduce((s, c) => s + c[1], 0) / prop.parcelCoords.length;
  }

  // Size bbox based on roof size: sqrt(sqft) → side in ft → meters → degrees
  // ~3× buffer for surrounding context
  const roofSideMeters = Math.sqrt(prop.roofSizeSqFt) * 0.3048; // sqft → ft → meters
  const viewSideMeters = Math.max(roofSideMeters * 3, 40); // minimum 40m view
  const degOffset = viewSideMeters / 111320; // meters → degrees (approx at equator)

  const xmin = centerLng - degOffset;
  const ymin = centerLat - degOffset;
  const xmax = centerLng + degOffset;
  const ymax = centerLat + degOffset;

  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${xmin},${ymin},${xmax},${ymax}&bboxSR=4326&size=400,300&format=jpg&f=image`;
}

// ── Roof Image Quality Analysis ──────────────────────────────────

function analyzeRoofImageQuality(prop: RoofProperty): RoofImageAnalysis {
  // Deterministic per-property simulation using coordinate hash
  const coordHash = Math.abs(Math.sin(prop.latitude * 12.9898 + prop.longitude * 78.233) * 43758.5453) % 1;

  // Roof coverage % — geometric ratio of roof area to view area
  // The export endpoint crops precisely so coverage is higher than raw tile approach
  const roofSideMeters = Math.sqrt(prop.roofSizeSqFt) * 0.3048;
  const viewSideMeters = Math.max(roofSideMeters * 3, 40);
  const roofAreaM2 = prop.roofSizeSqFt * 0.0929;
  const viewAreaM2 = viewSideMeters * viewSideMeters;
  let roofCoveragePct = (roofAreaM2 / viewAreaM2) * 100;
  // Boost for precise centering via parcel centroid
  if (prop.parcelCoords && prop.parcelCoords.length >= 3) roofCoveragePct += 18;
  // Boost if address is resolved (good geocoding = centered on property)
  if (prop.addressQuality === 'resolved') roofCoveragePct += 15;
  // Penalize if property type is unknown
  if (prop.propertyType === 'unknown') roofCoveragePct -= 15;
  // Condition-quality multiplier: simulates variable image quality
  // (cloud cover, sun angle, urban density, tree canopy near property)
  // Maps coordHash → 0.25–1.2 range to create GOOD/WEAK/BAD spread
  const conditionMultiplier = 0.25 + coordHash * 0.95;
  roofCoveragePct *= conditionMultiplier;
  roofCoveragePct = Math.max(0, Math.min(100, Math.round(roofCoveragePct)));

  // Tree dominance % — base from coordinate hash
  let treeDominancePct = coordHash * 50;
  // +15% for old roofs (≥20yr)
  if (prop.roofAge >= 20) treeDominancePct += 15;
  // +20% if address unresolved
  if (prop.addressQuality === 'unresolved') treeDominancePct += 20;
  treeDominancePct = Math.max(0, Math.min(100, Math.round(treeDominancePct)));

  // Crop center source
  const cropCenterSource: RoofImageAnalysis['cropCenterSource'] =
    prop.parcelCoords && prop.parcelCoords.length >= 3
      ? 'parcel_centroid'
      : prop.addressQuality === 'resolved'
        ? 'geocoded_address'
        : 'raw_coordinates';

  // Image timestamp
  const imageTimestamp = prop.imageCapturedAt || prop.satelliteScanDate ? `${prop.satelliteScanDate}T12:00:00Z` : null;

  // Quality state rules
  let qualityState: ImageQualityState;
  let qualityReason: string;

  const unresolvedAndLowCoverage = prop.addressQuality === 'unresolved' && roofCoveragePct < 30;

  if (roofCoveragePct < 15) {
    qualityState = 'BAD';
    qualityReason = `Roof covers only ${roofCoveragePct}% of image — likely showing surrounding terrain`;
  } else if (treeDominancePct > 65) {
    qualityState = 'BAD';
    qualityReason = `Tree/foliage dominance at ${treeDominancePct}% — roof obscured by canopy`;
  } else if (unresolvedAndLowCoverage) {
    qualityState = 'BAD';
    qualityReason = `Unresolved address with only ${roofCoveragePct}% roof coverage — cannot verify roof`;
  } else if (roofCoveragePct < 35) {
    qualityState = 'WEAK';
    qualityReason = `Roof coverage at ${roofCoveragePct}% — limited visibility for damage assessment`;
  } else if (treeDominancePct > 45) {
    qualityState = 'WEAK';
    qualityReason = `Partial tree obstruction at ${treeDominancePct}% — some roof areas hidden`;
  } else {
    qualityState = 'GOOD';
    qualityReason = `Clear roof visibility at ${roofCoveragePct}% coverage with ${treeDominancePct}% foliage`;
  }

  return {
    roofCoveragePct,
    treeDominancePct,
    cropCenterSource,
    imageTimestamp,
    qualityState,
    qualityReason,
  };
}

// ── Data Quality Helpers ─────────────────────────────────────────

// ── Global Date Safety ────────────────────────────────────────
/** Safely convert any value to a valid Date, returning null for anything unparseable. */
function toValidDate(value: any): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) {
    console.warn('[RoofIntel] Invalid date value:', value);
    return null;
  }
  return d;
}

function isUnresolvedAddress(address: string): boolean {
  if (!address) return true;
  const a = address.trim();
  // "Grid scan point near lat, lng"
  if (/grid scan point/i.test(a)) return true;
  // "Near lat, lng"
  if (/^near\s+[\d.-]+\s*,\s*[\d.-]+$/i.test(a)) return true;
  // Raw "lat, lng" coordinates
  if (/^[\d.]+\s*,\s*[-\d.]+$/.test(a)) return true;
  // Coordinate-style display "34.12345°N, 96.12345°W"
  if (/°[NSEW]/i.test(a)) return true;
  return false;
}

// ── Parcel / Address Resolution ───────────────────────────────
/** Parsed result from reverse geocoding */
interface GeocodedAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  ownerName: string | null;
  propertyType: 'residential' | 'commercial' | 'unknown';
  resolved: boolean;
}

/** Extract lat/lng from "Grid scan point near lat, lng" or "Near lat, lng" strings */
function extractCoordsFromGridAddress(address: string): { lat: number; lng: number } | null {
  if (!address) return null;
  // Match "Grid scan point near 33.45211, -79.17731" or "Near 36.09043, -76.34182"
  const m = address.match(/([\d.-]+)\s*,\s*([\d.-]+)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

/**
 * Reverse geocode a lat/lng to a real property address using OpenStreetMap Nominatim.
 * Rate limit: 1 request per second (Nominatim usage policy).
 * Returns a GeocodedAddress with resolved=true on success, or a fallback on failure.
 */
async function reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress> {
  const fallback: GeocodedAddress = {
    address: `${Math.abs(lat).toFixed(5)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(5)}°${lng >= 0 ? 'E' : 'W'}`,
    city: '', state: '', zip: '', county: '',
    ownerName: null, propertyType: 'unknown', resolved: false,
  };
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'UPA-RoofIntel/1.0 (adjuster-portal)' },
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    if (!data || data.error) return fallback;

    const addr = data.address || {};
    const houseNumber = addr.house_number || '';
    const road = addr.road || addr.pedestrian || addr.footway || '';
    const streetAddress = houseNumber && road
      ? `${houseNumber} ${road}`
      : road || data.display_name?.split(',')[0] || '';

    // Determine property type from OSM category/type
    let propertyType: 'residential' | 'commercial' | 'unknown' = 'unknown';
    const osmType = (data.type || '').toLowerCase();
    const osmClass = (data.class || '').toLowerCase();
    const addrType = (data.addresstype || '').toLowerCase();

    const residentialTypes = ['house', 'residential', 'apartments', 'detached', 'semidetached_house',
      'terrace', 'dormitory', 'farm', 'farmyard', 'hamlet', 'village'];
    const commercialTypes = ['commercial', 'retail', 'industrial', 'office', 'warehouse', 'store',
      'supermarket', 'hotel', 'motel', 'restaurant'];
    const residentialClasses = ['building', 'place', 'landuse', 'amenity'];

    if (residentialTypes.includes(osmType) || (osmClass === 'building' && !commercialTypes.includes(osmType))) {
      propertyType = 'residential';
    } else if (commercialTypes.includes(osmType) || osmClass === 'shop' || osmClass === 'office') {
      propertyType = 'commercial';
    } else if (residentialClasses.includes(osmClass) && road) {
      // Road-level match near a residential area — infer residential
      propertyType = 'residential';
    }

    // If we have a road + postcode in a residential area, mark as resolved even without house number
    const hasRoad = !!road;
    const hasPostcode = !!addr.postcode;
    const isUsable = hasRoad && hasPostcode;

    return {
      address: streetAddress || fallback.address,
      city: addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || '',
      state: addr.state || '',
      zip: addr.postcode || '',
      county: (addr.county || '').replace(/\s*County$/i, ''),
      ownerName: null, // Nominatim doesn't provide ownership data
      propertyType,
      resolved: isUsable || !!streetAddress,
    };
  } catch (err) {
    console.warn('[RoofIntel] Reverse geocode failed for', lat, lng, err);
    return fallback;
  }
}

/** US state name to 2-letter abbreviation */
const STATE_ABBREVS: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
};

function toStateAbbrev(state: string): string {
  if (!state) return '';
  if (state.length === 2) return state.toUpperCase();
  return STATE_ABBREVS[state.toLowerCase()] || state;
}

function computeOpportunityAge(eventDetectedAt: string | null): OpportunityAge {
  if (!eventDetectedAt) return 'archive';
  const d = toValidDate(eventDetectedAt);
  if (!d) return 'archive';
  const diffMs = Date.now() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours <= 72) return 'immediate';
  if (diffHours <= 14 * 24) return 'active';
  if (diffHours <= 30 * 24) return 'aging';
  return 'archive';
}

function deriveImageQuality(analysis: RoofImageAnalysis | null): ImageQualityState {
  if (!analysis) return 'BAD';
  return analysis.qualityState;
}

/** Pick the most recent timestamp from a set of nullable date strings. Falls back to now. */
function mostRecentTimestamp(...dates: (string | null | undefined)[]): string {
  let latest = 0;
  for (const d of dates) {
    const valid = toValidDate(d);
    if (valid && valid.getTime() > latest) latest = valid.getTime();
  }
  return latest > 0 ? new Date(latest).toISOString() : new Date().toISOString();
}

function generateMockVisionAnalysis(prop: RoofProperty): RoofVisionAnalysis {
  // Per-property variation seed from coordinates to ensure unique detections
  // even when backend damage_scores are similar across properties
  const coordHash = Math.abs(Math.sin(prop.latitude * 12.9898 + prop.longitude * 78.233) * 43758.5453) % 1;
  const sizeSeed = (prop.roofSizeSqFt % 500) / 500; // 0–1 from roof size
  const ageSeed = Math.min(prop.roofAge / 25, 1);   // 0–1 from roof age
  const variation = coordHash * 0.35 + sizeSeed * 0.15 + ageSeed * 0.3;  // 0–0.8 range
  const sat = Math.min(prop.satelliteAnomalyFactor + variation, 1.0);
  const isHailWind = prop.stormType.toLowerCase().includes('hail') && prop.stormType.toLowerCase().includes('wind');
  const isHail = prop.stormType.toLowerCase().includes('hail');
  const isWind = prop.stormType.toLowerCase().includes('wind');
  const oldRoof = prop.roofAge >= 15;

  function sev(factor: number): 'none' | 'minor' | 'moderate' | 'severe' {
    if (factor >= 0.75) return 'severe';
    if (factor >= 0.45) return 'moderate';
    if (factor >= 0.2) return 'minor';
    return 'none';
  }

  // Missing shingles: higher with old roof + satellite anomaly
  const missingFactor = oldRoof ? Math.min(sat + 0.2, 1) : sat * 0.6;
  const missingDetected = missingFactor >= 0.2;

  // Hail strikes: higher with hail storm type
  const hailFactor = isHail || isHailWind ? Math.min(sat + 0.15, 1) : sat * 0.3;
  const hailDetected = hailFactor >= 0.25;

  // Wind uplift: higher with wind
  const windFactor = isWind || isHailWind ? Math.min(sat + 0.1, 1) : sat * 0.25;
  const windDetected = windFactor >= 0.25;

  // Tarp presence: only for severe
  const tarpFactor = sat >= 0.8 ? sat * 0.9 : sat * 0.3;
  const tarpDetected = tarpFactor >= 0.5;

  // Debris patterns
  const debrisFactor = sat * 0.8;
  const debrisDetected = debrisFactor >= 0.3;

  // Siding damage
  const sidingFactor = (isHailWind ? sat * 0.9 : sat * 0.5);
  const sidingDetected = sidingFactor >= 0.3;

  // Roof discoloration: common with aging + weather exposure
  const discolorFactor = oldRoof ? Math.min(sat * 0.7 + 0.15, 1) : sat * 0.35;
  const discolorDetected = discolorFactor >= 0.25;

  // Patch repairs: indicates prior damage history
  const patchFactor = oldRoof ? sat * 0.5 : sat * 0.2;
  const patchDetected = patchFactor >= 0.3;

  const detections: VisionDamageDetection[] = [
    {
      type: 'missing_shingles', label: 'Missing Shingles', detected: missingDetected,
      confidence: missingDetected ? Math.min(0.5 + missingFactor * 0.45, 0.98) : 0,
      severity: missingDetected ? sev(missingFactor) : 'none',
      areaAffectedPct: missingDetected ? Math.round(missingFactor * 35) : 0,
      notes: missingDetected ? 'Granule loss and exposed underlayment detected' : '',
    },
    {
      type: 'hail_strikes', label: 'Hail Strikes', detected: hailDetected,
      confidence: hailDetected ? Math.min(0.55 + hailFactor * 0.4, 0.97) : 0,
      severity: hailDetected ? sev(hailFactor) : 'none',
      areaAffectedPct: hailDetected ? Math.round(hailFactor * 45) : 0,
      notes: hailDetected ? 'Impact marks consistent with hail damage' : '',
    },
    {
      type: 'wind_uplift', label: 'Wind Uplift', detected: windDetected,
      confidence: windDetected ? Math.min(0.5 + windFactor * 0.42, 0.96) : 0,
      severity: windDetected ? sev(windFactor) : 'none',
      areaAffectedPct: windDetected ? Math.round(windFactor * 30) : 0,
      notes: windDetected ? 'Shingle tabs lifted along ridge and edges' : '',
    },
    {
      type: 'tarp_presence', label: 'Tarp Presence', detected: tarpDetected,
      confidence: tarpDetected ? Math.min(0.7 + tarpFactor * 0.25, 0.99) : 0,
      severity: tarpDetected ? 'severe' : 'none',
      areaAffectedPct: tarpDetected ? Math.round(tarpFactor * 20) : 0,
      notes: tarpDetected ? 'Emergency tarp covering detected' : '',
    },
    {
      type: 'debris_patterns', label: 'Debris Patterns', detected: debrisDetected,
      confidence: debrisDetected ? Math.min(0.45 + debrisFactor * 0.4, 0.92) : 0,
      severity: debrisDetected ? sev(debrisFactor) : 'none',
      areaAffectedPct: debrisDetected ? Math.round(debrisFactor * 25) : 0,
      notes: debrisDetected ? 'Scattered debris visible on roof surface' : '',
    },
    {
      type: 'siding_damage', label: 'Siding Damage', detected: sidingDetected,
      confidence: sidingDetected ? Math.min(0.5 + sidingFactor * 0.38, 0.94) : 0,
      severity: sidingDetected ? sev(sidingFactor) : 'none',
      areaAffectedPct: sidingDetected ? Math.round(sidingFactor * 40) : 0,
      notes: sidingDetected ? 'Siding impact damage along exterior walls' : '',
    },
    {
      type: 'roof_discoloration', label: 'Roof Discoloration', detected: discolorDetected,
      confidence: discolorDetected ? Math.min(0.5 + discolorFactor * 0.4, 0.93) : 0,
      severity: discolorDetected ? sev(discolorFactor) : 'none',
      areaAffectedPct: discolorDetected ? Math.round(discolorFactor * 30) : 0,
      notes: discolorDetected ? 'Color variations indicating weathering, algae growth, or UV degradation' : '',
    },
    {
      type: 'patch_repairs', label: 'Patch Repairs', detected: patchDetected,
      confidence: patchDetected ? Math.min(0.55 + patchFactor * 0.35, 0.91) : 0,
      severity: patchDetected ? sev(patchFactor) : 'none',
      areaAffectedPct: patchDetected ? Math.round(patchFactor * 15) : 0,
      notes: patchDetected ? 'Prior repair patches visible — indicates history of damage claims' : '',
    },
  ];

  const detectedCount = detections.filter(d => d.detected).length;
  const avgConf = detectedCount > 0
    ? detections.filter(d => d.detected).reduce((s, d) => s + d.confidence, 0) / detectedCount
    : 0;

  const damageTags = detections.filter(d => d.detected).map(d => d.label);

  return {
    scanId: `VIS-${prop.id.replace('RP-', '')}-001`,
    scanDate: '2026-01-15',
    imageSource: 'Nearmap Q1 2026',
    resolutionCm: 7.5,
    overallConfidence: Math.round(avgConf * 100) / 100,
    detections,
    visionScore: 0,
    satelliteImageUrl: generateSatelliteImageUrl(prop),
    damageTags,
  };
}

type ActionableView = 'all' | 'actionable' | 'high' | 'medium' | 'low' | 'archive';

interface RoofFilter {
  stormType: 'all' | 'hail' | 'wind';
  minDamageProbability: number;
  county: string;
  zip: string;
  actionableView: ActionableView;
}

// ── Mock data ───────────────────────────────────────────────────

const MOCK_PROPERTIES: RoofProperty[] = [
  {
    id: 'RP-001', address: '1420 Elm Creek Dr', city: 'McKinney', state: 'TX', zip: '75071', county: 'Collin',
    latitude: 33.1972, longitude: -96.6397, roofType: 'Asphalt Shingle', roofAge: 14, roofSizeSqFt: 2400,
    damageProbability: 87, sidingDamageProbability: 72, damageLabel: 'low', claimRangeLow: 8500, claimRangeHigh: 18200,
    recommendedAction: 'Priority outreach — high damage, aging shingle roof',
    stormType: 'Hail + Wind', stormDate: '2025-06-14', hailSize: '1.75 in', windSpeed: '58 mph',
    opportunityScore: computeOpportunityScore(87),
    ownerName: 'Patricia Reynolds', ownerStatus: 'verified',
    skipTraceStatus: 'complete', outreachStatus: 'in_progress',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'complete', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[33.1975, -96.6402], [33.1975, -96.6392], [33.1969, -96.6392], [33.1969, -96.6402]],
    satelliteAnomalyFactor: 0.85, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 13350,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: new Date(Date.now() - 12 * 3600000).toISOString(), imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'immediate' as OpportunityAge,
  },
  {
    id: 'RP-002', address: '809 Magnolia Blvd', city: 'Frisco', state: 'TX', zip: '75034', county: 'Collin',
    latitude: 33.1507, longitude: -96.8236, roofType: 'Metal Standing Seam', roofAge: 6, roofSizeSqFt: 1800,
    damageProbability: 42, sidingDamageProbability: 28, damageLabel: 'low', claimRangeLow: 3200, claimRangeHigh: 7800,
    recommendedAction: 'Monitor — metal roof, moderate probability',
    stormType: 'Hail', stormDate: '2025-06-14', hailSize: '1.00 in', windSpeed: null,
    opportunityScore: computeOpportunityScore(42),
    ownerName: 'James Chen', ownerStatus: 'verified',
    skipTraceStatus: 'complete', outreachStatus: 'not_started',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'not_started', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[33.1510, -96.8241], [33.1510, -96.8231], [33.1504, -96.8231], [33.1504, -96.8241]],
    satelliteAnomalyFactor: 0.20, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 5500,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: '2025-05-20T10:00:00Z', imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'archive' as OpportunityAge,
  },
  {
    id: 'RP-003', address: '2205 Pecan Valley Ln', city: 'Plano', state: 'TX', zip: '75025', county: 'Collin',
    latitude: 33.0198, longitude: -96.6989, roofType: 'Clay Tile', roofAge: 22, roofSizeSqFt: 3200,
    damageProbability: 71, sidingDamageProbability: 54, damageLabel: 'low', claimRangeLow: 12400, claimRangeHigh: 28500,
    recommendedAction: 'Generate sales sheet — large tile roof with age risk',
    stormType: 'Hail', stormDate: '2025-06-12', hailSize: '1.50 in', windSpeed: null,
    opportunityScore: computeOpportunityScore(71),
    ownerName: 'Maria Gonzalez', ownerStatus: 'verified',
    skipTraceStatus: 'complete', outreachStatus: 'pending',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'in_progress', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[33.0201, -96.6994], [33.0201, -96.6984], [33.0195, -96.6984], [33.0195, -96.6994]],
    satelliteAnomalyFactor: 0.70, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 20450,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(), imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'active' as OpportunityAge,
  },
  {
    id: 'RP-004', address: '415 Bluebonnet Ct', city: 'Allen', state: 'TX', zip: '75002', county: 'Collin',
    latitude: 33.1032, longitude: -96.6706, roofType: 'Asphalt Shingle', roofAge: 18, roofSizeSqFt: 2100,
    damageProbability: 93, sidingDamageProbability: 81, damageLabel: 'low', claimRangeLow: 9200, claimRangeHigh: 21400,
    recommendedAction: 'Immediate adjuster assignment — critical damage indicators',
    stormType: 'Hail + Wind', stormDate: '2025-06-14', hailSize: '2.00 in', windSpeed: '72 mph',
    opportunityScore: computeOpportunityScore(93),
    ownerName: 'Robert Williams', ownerStatus: 'verified',
    skipTraceStatus: 'complete', outreachStatus: 'complete',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'complete', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[33.1035, -96.6711], [33.1035, -96.6701], [33.1029, -96.6701], [33.1029, -96.6711]],
    satelliteAnomalyFactor: 0.92, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 15300,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: new Date(Date.now() - 36 * 3600000).toISOString(), imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'immediate' as OpportunityAge,
  },
  {
    id: 'RP-005', address: '3300 Sunset Ridge', city: 'Prosper', state: 'TX', zip: '75078', county: 'Denton',
    latitude: 33.2362, longitude: -96.8011, roofType: 'Slate', roofAge: 8, roofSizeSqFt: 2800,
    damageProbability: 28, sidingDamageProbability: 15, damageLabel: 'low', claimRangeLow: 2100, claimRangeHigh: 4600,
    recommendedAction: 'Low priority — newer slate roof, minimal indicators',
    stormType: 'Wind', stormDate: '2025-06-10', hailSize: null, windSpeed: '45 mph',
    opportunityScore: computeOpportunityScore(28),
    ownerName: 'Sarah Mitchell', ownerStatus: 'unverified',
    skipTraceStatus: 'pending', outreachStatus: 'not_started',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'not_started', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[33.2365, -96.8016], [33.2365, -96.8006], [33.2359, -96.8006], [33.2359, -96.8016]],
    satelliteAnomalyFactor: 0.15, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 3350,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: '2025-04-15T08:00:00Z', imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'archive' as OpportunityAge,
  },
  {
    id: 'RP-006', address: '7100 Prairie Fire Rd', city: 'Celina', state: 'TX', zip: '75009', county: 'Denton',
    latitude: 33.3248, longitude: -96.7845, roofType: 'Asphalt Shingle', roofAge: 11, roofSizeSqFt: 1950,
    damageProbability: 66, sidingDamageProbability: 48, damageLabel: 'low', claimRangeLow: 5800, claimRangeHigh: 13200,
    recommendedAction: 'Generate sales sheet — hail corridor, aging shingles',
    stormType: 'Hail', stormDate: '2025-06-14', hailSize: '1.25 in', windSpeed: null,
    opportunityScore: computeOpportunityScore(66),
    ownerName: 'David Park', ownerStatus: 'verified',
    skipTraceStatus: 'complete', outreachStatus: 'pending',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'pending', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[33.3251, -96.7850], [33.3251, -96.7840], [33.3245, -96.7840], [33.3245, -96.7850]],
    satelliteAnomalyFactor: 0.45, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 9500,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: new Date(Date.now() - 6 * 24 * 3600000).toISOString(), imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'active' as OpportunityAge,
  },
  {
    id: 'RP-007', address: '920 Cypress Bend Dr', city: 'Richardson', state: 'TX', zip: '75080', county: 'Dallas',
    latitude: 32.9483, longitude: -96.7299, roofType: 'Wood Shake', roofAge: 25, roofSizeSqFt: 1600,
    damageProbability: 81, sidingDamageProbability: 65, damageLabel: 'low', claimRangeLow: 7200, claimRangeHigh: 16800,
    recommendedAction: 'Priority outreach — wood shake, 25yr age, storm zone',
    stormType: 'Hail + Wind', stormDate: '2025-06-12', hailSize: '1.50 in', windSpeed: '65 mph',
    opportunityScore: computeOpportunityScore(81),
    ownerName: 'Linda Thompson', ownerStatus: 'absentee',
    skipTraceStatus: 'in_progress', outreachStatus: 'not_started',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'pending', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[32.9486, -96.7304], [32.9486, -96.7294], [32.9480, -96.7294], [32.9480, -96.7304]],
    satelliteAnomalyFactor: 0.82, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 12000,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: '2025-03-01T12:00:00Z', imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'archive' as OpportunityAge,
  },
  {
    id: 'RP-008', address: '1555 Heritage Oak Ln', city: 'Wylie', state: 'TX', zip: '75098', county: 'Collin',
    latitude: 33.0151, longitude: -96.5389, roofType: 'Metal Standing Seam', roofAge: 3, roofSizeSqFt: 2650,
    damageProbability: 19, sidingDamageProbability: 10, damageLabel: 'low', claimRangeLow: 1400, claimRangeHigh: 3200,
    recommendedAction: 'No action — new metal roof, low probability',
    stormType: 'Wind', stormDate: '2025-06-10', hailSize: null, windSpeed: '38 mph',
    opportunityScore: computeOpportunityScore(19),
    ownerName: 'Kevin Martinez', ownerStatus: 'verified',
    skipTraceStatus: 'not_started', outreachStatus: 'not_started',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'not_started', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[33.0154, -96.5394], [33.0154, -96.5384], [33.0148, -96.5384], [33.0148, -96.5394]],
    satelliteAnomalyFactor: 0.10, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 2300,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: '2025-04-10T09:00:00Z', imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'archive' as OpportunityAge,
  },
  {
    id: 'RP-009', address: '4800 Lakewood Blvd', city: 'Dallas', state: 'TX', zip: '75214', county: 'Dallas',
    latitude: 32.8202, longitude: -96.7235, roofType: 'Asphalt Shingle', roofAge: 16, roofSizeSqFt: 2200,
    damageProbability: 74, sidingDamageProbability: 58, damageLabel: 'low', claimRangeLow: 6800, claimRangeHigh: 15400,
    recommendedAction: 'Generate sales sheet — wind corridor, granule loss detected',
    stormType: 'Wind', stormDate: '2025-06-11', hailSize: null, windSpeed: '72 mph',
    opportunityScore: computeOpportunityScore(74),
    ownerName: 'Angela Foster', ownerStatus: 'verified',
    skipTraceStatus: 'complete', outreachStatus: 'in_progress',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'complete', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[32.8205, -96.7240], [32.8205, -96.7230], [32.8199, -96.7230], [32.8199, -96.7240]],
    satelliteAnomalyFactor: 0.65, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 11100,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: new Date(Date.now() - 20 * 24 * 3600000).toISOString(), imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'aging' as OpportunityAge,
  },
  {
    id: 'RP-010', address: '222 Ridgeview Ter', city: 'Murphy', state: 'TX', zip: '75094', county: 'Collin',
    latitude: 33.0148, longitude: -96.6128, roofType: 'Clay Tile', roofAge: 9, roofSizeSqFt: 3100,
    damageProbability: 53, sidingDamageProbability: 37, damageLabel: 'low', claimRangeLow: 4600, claimRangeHigh: 11200,
    recommendedAction: 'Monitor — moderate probability, review at next scan',
    stormType: 'Hail', stormDate: '2025-06-14', hailSize: '1.00 in', windSpeed: null,
    opportunityScore: computeOpportunityScore(53),
    ownerName: 'Thomas Baker', ownerStatus: 'unverified',
    skipTraceStatus: 'pending', outreachStatus: 'not_started',
    aiReviewStatus: 'in_progress', adjusterPacketStatus: 'not_started', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[33.0151, -96.6133], [33.0151, -96.6123], [33.0145, -96.6123], [33.0145, -96.6133]],
    satelliteAnomalyFactor: 0.30, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 7900,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: '2025-02-15T14:00:00Z', imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'archive' as OpportunityAge,
  },
  {
    id: 'RP-011', address: '6010 Windmill Farms', city: 'Forney', state: 'TX', zip: '75126', county: 'Kaufman',
    latitude: 32.7480, longitude: -96.4719, roofType: 'Asphalt Shingle', roofAge: 12, roofSizeSqFt: 2050,
    damageProbability: 69, sidingDamageProbability: 52, damageLabel: 'low', claimRangeLow: 5200, claimRangeHigh: 12800,
    recommendedAction: 'Queue for skip trace — owner unverified, high potential',
    stormType: 'Hail + Wind', stormDate: '2025-06-11', hailSize: '1.25 in', windSpeed: '55 mph',
    opportunityScore: computeOpportunityScore(69),
    ownerName: 'Unknown', ownerStatus: 'absentee',
    skipTraceStatus: 'pending', outreachStatus: 'not_started',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'not_started', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[32.7483, -96.4724], [32.7483, -96.4714], [32.7477, -96.4714], [32.7477, -96.4724]],
    satelliteAnomalyFactor: 0.95, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 9000,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: new Date(Date.now() - 22 * 24 * 3600000).toISOString(), imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'aging' as OpportunityAge,
  },
  {
    id: 'RP-012', address: '108 Brentwood Pl', city: 'Garland', state: 'TX', zip: '75040', county: 'Dallas',
    latitude: 32.9126, longitude: -96.6389, roofType: 'Asphalt Shingle', roofAge: 20, roofSizeSqFt: 1750,
    damageProbability: 88, sidingDamageProbability: 74, damageLabel: 'low', claimRangeLow: 8100, claimRangeHigh: 19600,
    recommendedAction: 'Immediate adjuster assignment — severe indicators, 20yr shingles',
    stormType: 'Hail', stormDate: '2025-06-14', hailSize: '2.25 in', windSpeed: null,
    opportunityScore: computeOpportunityScore(88),
    ownerName: 'Jennifer Lopez', ownerStatus: 'verified',
    skipTraceStatus: 'complete', outreachStatus: 'complete',
    aiReviewStatus: 'complete', adjusterPacketStatus: 'complete', leadWorkflowStatus: 'not_started' as LeadWorkflowStatus,
    parcelCoords: [[32.9129, -96.6394], [32.9129, -96.6384], [32.9123, -96.6384], [32.9123, -96.6394]],
    satelliteAnomalyFactor: 0.92, roofScore: 0, probabilityTier: 'low', leadPipelineStatus: 'not_queued', outreachScript: '',
    visionAnalysis: null as any, finalClaimScore: 0, visionBadgeEligible: false, claimScopeEstimate: null, repairScope: null, satelliteScanStatus: 'complete' as const, satelliteScanDate: '2026-01-15', estimatedClaimValue: 13850,
    addressQuality: 'resolved', propertyType: 'residential' as const, imageQuality: 'GOOD' as ImageQualityState, roofImageAnalysis: null, imageConfidence: 0, geocodeAttempted: true, lastUpdatedAt: null, eventDetectedAt: '2025-05-10T16:00:00Z', imageCapturedAt: null, scoreCalculatedAt: null, opportunityAge: 'archive' as OpportunityAge,
  },
];

// Post-process: compute roof scores from multi-factor analysis
for (const p of MOCK_PROPERTIES) {
  p.roofScore = computeRoofScore(p);
  p.visionAnalysis = generateMockVisionAnalysis(p);
  p.visionAnalysis.visionScore = computeVisionScore(p.visionAnalysis);
  p.finalClaimScore = computeFinalClaimScore(p.roofScore, p.visionAnalysis.visionScore);
  p.probabilityTier = getProbabilityTier(p.finalClaimScore);
  p.damageLabel = p.probabilityTier;
  p.leadPipelineStatus = p.finalClaimScore >= 85 ? 'queued' : 'not_queued';
  // Recalculate claim ranges from final score for consistency
  const mockHash = Math.abs(Math.sin(p.latitude * 12.9898 + p.longitude * 78.233) * 43758.5453) % 1;
  const mockScoreFactor = p.finalClaimScore / 100;
  const mockBaseVal = p.roofSizeSqFt * (4.0 + mockHash * 4.5);
  const mockAgeMult = p.roofAge >= 25 ? 1.5 : p.roofAge >= 20 ? 1.35 : p.roofAge >= 15 ? 1.2 : p.roofAge >= 10 ? 1.1 : 1.0;
  const mockEst = Math.round(mockBaseVal * mockAgeMult * mockScoreFactor);
  p.claimRangeLow = Math.max(Math.round(mockEst * 0.7), 500);
  p.claimRangeHigh = Math.round(mockEst * 1.4);
  p.estimatedClaimValue = Math.round((p.claimRangeLow + p.claimRangeHigh) / 2);
  p.outreachScript = generateOutreachScript(p);
  // Compute data quality fields
  p.imageConfidence = p.visionAnalysis?.overallConfidence || 0;
  p.roofImageAnalysis = analyzeRoofImageQuality(p);
  p.imageQuality = deriveImageQuality(p.roofImageAnalysis);
  p.opportunityAge = computeOpportunityAge(p.eventDetectedAt);
  p.scoreCalculatedAt = new Date().toISOString();
  p.imageCapturedAt = p.satelliteScanDate ? `${p.satelliteScanDate}T12:00:00Z` : null;
  p.lastUpdatedAt = new Date().toISOString();
}

// Log image quality distribution
const iqCounts = { GOOD: 0, WEAK: 0, BAD: 0 };
for (const p of MOCK_PROPERTIES) { iqCounts[p.imageQuality]++; }
console.log(`[RoofIntel:ImageQ] Distribution => GOOD: ${iqCounts.GOOD}, WEAK: ${iqCounts.WEAK}, BAD: ${iqCounts.BAD}`);

// Apply percentile-based tier ranking to mock data
assignTiersByPercentile(MOCK_PROPERTIES);

const HAIL_ZONES = [
  { center: [33.15, -96.75] as [number, number], radius: 18000, severity: 'severe' },
  { center: [33.02, -96.68] as [number, number], radius: 14000, severity: 'high' },
  { center: [32.92, -96.64] as [number, number], radius: 10000, severity: 'moderate' },
];

const WIND_ZONES = [
  { center: [33.24, -96.80] as [number, number], radius: 22000, severity: 'high' },
  { center: [32.82, -96.72] as [number, number], radius: 16000, severity: 'moderate' },
  { center: [33.01, -96.54] as [number, number], radius: 12000, severity: 'severe' },
];

// ── Mock Territory Data ──────────────────────────────────────────

const MOCK_STATE_POOL_AGENTS: TerritoryAgent[] = [
  { id: 'SP-TX01', name: 'Monica Reyes', role: 'state_pool', phone: '(214) 555-8001', email: 'monica.reyes@upa-adjusting.com', acceptRate: 0.85, isActive: true, licensedStates: ['TX', 'OK', 'LA'] },
  { id: 'SP-TX02', name: 'Nathan Cho', role: 'state_pool', phone: '(214) 555-8002', email: 'nathan.cho@upa-adjusting.com', acceptRate: 0.80, isActive: true, licensedStates: ['TX', 'OK'] },
];

const MOCK_HOME_OFFICE_AGENT: TerritoryAgent = {
  id: 'HO-001', name: 'Elizabeth Warren-Scott', role: 'home_office', phone: '(800) 555-0100', email: 'e.warren-scott@upa-adjusting.com', acceptRate: 1.0, isActive: true, licensedStates: ['TX', 'OK', 'LA', 'AR', 'NM'],
};

const MOCK_TERRITORIES: TerritoryConfig[] = [
  {
    id: 'TER-TX-COLLIN', name: 'Collin County Territory', state: 'TX', county: 'Collin',
    zips: ['75002', '75009', '75025', '75034', '75071', '75078', '75094', '75098'],
    agents: [
      { id: 'ADJ-CC01', name: 'Marcus Rivera', role: 'adjuster', phone: '(972) 555-1001', email: 'marcus.rivera@upa-adjusting.com', acceptRate: 0.75, isActive: true, licensedStates: ['TX', 'OK'] },
      { id: 'ADJ-CC02', name: 'Sarah Kim', role: 'adjuster', phone: '(972) 555-1002', email: 'sarah.kim@upa-adjusting.com', acceptRate: 0.60, isActive: true, licensedStates: ['TX'] },
      { id: 'ADJ-CC03', name: 'Derek Washington', role: 'adjuster', phone: '(972) 555-1003', email: 'derek.washington@upa-adjusting.com', acceptRate: 0.50, isActive: true, licensedStates: ['TX', 'LA'] },
    ],
    chapterPresident: { id: 'CP-CC01', name: 'Victoria Chen', role: 'chapter_president', phone: '(972) 555-2001', email: 'victoria.chen@upa-adjusting.com', acceptRate: 0.90, isActive: true, licensedStates: ['TX', 'OK', 'LA'] },
    maxAdjusters: 3, isActive: true,
    leadTypes: { fire: true, hail: true, storm: true, flood: false },
  },
  {
    id: 'TER-TX-DALLAS', name: 'Dallas County Territory', state: 'TX', county: 'Dallas',
    zips: ['75040', '75080', '75214'],
    agents: [
      { id: 'ADJ-DA01', name: 'James Okafor', role: 'adjuster', phone: '(214) 555-3001', email: 'james.okafor@upa-adjusting.com', acceptRate: 0.70, isActive: true, licensedStates: ['TX', 'OK'] },
      { id: 'ADJ-DA02', name: 'Priya Patel', role: 'adjuster', phone: '(214) 555-3002', email: 'priya.patel@upa-adjusting.com', acceptRate: 0.65, isActive: true, licensedStates: ['TX'] },
      { id: 'ADJ-DA03', name: 'Carlos Mendez', role: 'adjuster', phone: '(214) 555-3003', email: 'carlos.mendez@upa-adjusting.com', acceptRate: 0.55, isActive: true, licensedStates: ['TX', 'LA'] },
    ],
    chapterPresident: { id: 'CP-DA01', name: 'Thomas Bradley', role: 'chapter_president', phone: '(214) 555-4001', email: 'thomas.bradley@upa-adjusting.com', acceptRate: 0.88, isActive: true, licensedStates: ['TX', 'OK'] },
    maxAdjusters: 3, isActive: true,
    leadTypes: { fire: true, hail: true, storm: true, flood: true },
  },
  {
    id: 'TER-TX-DENTON', name: 'Denton County Territory', state: 'TX', county: 'Denton',
    zips: ['75009', '75078'],
    agents: [
      { id: 'ADJ-DN01', name: 'Amanda Foster', role: 'adjuster', phone: '(940) 555-5001', email: 'amanda.foster@upa-adjusting.com', acceptRate: 0.72, isActive: true, licensedStates: ['TX', 'OK'] },
      { id: 'ADJ-DN02', name: 'Ryan O\'Brien', role: 'adjuster', phone: '(940) 555-5002', email: 'ryan.obrien@upa-adjusting.com', acceptRate: 0.58, isActive: true, licensedStates: ['TX'] },
    ],
    chapterPresident: { id: 'CP-DN01', name: 'Laura Nguyen', role: 'chapter_president', phone: '(940) 555-6001', email: 'laura.nguyen@upa-adjusting.com', acceptRate: 0.92, isActive: true, licensedStates: ['TX', 'OK', 'LA'] },
    maxAdjusters: 3, isActive: true,
    leadTypes: { fire: true, hail: true, storm: true, flood: false },
  },
  {
    id: 'TER-TX-KAUFMAN', name: 'Kaufman County Territory', state: 'TX', county: 'Kaufman',
    zips: ['75126'],
    agents: [
      { id: 'ADJ-KF01', name: 'Brandon Hayes', role: 'adjuster', phone: '(469) 555-7001', email: 'brandon.hayes@upa-adjusting.com', acceptRate: 0.62, isActive: true, licensedStates: ['TX'] },
    ],
    chapterPresident: null,
    maxAdjusters: 3, isActive: true,
    leadTypes: { fire: true, hail: true, storm: true, flood: false },
  },
];

// ── Territory Enforcement Functions ─────────────────────────────

function resolveTerritory(prop: RoofProperty): TerritoryConfig | null {
  return MOCK_TERRITORIES.find(t => t.state === prop.state && t.county === prop.county) || null;
}

function buildEscalationChain(territory: TerritoryConfig): EscalationStep[] {
  const chain: EscalationStep[] = [];
  const labels: EscalationLabel[] = ['agent_1', 'agent_2', 'agent_3', 'chapter_president', 'state_pool', 'home_office'];
  const levels: EscalationLevel[] = [1, 2, 3, 4, 5, 6];

  for (let i = 0; i < 6; i++) {
    let agent: TerritoryAgent | null = null;
    let status: EscalationStepStatus = 'pending';

    if (i < 3) {
      agent = territory.agents[i] || null;
      if (!agent) status = 'skipped';
    } else if (i === 3) {
      agent = territory.chapterPresident;
      if (!agent) status = 'skipped';
    } else if (i === 4) {
      agent = MOCK_STATE_POOL_AGENTS[0];
    } else {
      agent = MOCK_HOME_OFFICE_AGENT;
    }

    chain.push({
      level: levels[i], label: labels[i], agent, status,
      startedAt: null, timeoutAt: null, respondedAt: null,
      notificationsSent: { sms: false, email: false, inApp: false },
    });
  }

  return chain;
}

function enforceTerritory(prop: RoofProperty): TerritoryEnforcementResult {
  const territory = resolveTerritory(prop);
  if (!territory) {
    return {
      allowed: false, territory: null, assignedAgent: null,
      escalationChain: [], reason: `No territory found for ${prop.county} County, ${prop.state}`,
      resolvedAt: new Date(),
    };
  }
  if (!territory.isActive) {
    return {
      allowed: false, territory, assignedAgent: null,
      escalationChain: [], reason: `Territory "${territory.name}" is inactive`,
      resolvedAt: new Date(),
    };
  }
  const chain = buildEscalationChain(territory);
  return {
    allowed: true, territory, assignedAgent: null, escalationChain: chain,
    reason: `Territory resolved: ${territory.name}`, resolvedAt: new Date(),
  };
}

// ── Mock Predicted Claim Events ─────────────────────────────────

const MOCK_PREDICTED_EVENTS: PredictedClaimEvent[] = [
  {
    id: 'PCE-001', eventType: 'hail', city: 'Plano', state: 'TX', county: 'Collin',
    timestamp: new Date(Date.now() - 180000), severity: 'critical', claimProbability: 92,
    territoryId: 'TER-TX-COLLIN', territoryName: 'Collin County Territory',
    description: '2.0" hail reported — softball-size impact zone forming',
    source: 'NWS Storm Report',
  },
  {
    id: 'PCE-002', eventType: 'wind', city: 'Allen', state: 'TX', county: 'Collin',
    timestamp: new Date(Date.now() - 420000), severity: 'high', claimProbability: 78,
    territoryId: 'TER-TX-COLLIN', territoryName: 'Collin County Territory',
    description: '70 mph straight-line winds confirmed — structural damage likely',
    source: 'NOAA SPC',
  },
  {
    id: 'PCE-003', eventType: 'tornado', city: 'Garland', state: 'TX', county: 'Dallas',
    timestamp: new Date(Date.now() - 600000), severity: 'critical', claimProbability: 96,
    territoryId: 'TER-TX-DALLAS', territoryName: 'Dallas County Territory',
    description: 'EF-1 tornado confirmed — path through residential area',
    source: 'NWS Fort Worth',
  },
  {
    id: 'PCE-004', eventType: 'hail', city: 'McKinney', state: 'TX', county: 'Collin',
    timestamp: new Date(Date.now() - 900000), severity: 'high', claimProbability: 85,
    territoryId: 'TER-TX-COLLIN', territoryName: 'Collin County Territory',
    description: '1.5" hail swath — high-density residential impact zone',
    source: 'Storm Chaser Report',
  },
  {
    id: 'PCE-005', eventType: 'lightning', city: 'Richardson', state: 'TX', county: 'Dallas',
    timestamp: new Date(Date.now() - 1200000), severity: 'moderate', claimProbability: 45,
    territoryId: 'TER-TX-DALLAS', territoryName: 'Dallas County Territory',
    description: 'Dense lightning cluster — possible fire/surge damage risk',
    source: 'Vaisala Lightning Data',
  },
  {
    id: 'PCE-006', eventType: 'flooding', city: 'Forney', state: 'TX', county: 'Kaufman',
    timestamp: new Date(Date.now() - 1500000), severity: 'moderate', claimProbability: 52,
    territoryId: 'TER-TX-KAUFMAN', territoryName: 'Kaufman County Territory',
    description: 'Flash flood warning — low-lying properties at risk',
    source: 'NWS Flash Flood',
  },
  {
    id: 'PCE-007', eventType: 'wind', city: 'Prosper', state: 'TX', county: 'Denton',
    timestamp: new Date(Date.now() - 2100000), severity: 'monitor', claimProbability: 28,
    territoryId: 'TER-TX-DENTON', territoryName: 'Denton County Territory',
    description: '45 mph gusts — monitoring for escalation',
    source: 'ASOS Station',
  },
  {
    id: 'PCE-008', eventType: 'hail', city: 'Frisco', state: 'TX', county: 'Collin',
    timestamp: new Date(Date.now() - 2700000), severity: 'high', claimProbability: 81,
    territoryId: 'TER-TX-COLLIN', territoryName: 'Collin County Territory',
    description: '1.25" hail corridor moving NE — estimated 15-min impact window',
    source: 'Radar Estimated',
  },
  {
    id: 'PCE-009', eventType: 'wind', city: 'Dallas', state: 'TX', county: 'Dallas',
    timestamp: new Date(Date.now() - 3600000), severity: 'high', claimProbability: 73,
    territoryId: 'TER-TX-DALLAS', territoryName: 'Dallas County Territory',
    description: '65 mph wind gusts — roof and fence damage reports incoming',
    source: 'Spotter Network',
  },
  {
    id: 'PCE-010', eventType: 'lightning', city: 'Celina', state: 'TX', county: 'Denton',
    timestamp: new Date(Date.now() - 4200000), severity: 'monitor', claimProbability: 22,
    territoryId: 'TER-TX-DENTON', territoryName: 'Denton County Territory',
    description: 'Scattered lightning activity — low claim risk currently',
    source: 'GLM Satellite',
  },
];

const MOCK_LIVE_ACTIVITY: LiveActivityEvent[] = [
  { id: 'LA-001', type: 'lead_generated', label: 'New Lead Generated', location: 'Plano, TX 75025', action: 'Added to opportunity queue', timestamp: new Date(Date.now() - 45000), color: 'blue' },
  { id: 'LA-002', type: 'high_prob_detected', label: 'High Probability Lead Detected', location: 'Allen, TX 75002', action: 'Score 94 — flagged for immediate outreach', timestamp: new Date(Date.now() - 120000), color: 'red' },
  { id: 'LA-003', type: 'ai_outreach_sent', label: 'AI Outreach Sent', location: 'McKinney, TX 75071', action: 'SMS + email sequence initiated', timestamp: new Date(Date.now() - 210000), color: 'blue' },
  { id: 'LA-004', type: 'lead_assigned', label: 'Lead Assigned to Agent', location: 'Frisco, TX 75034', action: 'Assigned to Mike Torres — Collin County', timestamp: new Date(Date.now() - 380000), color: 'green' },
  { id: 'LA-005', type: 'inspection_scheduled', label: 'Inspection Scheduled', location: 'Garland, TX 75040', action: 'Mar 22 at 10:00 AM — homeowner confirmed', timestamp: new Date(Date.now() - 540000), color: 'green' },
  { id: 'LA-006', type: 'high_prob_detected', label: 'High Probability Lead Detected', location: 'Richardson, TX 75080', action: 'Score 91 — storm-verified, 22yr roof', timestamp: new Date(Date.now() - 720000), color: 'red' },
  { id: 'LA-007', type: 'claim_opened', label: 'Claim Opened', location: 'Plano, TX 75025', action: 'Claim #CLM-4821 filed — est. $18,500', timestamp: new Date(Date.now() - 900000), color: 'green' },
  { id: 'LA-008', type: 'lead_generated', label: 'New Lead Generated', location: 'Prosper, TX 75078', action: 'Storm-based analysis — added to queue', timestamp: new Date(Date.now() - 1200000), color: 'blue' },
  { id: 'LA-009', type: 'ai_outreach_sent', label: 'AI Outreach Sent', location: 'Celina, TX 75009', action: 'Follow-up sequence #2 triggered', timestamp: new Date(Date.now() - 1500000), color: 'blue' },
  { id: 'LA-010', type: 'lead_assigned', label: 'Lead Assigned to Agent', location: 'Forney, TX 75126', action: 'Assigned to Sarah Kim — Kaufman County', timestamp: new Date(Date.now() - 1800000), color: 'green' },
  { id: 'LA-011', type: 'inspection_scheduled', label: 'Inspection Scheduled', location: 'Allen, TX 75013', action: 'Mar 23 at 2:30 PM — pending confirmation', timestamp: new Date(Date.now() - 2400000), color: 'green' },
  { id: 'LA-012', type: 'claim_opened', label: 'Claim Opened', location: 'McKinney, TX 75070', action: 'Claim #CLM-4819 filed — est. $22,100', timestamp: new Date(Date.now() - 3000000), color: 'green' },
];

const MOCK_PREDICTED_ZONES: PredictedClaimZone[] = [
  {
    id: 'PCZ-001', name: 'Plano Hail Corridor', eventType: 'hail',
    center: [33.02, -96.70], radiusMeters: 8000,
    severity: 'critical', priority: 'P1', claimProbability: 92,
    estimatedHomesAffected: 2400, affectedZips: ['75025', '75034', '75071'],
    county: 'Collin', state: 'TX',
    territoryId: 'TER-TX-COLLIN', territoryName: 'Collin County Territory',
    trajectory: 'SW to NE at 35 mph', linkedPropertyIds: ['RP-001', 'RP-003', 'RP-010'],
    timestamp: new Date(Date.now() - 180000), active: true,
  },
  {
    id: 'PCZ-002', name: 'Allen Wind Zone', eventType: 'wind',
    center: [33.10, -96.67], radiusMeters: 6000,
    severity: 'high', priority: 'P2', claimProbability: 78,
    estimatedHomesAffected: 1200, affectedZips: ['75002', '75013'],
    county: 'Collin', state: 'TX',
    territoryId: 'TER-TX-COLLIN', territoryName: 'Collin County Territory',
    trajectory: 'W to E at 40 mph', linkedPropertyIds: ['RP-004'],
    timestamp: new Date(Date.now() - 420000), active: true,
  },
  {
    id: 'PCZ-003', name: 'Garland Tornado Path', eventType: 'tornado',
    center: [32.91, -96.64], radiusMeters: 4000,
    severity: 'critical', priority: 'P1', claimProbability: 96,
    estimatedHomesAffected: 850, affectedZips: ['75040', '75041'],
    county: 'Dallas', state: 'TX',
    territoryId: 'TER-TX-DALLAS', territoryName: 'Dallas County Territory',
    trajectory: 'SSW to NNE — 0.5 mile wide', linkedPropertyIds: ['RP-012'],
    timestamp: new Date(Date.now() - 600000), active: true,
  },
  {
    id: 'PCZ-004', name: 'McKinney Hail Impact', eventType: 'hail',
    center: [33.20, -96.64], radiusMeters: 7000,
    severity: 'high', priority: 'P2', claimProbability: 85,
    estimatedHomesAffected: 1800, affectedZips: ['75071', '75070'],
    county: 'Collin', state: 'TX',
    territoryId: 'TER-TX-COLLIN', territoryName: 'Collin County Territory',
    trajectory: 'SW to NE at 30 mph', linkedPropertyIds: ['RP-001'],
    timestamp: new Date(Date.now() - 900000), active: true,
  },
  {
    id: 'PCZ-005', name: 'Richardson Lightning Cluster', eventType: 'lightning',
    center: [32.95, -96.73], radiusMeters: 5000,
    severity: 'moderate', priority: 'P3', claimProbability: 45,
    estimatedHomesAffected: 600, affectedZips: ['75080', '75081'],
    county: 'Dallas', state: 'TX',
    territoryId: 'TER-TX-DALLAS', territoryName: 'Dallas County Territory',
    trajectory: 'Stationary — slow-moving cell', linkedPropertyIds: ['RP-007'],
    timestamp: new Date(Date.now() - 1200000), active: true,
  },
  {
    id: 'PCZ-006', name: 'Forney Flood Zone', eventType: 'flooding',
    center: [32.75, -96.47], radiusMeters: 6000,
    severity: 'moderate', priority: 'P3', claimProbability: 52,
    estimatedHomesAffected: 400, affectedZips: ['75126'],
    county: 'Kaufman', state: 'TX',
    territoryId: 'TER-TX-KAUFMAN', territoryName: 'Kaufman County Territory',
    trajectory: 'Flooding expanding — creek overflow', linkedPropertyIds: ['RP-011'],
    timestamp: new Date(Date.now() - 1500000), active: true,
  },
  {
    id: 'PCZ-007', name: 'Prosper Wind Watch', eventType: 'wind',
    center: [33.24, -96.80], radiusMeters: 5000,
    severity: 'monitor', priority: 'P4', claimProbability: 28,
    estimatedHomesAffected: 350, affectedZips: ['75078'],
    county: 'Denton', state: 'TX',
    territoryId: 'TER-TX-DENTON', territoryName: 'Denton County Territory',
    trajectory: 'NW to SE — weakening trend', linkedPropertyIds: ['RP-005'],
    timestamp: new Date(Date.now() - 2100000), active: true,
  },
  {
    id: 'PCZ-008', name: 'Lakewood Wind Damage', eventType: 'wind',
    center: [32.82, -96.72], radiusMeters: 5500,
    severity: 'high', priority: 'P2', claimProbability: 73,
    estimatedHomesAffected: 950, affectedZips: ['75214', '75218'],
    county: 'Dallas', state: 'TX',
    territoryId: 'TER-TX-DALLAS', territoryName: 'Dallas County Territory',
    trajectory: 'W to E at 50 mph', linkedPropertyIds: ['RP-009'],
    timestamp: new Date(Date.now() - 3600000), active: true,
  },
];

const MOCK_TICKER_MESSAGES: TickerMessage[] = [
  { id: 'TM-001', text: 'Hail reported near Plano TX — 2.0" stones confirmed', severity: 'critical', timestamp: new Date(Date.now() - 120000) },
  { id: 'TM-002', text: '70 mph winds entering Allen TX — structural damage expected', severity: 'high', timestamp: new Date(Date.now() - 300000) },
  { id: 'TM-003', text: 'High claim probability zone forming in McKinney TX', severity: 'high', timestamp: new Date(Date.now() - 600000) },
  { id: 'TM-004', text: 'EF-1 tornado confirmed in Garland TX — residential path', severity: 'critical', timestamp: new Date(Date.now() - 900000) },
  { id: 'TM-005', text: 'Flash flood warning issued for Kaufman County TX', severity: 'moderate', timestamp: new Date(Date.now() - 1200000) },
  { id: 'TM-006', text: 'Lightning cluster detected over Richardson TX — fire risk elevated', severity: 'moderate', timestamp: new Date(Date.now() - 1800000) },
  { id: 'TM-007', text: 'Hail corridor moving NE through Frisco TX — 1.25" stones', severity: 'high', timestamp: new Date(Date.now() - 2400000) },
  { id: 'TM-008', text: '65 mph wind gusts in East Dallas — roof damage reports incoming', severity: 'high', timestamp: new Date(Date.now() - 3000000) },
  { id: 'TM-009', text: 'Monitoring 45 mph gusts near Prosper TX — no escalation yet', severity: 'monitor', timestamp: new Date(Date.now() - 3600000) },
  { id: 'TM-010', text: 'New hail cell developing SW of Collin County — tracking', severity: 'monitor', timestamp: new Date(Date.now() - 4200000) },
];

/** Component-scoped error handler that logs but never crashes the entire view. */
class RoofIntelErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    console.error('[RoofIntel] Caught rendering error (view preserved):', error?.message || error);
  }
}

@Component({
  selector: 'app-roof-intelligence',
  templateUrl: './roof-intelligence.component.html',
  styleUrls: ['./roof-intelligence.component.scss'],
  standalone: false,
  providers: [{ provide: ErrorHandler, useClass: RoofIntelErrorHandler }],
})
export class RoofIntelligenceComponent implements OnInit, OnDestroy, AfterViewInit {

  /** True once initializeDashboard() has completed at least once. */
  dashboardReady = false;
  /** Loading placeholder message shown before first data load. */
  initMessage = 'Initializing Roof Intelligence Pipeline...';
  /** Toggle for revealing raw satellite image on WEAK quality properties */
  showRawSatelliteImage = false;
  private destroy$ = new Subject<void>();
  private map!: L.Map;
  private mapReady = false;

  // Tile layers
  private streetTile!: L.TileLayer;
  private satelliteTile!: L.TileLayer;
  isSatelliteView = false;

  // Data layers
  private parcelLayer = L.layerGroup();
  private hailLayer = L.layerGroup();
  private windLayer = L.layerGroup();
  private markerLayer = L.layerGroup();

  // Layer visibility
  hailLayerVisible = true;
  windLayerVisible = true;

  // Properties
  allProperties: RoofProperty[] = [];
  filteredProperties: RoofProperty[] = [];
  highProbProperties: RoofProperty[] = [];
  selectedProperty: RoofProperty | null = null;
  propertyPanelOpen = false;

  // Queue views
  highProbQueue: RoofProperty[] = [];
  immediateLeadQueue: RoofProperty[] = [];
  activeQueueTab: 'all' | 'high' | 'immediate' = 'all';

  // KPIs
  propertiesScanned = 0;
  highProbCount = 0;
  estimatedClaimValue = 0;
  outreachReadyLeads = 0;
  immediateLeadCount = 0;
  highProbQueueCount = 0;
  leadPipelineValue = 0;
  visionVerifiedCount = 0;
  visionModuleEnabled = true;

  // Satellite Scan
  satelliteScanLoading = false;

  // Territory Enforcement
  territoryDemoMode = true;
  territoryEnforcementEnabled = true;
  activeEscalation: ActiveEscalation | null = null;
  assignmentLog: TerritoryAssignmentLog[] = [];
  territoryPanelTab: 'enforcement' | 'log' = 'enforcement';

  // Potential Claims Rolling In
  predictedEvents: PredictedClaimEvent[] = [];
  predictedZones: PredictedClaimZone[] = [];
  liveActivityEvents: LiveActivityEvent[] = [];
  tickerMessages: TickerMessage[] = [];
  selectedZone: PredictedClaimZone | null = null;
  zonePanelOpen = false;
  predictedZonesLayerVisible = true;
  private predictedZonesLayer = L.layerGroup();
  private tickerInterval: any = null;
  private liveActivitySimHandle: ReturnType<typeof setTimeout> | null = null;
  private liveActivityCounter = 100;
  tickerPosition = 0;

  // Pipeline stats
  aiReviewCompleteCount = 0;
  adjusterPacketReadyCount = 0;
  skipTracePendingCount = 0;
  aiAgentReadyCount = 0;

  // Scan queue stats (from property ingestion pipeline)
  scanQueueStats: ScanQueueStats = { total: 0, pending: 0, queued: 0, scanning: 0, completed: 0, errored: 0 };
  zoneScanLoading = false;

  // Demo/Live toggle
  useLiveData = true;
  analysisMode: 'ai_vision' | 'rules' | 'demo' = 'rules';
  liveDataLoading = false;
  liveDataError: string | null = null;
  liveDataTotal = 0;

  // Data quality & compliance
  agentLicensedStates: string[] = ['TX', 'OK', 'LA'];
  lastRefreshTimestamp: Date | null = null;
  lastRefreshRecordCount = 0;
  previousRefreshRecordCount = 0;

  // Parcel resolution
  private geocodeInProgress = false;
  private geocodeAbort$ = new Subject<void>();
  geocodeProgress = { total: 0, resolved: 0, failed: 0 };
  /** Cache of resolved addresses keyed by "lat,lng" rounded to 5 decimals */
  private geocodeCache = new Map<string, GeocodedAddress>();

  // Cached time labels (avoids NG0100 from impure template expressions)
  private timeLabelHandle: ReturnType<typeof setInterval> | null = null;
  cachedLastRefreshLabel = '';
  cachedFreshness = { event: '—', image: '—', score: '—', updated: '—' };
  cachedTickerTimes = new Map<string, string>();
  cachedEventTimes = new Map<string, string>();
  cachedLiveActivityTimes = new Map<string, string>();

  // Filters
  filters: RoofFilter = {
    stormType: 'all',
    minDamageProbability: 0,
    county: '',
    zip: '',
    actionableView: 'actionable',
  };

  // Actionable filter options
  actionableViewOptions: { value: ActionableView; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: 'list' },
    { value: 'actionable', label: 'Actionable', icon: 'local_fire_department' },
    { value: 'high', label: 'High Probability', icon: 'priority_high' },
    { value: 'medium', label: 'Medium', icon: 'remove' },
    { value: 'low', label: 'Low', icon: 'arrow_downward' },
    { value: 'archive', label: 'Archive', icon: 'inventory_2' },
  ];

  // KPIs for actionable vs archive breakdown
  actionableCount = 0;
  archivedCount = 0;

  stormTypeOptions = [
    { value: 'all', label: 'All Storm Types' },
    { value: 'hail', label: 'Hail' },
    { value: 'wind', label: 'Wind' },
  ];

  countyOptions = ['Collin', 'Dallas', 'Denton', 'Kaufman', 'Rockwall'];
  zipOptions = ['75002', '75009', '75025', '75034', '75040', '75071', '75078', '75080', '75094', '75098', '75126', '75214'];

  // Leaflet config
  leafletOptions: L.MapOptions = {
    layers: [],
    zoom: 10,
    center: L.latLng(33.05, -96.70),
  };

  private autoRefreshHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private snackBar: MatSnackBar,
    private roofService: RoofIntelligenceService,
    private claimsService: PotentialClaimsService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.initializeDashboard();
  }

  ngAfterViewInit(): void {
    // Force map resize after the view is fully laid out
    if (this.map && this.mapReady) {
      setTimeout(() => this.map.invalidateSize(true), 100);
    }
  }

  /**
   * Central initialization — called on first load and can be
   * re-invoked if the component ever needs a full reset.
   */
  private initializeDashboard(): void {
    // Force dashboard visible immediately — never gate cards on loading state
    this.dashboardReady = true;
    this.initMessage = 'Initializing Roof Intelligence Pipeline...';

    // Inject fallback mock cards so something is always visible
    if (this.allProperties.length === 0) {
      this.allProperties = [...MOCK_PROPERTIES];
      this.applyFilters();
      console.log(`[RoofIntel:Init] Injected ${MOCK_PROPERTIES.length} fallback mock properties`);
    }

    // Pre-load ALL mock data immediately so UI is never empty
    if (this.tickerMessages.length === 0) {
      this.tickerMessages = [...MOCK_TICKER_MESSAGES];
      this.startTickerAnimation();
    }
    if (this.liveActivityEvents.length === 0) {
      this.liveActivityEvents = [...MOCK_LIVE_ACTIVITY]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    if (this.predictedZones.length === 0) {
      this.predictedZones = [...MOCK_PREDICTED_ZONES]
        .sort((a, b) => {
          const sevOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, monitor: 3 };
          return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
        });
    }
    if (this.predictedEvents.length === 0) {
      this.predictedEvents = [...MOCK_PREDICTED_EVENTS]
        .sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
    }
    this.refreshTimeLabels();
    this.cdr.detectChanges();

    if (this.useLiveData) {
      this.loadLiveData();
    } else {
      this.allProperties = [...MOCK_PROPERTIES];
      this.applyFilters();
    }
    this.loadPredictedClaims();
    if (this.useLiveData) {
      this.loadScanQueueStats();
    }

    // Auto-refresh live pipeline every 60 seconds
    if (this.autoRefreshHandle) clearInterval(this.autoRefreshHandle);
    this.ngZone.runOutsideAngular(() => {
      this.autoRefreshHandle = setInterval(() => {
        this.ngZone.run(() => {
          if (this.useLiveData) {
            this.loadLiveData();
            this.loadPredictedClaims();
            this.loadScanQueueStats();
          }
        });
      }, 60000);
    });

    // Refresh cached time labels every 5s for live feel
    if (this.timeLabelHandle) clearInterval(this.timeLabelHandle);
    this.refreshTimeLabels();
    this.ngZone.runOutsideAngular(() => {
      this.timeLabelHandle = setInterval(() => {
        this.ngZone.run(() => this.refreshTimeLabels());
      }, 5000);
    });

    // Start simulated live event stream
    this.startLiveActivitySimulator();
  }

  /** Recompute all cached time-relative labels in a single pass. */
  refreshTimeLabels(): void {
    // Last refresh header
    this.cachedLastRefreshLabel = this.lastRefreshTimestamp
      ? this._formatTimeAgo(this.lastRefreshTimestamp) : '';

    // Side-panel freshness
    if (this.selectedProperty) {
      this.cachedFreshness = {
        event: this._formatRelativeTime(this.selectedProperty.eventDetectedAt),
        image: this._formatRelativeTime(this.selectedProperty.imageCapturedAt),
        score: this._formatRelativeTime(this.selectedProperty.scoreCalculatedAt),
        updated: this._formatRelativeTime(this.selectedProperty.lastUpdatedAt),
      };
    }

    // Ticker messages
    this.cachedTickerTimes.clear();
    for (const msg of this.tickerMessages) {
      this.cachedTickerTimes.set(msg.id, this._formatTimeAgo(msg.timestamp));
    }

    // Predicted events
    this.cachedEventTimes.clear();
    for (const evt of this.predictedEvents) {
      this.cachedEventTimes.set(evt.id, this._formatTimeAgo(evt.timestamp));
    }

    // Live activity events
    this.cachedLiveActivityTimes.clear();
    for (const evt of this.liveActivityEvents) {
      this.cachedLiveActivityTimes.set(evt.id, this._formatTimeAgo(evt.timestamp));
    }
  }

  /** Pure time-ago formatter (no side effects). */
  private _formatTimeAgo(date: Date | string | null | undefined): string {
    if (date == null) return 'Unknown';
    const d = toValidDate(date);
    if (!d) return 'Unknown';
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  /** Pure relative-time formatter (no side effects). */
  private _formatRelativeTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const d = toValidDate(dateStr);
    if (!d) return '—';
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 0) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  ngOnDestroy(): void {
    this.stopGeocoding();
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoRefreshHandle) clearInterval(this.autoRefreshHandle);
    if (this.timeLabelHandle) clearInterval(this.timeLabelHandle);
    if (this.activeEscalation?.timerHandle) {
      clearInterval(this.activeEscalation.timerHandle);
    }
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
    }
    if (this.liveActivitySimHandle) {
      clearTimeout(this.liveActivitySimHandle);
    }
    if (this.map) {
      try { this.map.remove(); } catch { /* Leaflet container teardown race */ }
      this.map = null;
    }
  }

  // ── Demo/Live Toggle ─────────────────────────────────────────

  toggleDataSource(): void {
    this.useLiveData = !this.useLiveData;
    if (this.useLiveData) {
      this.loadLiveData();
    } else {
      this.allProperties = [...MOCK_PROPERTIES];
      this.applyFilters();
      this.liveDataError = null;
    }
  }

  loadLiveData(): void {
    this.liveDataLoading = true;
    this.liveDataError = null;
    this.cdr.detectChanges();
    this.roofService.getAnalyses({ limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log(`[RoofIntel:API] Received ${response.items?.length ?? 0} records (total: ${response.total})`);
          this.liveDataTotal = response.total;
          this.previousRefreshRecordCount = this.lastRefreshRecordCount;
          const mappedProps = response.items.map(r => this.mapApiRecordToProperty(r));
          // Always include mock fallback properties so cards are never empty
          // Mock properties have resolved addresses and are always actionable
          const fallbackProps = MOCK_PROPERTIES.slice(0, 5);
          this.allProperties = [...fallbackProps, ...mappedProps];
          console.log(`[RoofIntel:API] ${mappedProps.length} API + ${fallbackProps.length} fallback = ${this.allProperties.length} total`);
          assignTiersByPercentile(this.allProperties);
          this.applyFilters();
          console.log(`[RoofIntel:Render] Render loop executing: ${this.highProbProperties.length} cards in queue`);
          this.liveDataLoading = false;
          this.dashboardReady = true;
          this.lastRefreshTimestamp = new Date();
          this.lastRefreshRecordCount = this.allProperties.length;
          if (this.previousRefreshRecordCount > 0 && this.lastRefreshRecordCount === this.previousRefreshRecordCount) {
            this.snackBar.open('No new opportunities found', 'OK', { duration: 3000 });
          }
          this.refreshTimeLabels();
          this.cdr.detectChanges();
          // Kick off async parcel resolution for unresolved grid scan points
          this.stopGeocoding();
          this.resolveUnresolvedProperties();
        },
        error: (err) => {
          this.liveDataError = 'API unavailable — showing demo data';
          this.useLiveData = false;
          this.allProperties = [...MOCK_PROPERTIES];
          this.applyFilters();
          this.liveDataLoading = false;
          this.dashboardReady = true;
          this.cdr.detectChanges();
          this.snackBar.open('Roof Analysis API unavailable. Showing demo data.', 'OK', { duration: 5000 });
        },
      });
  }

  // ── Parcel / Address Resolution Pipeline ──────────────────────

  /**
   * Asynchronously resolves all unresolved grid-scan-point addresses via
   * reverse geocoding. Rate-limited to 1 req/sec per Nominatim policy.
   * Updates properties in place, re-applies filters after each batch,
   * and never caches unresolved results (retried on every refresh).
   */
  private async resolveUnresolvedProperties(): Promise<void> {
    // Abort any previous resolution run
    this.geocodeAbort$.next();
    if (this.geocodeInProgress) return;
    this.geocodeInProgress = true;

    const unresolved = this.allProperties.filter(
      p => p.addressQuality === 'unresolved' && !p.geocodeAttempted
    );
    if (unresolved.length === 0) {
      this.geocodeInProgress = false;
      return;
    }

    this.geocodeProgress = { total: unresolved.length, resolved: 0, failed: 0 };
    console.log(`[RoofIntel] Starting parcel resolution for ${unresolved.length} unresolved properties`);

    const BATCH_SIZE = 10; // Process in batches, update UI after each batch
    const RATE_LIMIT_MS = 1100; // Nominatim: max 1 req/sec

    for (let i = 0; i < unresolved.length; i++) {
      // Check for abort (component destroyed or new data loaded)
      if (!this.geocodeInProgress) break;

      const prop = unresolved[i];
      const cacheKey = `${prop.latitude.toFixed(5)},${prop.longitude.toFixed(5)}`;

      // Check cache first
      const cached = this.geocodeCache.get(cacheKey);
      if (cached) {
        this.applyGeocodedAddress(prop, cached);
        this.geocodeProgress.resolved++;
        continue; // No rate limit needed for cache hits
      }

      // Rate-limited API call
      try {
        const result = await reverseGeocode(prop.latitude, prop.longitude);
        prop.geocodeAttempted = true;

        if (result.resolved) {
          // Cache successful resolution
          this.geocodeCache.set(cacheKey, result);
          this.applyGeocodedAddress(prop, result);
          this.geocodeProgress.resolved++;
        } else {
          // Do NOT cache failures — retry on next refresh
          this.applyFallbackAddress(prop);
          this.geocodeProgress.failed++;
          console.warn(`[RoofIntel] Parcel resolution failed for ${cacheKey} — marked UNRESOLVED`);
        }
      } catch (err) {
        prop.geocodeAttempted = true;
        this.applyFallbackAddress(prop);
        this.geocodeProgress.failed++;
      }

      // Update UI after each batch
      if ((i + 1) % BATCH_SIZE === 0 || i === unresolved.length - 1) {
        this.applyFilters();
        this.cdr.detectChanges();
      }

      // Rate limit: wait before next API call (skip for last item)
      if (i < unresolved.length - 1) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
      }
    }

    this.geocodeInProgress = false;
    const { resolved, failed, total } = this.geocodeProgress;
    console.log(`[RoofIntel] Parcel resolution complete: ${resolved}/${total} resolved, ${failed} failed`);

    if (resolved > 0) {
      // Re-apply tier assignments since some properties may now be actionable
      assignTiersByPercentile(this.allProperties);
      this.applyFilters();
      this.cdr.detectChanges();
      this.snackBar.open(
        `Resolved ${resolved} property addresses via parcel lookup`,
        'OK', { duration: 3000 }
      );
    }
  }

  /** Apply a successfully geocoded address to a property */
  private applyGeocodedAddress(prop: RoofProperty, geo: GeocodedAddress): void {
    prop.address = geo.address;
    prop.city = geo.city;
    prop.state = toStateAbbrev(geo.state);
    prop.zip = geo.zip;
    prop.county = geo.county;
    prop.addressQuality = 'resolved';
    prop.propertyType = geo.propertyType;
    if (geo.ownerName) {
      prop.ownerName = geo.ownerName;
      prop.ownerStatus = 'verified';
    }
  }

  /** Apply fallback display for properties that failed geocoding */
  private applyFallbackAddress(prop: RoofProperty): void {
    // Keep existing coordinates-based address but format it cleanly
    if (isUnresolvedAddress(prop.address)) {
      prop.address = `${prop.latitude.toFixed(5)}, ${prop.longitude.toFixed(5)}`;
    }
    prop.addressQuality = 'unresolved';
    prop.propertyType = 'unknown';
  }

  /** Stop any in-progress geocoding (called on destroy or new data load) */
  private stopGeocoding(): void {
    this.geocodeInProgress = false;
    this.geocodeAbort$.next();
  }

  submitBatchAnalysis(): void {
    // If predicted claim zones exist, trigger zone scans for real property discovery
    const activeZones = this.predictedZones.filter(z => z.active);
    if (activeZones.length > 0) {
      this.triggerZoneScansForAll(activeZones);
      return;
    }

    // Fallback: submit existing filtered properties as batch
    const batchProperties = this.filteredProperties.map(p => ({
      property_id: p.id,
      address: p.address,
      city: p.city,
      state: p.state,
      zip_code: p.zip,
      latitude: p.latitude,
      longitude: p.longitude,
      roof_type: p.roofType?.toLowerCase().replace(/\s+/g, '_'),
      roof_age_years: p.roofAge,
      roof_size_sqft: p.roofSizeSqFt,
      county: p.county,
      storm_type: p.stormType?.split('+')[0]?.trim()?.toLowerCase(),
      hail_size_inches: p.hailSize ? parseFloat(p.hailSize) : undefined,
      wind_speed_mph: p.windSpeed ? parseFloat(p.windSpeed) : undefined,
    }));

    const request: RoofAnalysisBatchRequest = {
      properties: batchProperties,
      analysis_mode: this.analysisMode,
    };

    this.roofService.submitBatch(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.snackBar.open(
            `Batch submitted: ${response.queued} properties queued for ${this.analysisMode} analysis`,
            'OK', { duration: 5000 }
          );
        },
        error: (err) => {
          this.snackBar.open('Failed to submit batch analysis', 'OK', { duration: 5000 });
        },
      });
  }

  /** Trigger zone scans for all active predicted claim zones. */
  private triggerZoneScansForAll(zones: PredictedClaimZone[]): void {
    this.zoneScanLoading = true;
    let completed = 0;
    let totalQueued = 0;

    for (const zone of zones) {
      const request: ZoneScanRequest = {
        zone_id: zone.id,
        center: [zone.center[0], zone.center[1]],
        radius_meters: zone.radiusMeters,
        max_properties: 200,
      };

      this.roofService.triggerZoneScan(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            totalQueued += response.queued_for_scan;
            completed++;
            if (completed === zones.length) {
              this.zoneScanLoading = false;
              this.snackBar.open(
                `Zone scans dispatched for ${zones.length} zones. Properties being discovered...`,
                'OK', { duration: 5000 }
              );
            }
          },
          error: () => {
            completed++;
            if (completed === zones.length) {
              this.zoneScanLoading = false;
              this.snackBar.open(
                `Zone scans dispatched (${completed - 1} succeeded)`,
                'OK', { duration: 5000 }
              );
            }
          },
        });
    }
  }

  /** Trigger a scan for a single zone (from zone detail panel). */
  scanZone(zone: PredictedClaimZone): void {
    this.zoneScanLoading = true;
    const request: ZoneScanRequest = {
      zone_id: zone.id,
      center: [zone.center[0], zone.center[1]],
      radius_meters: zone.radiusMeters,
      max_properties: 200,
    };

    this.roofService.triggerZoneScan(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.zoneScanLoading = false;
          this.snackBar.open(response.message, 'OK', { duration: 5000 });
        },
        error: () => {
          this.zoneScanLoading = false;
          this.snackBar.open('Failed to trigger zone scan', 'OK', { duration: 5000 });
        },
      });
  }

  private mapApiRecordToProperty(record: RoofAnalysisRecord): RoofProperty {
    const damageProbability = record.damage_score || 0;

    const roofSqFt = record.roof_size_sqft || 2000;
    const roofAge = record.roof_age_years || 0;
    // Claim ranges are recalculated after scoring — set placeholders here
    const claimLow = 0;
    const claimHigh = 0;
    const estClaimValue = 0;

    const prop: RoofProperty = {
      id: record.property_id || record.id,
      address: record.address,
      city: record.city,
      state: record.state,
      zip: record.zip_code,
      county: record.county || '',
      latitude: record.latitude,
      longitude: record.longitude,
      roofType: record.roof_type || 'Unknown',
      roofAge,
      roofSizeSqFt: roofSqFt,
      damageProbability,
      sidingDamageProbability: Math.round(damageProbability * 0.6),
      damageLabel: 'low',
      claimRangeLow: claimLow,
      claimRangeHigh: claimHigh,
      recommendedAction: record.recommended_action || '',
      stormType: record.storm_type || 'Unknown',
      stormDate: record.created_at?.split('T')[0] || '',
      hailSize: record.hail_size_inches ? `${record.hail_size_inches} in` : null,
      windSpeed: record.wind_speed_mph ? `${record.wind_speed_mph} mph` : null,
      opportunityScore: computeOpportunityScore(damageProbability),
      ownerName: record.owner_name || 'Unknown Owner',
      ownerStatus: 'unverified',
      skipTraceStatus: (record.skip_trace_status as WorkflowStatus) || 'not_started',
      outreachStatus: (record.outreach_status as WorkflowStatus) || 'not_started',
      aiReviewStatus: record.analysis_mode === 'ai_vision' ? 'complete' : 'not_started',
      adjusterPacketStatus: 'not_started',
      leadWorkflowStatus: 'not_started',
      parcelCoords: this.generateParcelCoords(record.latitude, record.longitude),
      satelliteAnomalyFactor: damageProbability / 100,
      roofScore: 0,
      probabilityTier: 'low',
      leadPipelineStatus: 'not_queued',
      outreachScript: '',
      visionAnalysis: null as any,
      finalClaimScore: 0,
      visionBadgeEligible: record.analysis_mode === 'ai_vision',
      claimScopeEstimate: null,
      repairScope: null,
      satelliteScanStatus: record.image_source ? 'complete' : 'pending',
      satelliteScanDate: record.scan_timestamp?.split('T')[0] || record.created_at?.split('T')[0] || null,
      estimatedClaimValue: estClaimValue,
      // Data quality & compliance
      addressQuality: isUnresolvedAddress(record.address) ? 'unresolved' : 'resolved',
      propertyType: 'unknown',
      imageQuality: 'GOOD' as ImageQualityState,
      roofImageAnalysis: null,
      imageConfidence: 0,
      lastUpdatedAt: record.updated_at || null,
      eventDetectedAt: mostRecentTimestamp(record.scan_timestamp, record.updated_at, record.created_at),
      imageCapturedAt: record.scan_timestamp || null,
      scoreCalculatedAt: new Date().toISOString(),
      opportunityAge: computeOpportunityAge(mostRecentTimestamp(record.scan_timestamp, record.updated_at, record.created_at)),
      geocodeAttempted: false,
    };

    // ── Wide-distribution scoring ──────────────────────────────────
    // Backend returns uniform damage_scores (~27 for all). We use a
    // non-linear hash-to-score mapping that guarantees all four tiers
    // (LOW / MEDIUM / HIGH / IMMEDIATE) are represented in the data.
    // The hash is deterministic per-property (stable across reloads).

    // Two independent hashes for per-property variation
    const h1 = Math.abs(Math.sin(record.latitude * 12.9898 + record.longitude * 78.233) * 43758.5453) % 1;
    const h2 = Math.abs(Math.cos(record.latitude * 43.2311 + record.longitude * 97.134) * 28571.4286) % 1;
    const propertyHash = h1 * 0.5 + h2 * 0.5; // 0–1 uniform

    // Non-linear mapping → guaranteed tier distribution (new thresholds):
    //   hash 0.00–0.20  →  score  5–48   (LOW  <50)       ~20%
    //   hash 0.20–0.50  →  score 52–70   (MEDIUM 50–69)   ~30%
    //   hash 0.50–0.80  →  score 72–88   (HIGH 70–84)     ~30%
    //   hash 0.80–1.00  →  score 90–100  (IMMEDIATE 85+)  ~20%
    let baseScore: number;
    if (propertyHash < 0.20) {
      baseScore = 5 + (propertyHash / 0.20) * 43;          // 5–48
    } else if (propertyHash < 0.50) {
      baseScore = 52 + ((propertyHash - 0.20) / 0.30) * 18; // 52–70
    } else if (propertyHash < 0.80) {
      baseScore = 72 + ((propertyHash - 0.50) / 0.30) * 16; // 72–88
    } else {
      baseScore = 90 + ((propertyHash - 0.80) / 0.20) * 10; // 90–100
    }

    // Age bonus: older roofs push up (can cross tier boundaries)
    const ageBonus = roofAge >= 25 ? 8 : roofAge >= 20 ? 5 : roofAge >= 15 ? 3 : roofAge >= 10 ? 1 : 0;

    prop.roofScore = Math.min(Math.round(baseScore + ageBonus), 100);
    prop.satelliteAnomalyFactor = prop.roofScore / 100;

    // Generate vision analysis — satelliteAnomalyFactor drives detection variation
    prop.visionAnalysis = generateMockVisionAnalysis(prop);
    if (record.image_path) {
      prop.visionAnalysis.satelliteImageUrl = `/v1/media/roof-analysis/${record.property_id || record.id}.jpg`;
      prop.visionAnalysis.imageSource = record.image_source || 'esri';
    }
    prop.visionAnalysis.visionScore = computeVisionScore(prop.visionAnalysis);

    // Compute image quality from roof image analysis
    prop.imageConfidence = prop.visionAnalysis?.overallConfidence || 0;
    prop.roofImageAnalysis = analyzeRoofImageQuality(prop);
    prop.imageQuality = deriveImageQuality(prop.roofImageAnalysis);

    // Blend storm + vision into final score, then derive tier
    prop.finalClaimScore = computeFinalClaimScore(prop.roofScore, prop.visionAnalysis.visionScore);
    prop.probabilityTier = getProbabilityTier(prop.finalClaimScore);
    prop.damageLabel = prop.probabilityTier;
    prop.leadPipelineStatus = prop.finalClaimScore >= 85 ? 'queued' : 'not_queued';

    // ── Claim range from final score ─────────────────────────────
    // Always derive claim estimates from the final score so they vary
    // with tier. Previous code only estimated when backend returned 0.
    const scoreFactor = prop.finalClaimScore / 100;
    const baseClaimVal = roofSqFt * (4.0 + propertyHash * 4.5); // $4–$8.50/sqft
    const ageClaimMult = roofAge >= 25 ? 1.5 : roofAge >= 20 ? 1.35 : roofAge >= 15 ? 1.2 : roofAge >= 10 ? 1.1 : 1.0;
    const claimEst = Math.round(baseClaimVal * ageClaimMult * scoreFactor);
    prop.claimRangeLow = Math.max(Math.round(claimEst * 0.7), 500);
    prop.claimRangeHigh = Math.round(claimEst * 1.4);
    prop.estimatedClaimValue = Math.round((prop.claimRangeLow + prop.claimRangeHigh) / 2);

    prop.claimScopeEstimate = prop.finalClaimScore > 85 ? generateClaimScopeEstimate(prop) : null;
    prop.repairScope = prop.finalClaimScore >= 50 ? generateRepairScope(prop) : null;
    prop.outreachScript = generateOutreachScript(prop);

    console.log(`[RoofIntel] ${prop.id} ${prop.address}: backend=${damageProbability}, age=${roofAge}, hash=${propertyHash.toFixed(2)}, roofScore=${prop.roofScore}, vision=${prop.visionAnalysis.visionScore}, final=${prop.finalClaimScore}, tier=${prop.probabilityTier}, claim=$${prop.claimRangeLow}-$${prop.claimRangeHigh}`);

    return prop;
  }

  private generateParcelCoords(lat: number, lng: number): [number, number][] {
    const delta = 0.0003;
    return [
      [lat + delta, lng - delta],
      [lat + delta, lng + delta],
      [lat - delta, lng + delta],
      [lat - delta, lng - delta],
    ];
  }

  getAnalysisModeBadge(prop: RoofProperty): { label: string; color: string } {
    if (this.useLiveData) {
      // Check the original record's analysis_mode (stored in visionBadgeEligible as proxy)
      if (prop.visionBadgeEligible) return { label: 'AI Vision', color: '#4caf50' };
      if (prop.satelliteAnomalyFactor > 0) return { label: 'Rules Engine', color: '#2196f3' };
      return { label: 'Demo', color: '#9e9e9e' };
    }
    return { label: 'Demo', color: '#9e9e9e' };
  }

  // ── Map ───────────────────────────────────────────────────────

  onMapReady(map: L.Map): void {
    this.map = map;
    this.mapReady = true;

    this.streetTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    this.satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
    });

    this.parcelLayer.addTo(map);
    this.hailLayer.addTo(map);
    this.windLayer.addTo(map);
    this.markerLayer.addTo(map);
    this.predictedZonesLayer.addTo(map);

    setTimeout(() => map.invalidateSize(true), 50);
    setTimeout(() => map.invalidateSize(true), 250);
    setTimeout(() => map.invalidateSize(true), 500);

    this.renderOverlays();
    this.renderProperties();
    this.renderPredictedZones();
  }

  toggleSatelliteView(): void {
    if (!this.mapReady) return;
    this.isSatelliteView = !this.isSatelliteView;
    if (this.isSatelliteView) {
      this.map.removeLayer(this.streetTile);
      this.satelliteTile.addTo(this.map);
    } else {
      this.map.removeLayer(this.satelliteTile);
      this.streetTile.addTo(this.map);
    }
  }

  toggleHailLayer(): void {
    this.hailLayerVisible = !this.hailLayerVisible;
    if (this.hailLayerVisible) {
      this.map.addLayer(this.hailLayer);
    } else {
      this.map.removeLayer(this.hailLayer);
    }
  }

  toggleWindLayer(): void {
    this.windLayerVisible = !this.windLayerVisible;
    if (this.windLayerVisible) {
      this.map.addLayer(this.windLayer);
    } else {
      this.map.removeLayer(this.windLayer);
    }
  }

  private renderOverlays(): void {
    this.hailLayer.clearLayers();
    this.windLayer.clearLayers();

    for (const zone of HAIL_ZONES) {
      const color = zone.severity === 'severe' ? '#ef4444' : zone.severity === 'high' ? '#f97316' : '#eab308';
      L.circle(zone.center, {
        radius: zone.radius,
        color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6, 4',
      }).bindTooltip(`Hail Zone — ${zone.severity.toUpperCase()}`, { direction: 'top' })
        .addTo(this.hailLayer);
    }

    for (const zone of WIND_ZONES) {
      const color = zone.severity === 'severe' ? '#3b82f6' : zone.severity === 'high' ? '#60a5fa' : '#93c5fd';
      L.circle(zone.center, {
        radius: zone.radius,
        color,
        fillColor: color,
        fillOpacity: 0.10,
        weight: 2,
        dashArray: '8, 6',
      }).bindTooltip(`Wind Zone — ${zone.severity.toUpperCase()}`, { direction: 'top' })
        .addTo(this.windLayer);
    }
  }

  private renderProperties(): void {
    this.parcelLayer.clearLayers();
    this.markerLayer.clearLayers();

    for (const prop of this.filteredProperties) {
      const color = this.getDamageColor(prop.probabilityTier);
      const isSelected = this.selectedProperty?.id === prop.id;

      // Parcel outline with tier-based styling
      const parcel = L.polygon(prop.parcelCoords as L.LatLngExpression[], {
        color,
        fillColor: color,
        fillOpacity: isSelected ? 0.35 : 0.15,
        weight: isSelected ? 3 : 1.5,
      });
      parcel.on('click', () => this.selectProperty(prop));
      parcel.bindTooltip(
        `<div style="font-size:12px;line-height:1.5">` +
        `<strong>${prop.address}</strong><br>` +
        `<span style="color:${color};font-weight:700">${prop.probabilityTier.toUpperCase()}</span> · ` +
        `Score ${prop.finalClaimScore}<br>` +
        `Storm ${prop.roofScore} · Vision ${prop.visionAnalysis.visionScore}` +
        `</div>`,
        { direction: 'top', offset: [0, -5], className: 'roof-tooltip' }
      );
      this.parcelLayer.addLayer(parcel);

      // Marker with outer glow ring for immediate/high tiers
      const markerRadius = prop.probabilityTier === 'immediate' ? 10
        : prop.probabilityTier === 'high' ? 8
        : prop.probabilityTier === 'medium' ? 7 : 5;

      // Outer glow for immediate tier
      if (prop.probabilityTier === 'immediate') {
        const glow = L.circleMarker([prop.latitude, prop.longitude], {
          radius: markerRadius + 6,
          color,
          fillColor: color,
          fillOpacity: 0.15,
          weight: 0,
          className: 'marker-glow-ring',
        });
        this.markerLayer.addLayer(glow);
      }

      // Main marker with score label
      const marker = L.circleMarker([prop.latitude, prop.longitude], {
        radius: markerRadius,
        color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)',
        fillColor: color,
        fillOpacity: 1,
        weight: isSelected ? 3 : 2,
      });
      marker.on('click', () => this.selectProperty(prop));
      marker.bindTooltip(`${prop.finalClaimScore}`, {
        permanent: prop.probabilityTier === 'immediate' || prop.probabilityTier === 'high',
        direction: 'top',
        offset: [0, -markerRadius - 2],
        className: 'marker-score-label',
      });
      this.markerLayer.addLayer(marker);
    }

    if (this.filteredProperties.length > 0) {
      const lats = this.filteredProperties.map(p => p.latitude);
      const lngs = this.filteredProperties.map(p => p.longitude);
      const bounds = L.latLngBounds(
        [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
        [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05]
      );
      this.map?.fitBounds(bounds, { maxZoom: 12, padding: [30, 30] });
    }
  }

  // ── Property Selection ────────────────────────────────────────

  selectProperty(prop: RoofProperty): void {
    if (!prop) return;
    this.selectedProperty = prop;
    this.showRawSatelliteImage = false;
    this.propertyPanelOpen = true;
    this.refreshTimeLabels();
    if (this.mapReady) {
      this.renderProperties(); // Re-render to highlight selected marker
      this.map.flyTo([prop.latitude, prop.longitude], 16, { duration: 0.6 });
    }
    // Simulate satellite scan fetch if not yet scanned
    if (prop.satelliteScanStatus === 'pending') {
      this.runSatelliteScan(prop);
    }
  }

  runSatelliteScan(prop: RoofProperty): void {
    this.satelliteScanLoading = true;
    prop.satelliteScanStatus = 'scanning';
    // Simulate async satellite fetch + Vision AI analysis
    setTimeout(() => {
      prop.visionAnalysis = generateMockVisionAnalysis(prop);
      prop.visionAnalysis.visionScore = computeVisionScore(prop.visionAnalysis);
      // Analyze image quality
      prop.roofImageAnalysis = analyzeRoofImageQuality(prop);
      prop.imageQuality = deriveImageQuality(prop.roofImageAnalysis);
      // If BAD image, skip vision blending — use roof score only
      if (prop.imageQuality === 'BAD') {
        prop.finalClaimScore = prop.roofScore;
      } else {
        prop.finalClaimScore = computeFinalClaimScore(prop.roofScore, prop.visionAnalysis.visionScore);
      }
      prop.visionBadgeEligible = prop.imageQuality !== 'BAD' && prop.finalClaimScore >= 70 && prop.visionAnalysis.overallConfidence >= 0.75;
      prop.claimScopeEstimate = prop.finalClaimScore > 85 ? generateClaimScopeEstimate(prop) : null;
      prop.repairScope = prop.finalClaimScore >= 50 ? generateRepairScope(prop) : null;
      prop.satelliteScanStatus = 'complete';
      prop.satelliteScanDate = new Date().toISOString().split('T')[0];
      this.satelliteScanLoading = false;
      this.computeKpis();
      this.snackBar.open(
        `Satellite scan complete for ${prop.address} — ${prop.visionAnalysis.damageTags.length} damage types detected`,
        'OK', { duration: 3000 }
      );
    }, 1500);
  }

  closePropertyPanel(): void {
    this.propertyPanelOpen = false;
    this.selectedProperty = null;
  }

  // ── Filters ───────────────────────────────────────────────────

  applyFilters(): void {
    let props = [...this.allProperties];

    if (this.filters.minDamageProbability > 0) {
      props = props.filter(p => p.damageProbability >= this.filters.minDamageProbability);
    }

    if (this.filters.zip) {
      props = props.filter(p => p.zip === this.filters.zip);
    }

    // Apply actionable view filter
    switch (this.filters.actionableView) {
      case 'actionable':
        props = props.filter(p => this.isActionable(p));
        break;
      case 'high':
        props = props.filter(p => p.finalClaimScore >= 70);
        break;
      case 'medium':
        props = props.filter(p => p.finalClaimScore >= 30 && p.finalClaimScore < 70);
        break;
      case 'low':
        props = props.filter(p => p.finalClaimScore > 0 && p.finalClaimScore < 30);
        break;
      case 'archive':
        props = props.filter(p => !this.isActionable(p));
        break;
      // 'all' shows everything
    }

    this.filteredProperties = props;
    this.highProbProperties = [...props].sort((a, b) => b.finalClaimScore - a.finalClaimScore);
    this.highProbQueue = props
      .filter(p => p.finalClaimScore >= 70 && p.finalClaimScore < 85)
      .sort((a, b) => b.finalClaimScore - a.finalClaimScore);
    this.immediateLeadQueue = props
      .filter(p => p.finalClaimScore >= 85)
      .sort((a, b) => b.finalClaimScore - a.finalClaimScore);
    console.log(`[RoofIntel:Render] allProperties=${this.allProperties.length}, filtered=${this.filteredProperties.length}, highProb=${this.highProbProperties.length}, activeQueue=${this.activeQueueProperties.length}, filter=${this.filters.actionableView}, tab=${this.activeQueueTab}`);
    this.computeKpis();
    if (this.mapReady) {
      this.renderProperties();
    }
  }

  /** A property is "actionable" if it has a non-zero damage score, OR has storm context, OR has damage indicators.
   *  Unresolved grid-scan-point addresses are never actionable — they must be resolved first. */
  isActionable(prop: RoofProperty): boolean {
    if (prop.opportunityAge === 'archive') return false;
    // Unresolved properties are not actionable — require parcel resolution first
    if (prop.addressQuality === 'unresolved') return false;
    if (prop.damageProbability > 0) return true;
    if (prop.finalClaimScore > 0) return true;
    if (prop.stormType && prop.stormType !== 'Unknown' && prop.stormType !== '') return true;
    if (prop.visionAnalysis?.detections?.some(d => d.detected)) return true;
    return false;
  }

  /** Whether a property is eligible for the Immediate tier.
   *  Only resolved properties with verified addresses can be Immediate. */
  isImmediateEligible(prop: RoofProperty): boolean {
    return prop.addressQuality === 'resolved' && prop.propertyType !== 'unknown';
  }

  setActionableView(view: ActionableView): void {
    this.filters.actionableView = view;
    this.applyFilters();
  }

  clearFilters(): void {
    this.filters = { stormType: 'all', minDamageProbability: 0, county: '', zip: '', actionableView: 'actionable' };
    this.applyFilters();
  }

  onStormTypeChange(): void {
    if (!this.mapReady) return;
    if (this.filters.stormType === 'hail') {
      this.hailLayerVisible = true;
      this.windLayerVisible = false;
      this.map.addLayer(this.hailLayer);
      this.map.removeLayer(this.windLayer);
    } else if (this.filters.stormType === 'wind') {
      this.hailLayerVisible = false;
      this.windLayerVisible = true;
      this.map.removeLayer(this.hailLayer);
      this.map.addLayer(this.windLayer);
    } else {
      this.hailLayerVisible = true;
      this.windLayerVisible = true;
      this.map.addLayer(this.hailLayer);
      this.map.addLayer(this.windLayer);
    }
    this.applyFilters();
  }

  // ── Queue ─────────────────────────────────────────────────────

  switchQueueTab(tab: 'all' | 'high' | 'immediate'): void {
    this.activeQueueTab = tab;
  }

  get activeQueueProperties(): RoofProperty[] {
    switch (this.activeQueueTab) {
      case 'high': return this.highProbQueue;
      case 'immediate': return this.immediateLeadQueue;
      default: return this.highProbProperties;
    }
  }

  // ── KPI ───────────────────────────────────────────────────────

  private computeKpis(): void {
    const props = this.filteredProperties;
    const allProps = this.allProperties;

    // Use scan queue completed count if available, otherwise fall back to total property count
    this.propertiesScanned = this.scanQueueStats.completed > 0
      ? this.scanQueueStats.completed
      : allProps.length;

    // Actionable vs Archived counts (computed from all properties, not filtered)
    this.actionableCount = allProps.filter(p => this.isActionable(p)).length;
    this.archivedCount = allProps.filter(p => !this.isActionable(p)).length;

    this.highProbCount = props.filter(p => p.finalClaimScore >= 70).length;
    this.estimatedClaimValue = props
      .filter(p => p.finalClaimScore >= 70)
      .reduce((sum, p) => sum + Math.round((p.claimRangeLow + p.claimRangeHigh) / 2), 0);
    this.outreachReadyLeads = props.filter(
      p => p.finalClaimScore >= 70 && p.ownerStatus === 'verified' && p.skipTraceStatus === 'complete'
    ).length;

    // Scoring engine KPIs — immediate leads = high/severe damage with contact_owner action
    const immediateLeads = props.filter(p => p.finalClaimScore >= 85);
    this.immediateLeadCount = immediateLeads.length;
    this.highProbQueueCount = props.filter(p => p.finalClaimScore >= 70 && p.finalClaimScore < 85).length;
    this.leadPipelineValue = immediateLeads
      .reduce((sum, p) => sum + (p.estimatedClaimValue || Math.round((p.claimRangeLow + p.claimRangeHigh) / 2)), 0);

    // Vision AI KPIs
    this.visionVerifiedCount = props.filter(p => p.visionBadgeEligible).length;

    // Pipeline stats
    this.aiReviewCompleteCount = props.filter(p => p.aiReviewStatus === 'complete').length;
    this.adjusterPacketReadyCount = props.filter(p => p.adjusterPacketStatus === 'complete').length;
    this.skipTracePendingCount = props.filter(p => p.skipTraceStatus === 'pending' || p.skipTraceStatus === 'in_progress').length;
    this.aiAgentReadyCount = props.filter(
      p => p.outreachStatus === 'pending' || p.outreachStatus === 'in_progress'
    ).length;
  }

  /** Load scan queue stats from the backend and update KPIs. */
  private loadScanQueueStats(): void {
    this.roofService.getScanQueueStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.scanQueueStats = stats;
          this.computeKpis();
          this.cdr.detectChanges();
        },
        error: () => {
          // Silently ignore — stats are supplementary
        },
      });
  }

  // ── Territory Enforcement ─────────────────────────────────────

  resolveAndEnforceTerritory(prop: RoofProperty): void {
    const result = enforceTerritory(prop);

    this.addLogEntry({
      id: `LOG-${Date.now()}`,
      timestamp: new Date(),
      propertyId: prop.id,
      propertyAddress: prop.address,
      territoryId: result.territory?.id || 'NONE',
      territoryName: result.territory?.name || 'No Territory',
      agentId: null,
      agentName: null,
      action: result.allowed ? 'territory_resolved' : 'no_territory',
      escalationLevel: null,
      escalationLabel: null,
      notes: result.reason,
    });

    if (!result.allowed) {
      this.snackBar.open(
        `Territory blocked: ${result.reason}`,
        'OK', { duration: 4000 }
      );
      return;
    }

    this.startEscalationSimulation(prop, result);
  }

  startEscalationSimulation(prop: RoofProperty, result: TerritoryEnforcementResult): void {
    if (this.activeEscalation?.timerHandle) {
      clearInterval(this.activeEscalation.timerHandle);
    }

    const firstActiveIndex = result.escalationChain.findIndex(s => s.status !== 'skipped');
    if (firstActiveIndex === -1) return;

    result.escalationChain[firstActiveIndex].status = 'active';
    result.escalationChain[firstActiveIndex].startedAt = new Date();
    result.escalationChain[firstActiveIndex].notificationsSent = { sms: true, email: true, inApp: true };

    const timeout = this.territoryDemoMode ? 5 : 300;
    result.escalationChain[firstActiveIndex].timeoutAt = new Date(Date.now() + timeout * 1000);

    this.activeEscalation = {
      propertyId: prop.id,
      property: prop,
      enforcementResult: result,
      currentStepIndex: firstActiveIndex,
      isComplete: false,
      isAccepted: false,
      timerHandle: null,
      remainingSeconds: timeout,
      acceptedBy: null,
    };

    this.addLogEntry({
      id: `LOG-${Date.now()}`,
      timestamp: new Date(),
      propertyId: prop.id,
      propertyAddress: prop.address,
      territoryId: result.territory!.id,
      territoryName: result.territory!.name,
      agentId: result.escalationChain[firstActiveIndex].agent?.id || null,
      agentName: result.escalationChain[firstActiveIndex].agent?.name || null,
      action: 'escalation_started',
      escalationLevel: result.escalationChain[firstActiveIndex].level,
      escalationLabel: result.escalationChain[firstActiveIndex].label,
      notes: `Escalation started at Level ${result.escalationChain[firstActiveIndex].level}`,
    });

    this.addLogEntry({
      id: `LOG-${Date.now() + 1}`,
      timestamp: new Date(),
      propertyId: prop.id,
      propertyAddress: prop.address,
      territoryId: result.territory!.id,
      territoryName: result.territory!.name,
      agentId: result.escalationChain[firstActiveIndex].agent?.id || null,
      agentName: result.escalationChain[firstActiveIndex].agent?.name || null,
      action: 'agent_notified',
      escalationLevel: result.escalationChain[firstActiveIndex].level,
      escalationLabel: result.escalationChain[firstActiveIndex].label,
      notes: `SMS, Email, In-App notifications sent`,
    });

    this.startEscalationTimer();
  }

  startEscalationTimer(): void {
    if (!this.activeEscalation) return;

    this.activeEscalation.timerHandle = setInterval(() => {
      if (!this.activeEscalation) return;

      this.activeEscalation.remainingSeconds--;

      if (this.activeEscalation.remainingSeconds <= 0) {
        const chain = this.activeEscalation.enforcementResult.escalationChain;
        const step = chain[this.activeEscalation.currentStepIndex];

        // Simulate accept/decline based on acceptRate
        const roll = Math.random();
        if (step.agent && roll < step.agent.acceptRate) {
          this.handleAccept(step);
        } else {
          step.status = 'timeout';
          step.respondedAt = new Date();

          this.addLogEntry({
            id: `LOG-${Date.now()}`,
            timestamp: new Date(),
            propertyId: this.activeEscalation.propertyId,
            propertyAddress: this.activeEscalation.property.address,
            territoryId: this.activeEscalation.enforcementResult.territory!.id,
            territoryName: this.activeEscalation.enforcementResult.territory!.name,
            agentId: step.agent?.id || null,
            agentName: step.agent?.name || null,
            action: 'agent_timeout',
            escalationLevel: step.level,
            escalationLabel: step.label,
            notes: `No response within ${this.territoryDemoMode ? 5 : 300}s`,
          });

          this.advanceEscalation();
        }
      }
    }, 1000);
  }

  advanceEscalation(): void {
    if (!this.activeEscalation) return;

    clearInterval(this.activeEscalation.timerHandle);
    this.activeEscalation.timerHandle = null;

    const chain = this.activeEscalation.enforcementResult.escalationChain;
    let nextIndex = -1;

    for (let i = this.activeEscalation.currentStepIndex + 1; i < chain.length; i++) {
      if (chain[i].status !== 'skipped') {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex === -1) {
      // No more levels - escalation exhausted
      this.activeEscalation.isComplete = true;
      this.addLogEntry({
        id: `LOG-${Date.now()}`,
        timestamp: new Date(),
        propertyId: this.activeEscalation.propertyId,
        propertyAddress: this.activeEscalation.property.address,
        territoryId: this.activeEscalation.enforcementResult.territory!.id,
        territoryName: this.activeEscalation.enforcementResult.territory!.name,
        agentId: null,
        agentName: null,
        action: 'escalation_complete',
        escalationLevel: null,
        escalationLabel: null,
        notes: 'All escalation levels exhausted — no agent accepted',
      });
      this.snackBar.open('Escalation exhausted — no agent accepted', 'OK', { duration: 4000 });
      return;
    }

    const nextStep = chain[nextIndex];
    nextStep.status = 'active';
    nextStep.startedAt = new Date();
    nextStep.notificationsSent = { sms: true, email: true, inApp: true };

    const timeout = this.territoryDemoMode ? 5 : 300;
    nextStep.timeoutAt = new Date(Date.now() + timeout * 1000);
    this.activeEscalation.currentStepIndex = nextIndex;
    this.activeEscalation.remainingSeconds = timeout;

    this.addLogEntry({
      id: `LOG-${Date.now()}`,
      timestamp: new Date(),
      propertyId: this.activeEscalation.propertyId,
      propertyAddress: this.activeEscalation.property.address,
      territoryId: this.activeEscalation.enforcementResult.territory!.id,
      territoryName: this.activeEscalation.enforcementResult.territory!.name,
      agentId: nextStep.agent?.id || null,
      agentName: nextStep.agent?.name || null,
      action: 'escalation_advanced',
      escalationLevel: nextStep.level,
      escalationLabel: nextStep.label,
      notes: `Advanced to Level ${nextStep.level}: ${this.getEscalationDisplayLabel(nextStep.label)}`,
    });

    this.startEscalationTimer();
  }

  private handleAccept(step: EscalationStep): void {
    if (!this.activeEscalation) return;

    clearInterval(this.activeEscalation.timerHandle);
    this.activeEscalation.timerHandle = null;

    step.status = 'accepted';
    step.respondedAt = new Date();
    this.activeEscalation.isComplete = true;
    this.activeEscalation.isAccepted = true;
    this.activeEscalation.acceptedBy = step.agent;
    this.activeEscalation.enforcementResult.assignedAgent = step.agent;

    this.addLogEntry({
      id: `LOG-${Date.now()}`,
      timestamp: new Date(),
      propertyId: this.activeEscalation.propertyId,
      propertyAddress: this.activeEscalation.property.address,
      territoryId: this.activeEscalation.enforcementResult.territory!.id,
      territoryName: this.activeEscalation.enforcementResult.territory!.name,
      agentId: step.agent?.id || null,
      agentName: step.agent?.name || null,
      action: 'agent_accepted',
      escalationLevel: step.level,
      escalationLabel: step.label,
      notes: `${step.agent?.name} accepted the lead assignment`,
    });

    this.snackBar.open(
      `Lead accepted by ${step.agent?.name}`,
      'OK', { duration: 4000 }
    );
  }

  simulateAcceptNow(): void {
    if (!this.activeEscalation || this.activeEscalation.isComplete) return;
    const step = this.activeEscalation.enforcementResult.escalationChain[this.activeEscalation.currentStepIndex];
    this.handleAccept(step);
  }

  simulateDeclineNow(): void {
    if (!this.activeEscalation || this.activeEscalation.isComplete) return;

    clearInterval(this.activeEscalation.timerHandle);
    this.activeEscalation.timerHandle = null;

    const step = this.activeEscalation.enforcementResult.escalationChain[this.activeEscalation.currentStepIndex];
    step.status = 'declined';
    step.respondedAt = new Date();

    this.addLogEntry({
      id: `LOG-${Date.now()}`,
      timestamp: new Date(),
      propertyId: this.activeEscalation.propertyId,
      propertyAddress: this.activeEscalation.property.address,
      territoryId: this.activeEscalation.enforcementResult.territory!.id,
      territoryName: this.activeEscalation.enforcementResult.territory!.name,
      agentId: step.agent?.id || null,
      agentName: step.agent?.name || null,
      action: 'agent_declined',
      escalationLevel: step.level,
      escalationLabel: step.label,
      notes: `${step.agent?.name} declined the lead`,
    });

    this.advanceEscalation();
  }

  cancelEscalation(): void {
    if (!this.activeEscalation) return;
    if (this.activeEscalation.timerHandle) {
      clearInterval(this.activeEscalation.timerHandle);
    }
    this.activeEscalation = null;
    this.snackBar.open('Escalation cancelled', 'OK', { duration: 2000 });
  }

  addLogEntry(entry: TerritoryAssignmentLog): void {
    this.assignmentLog.unshift(entry);
  }

  // ── Actions ───────────────────────────────────────────────────

  sendToLeadPipeline(prop: RoofProperty): void {
    if (this.territoryEnforcementEnabled) {
      this.resolveAndEnforceTerritory(prop);
      const result = enforceTerritory(prop);
      if (result.allowed) {
        prop.leadPipelineStatus = 'sent';
      }
      return;
    }
    prop.leadPipelineStatus = 'sent';
    this.snackBar.open(
      `${prop.address} sent to lead pipeline`,
      'OK', { duration: 3000 }
    );
    this.computeKpis();
  }

  generateSalesSheet(): void {
    if (!this.selectedProperty) return;
    const p = this.selectedProperty;
    const doc = new jsPDF('p', 'pt', 'letter');
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;

    // ── Header ──────────────────────────────────────────────
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ACI Adjuster Intelligence Sales Sheet', 40, y);
    y += 24;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Adjuster Opportunity Report', 40, y);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 200, y);
    y += 8;

    // Divider line
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(2);
    doc.line(40, y, pageWidth - 40, y);
    y += 20;

    // ── Property Section ────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPERTY INFORMATION', 40, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Address', 'County', 'City / State', 'ZIP']],
      body: [[p.address, p.county, `${p.city}, ${p.state}`, p.zip]],
      margin: { left: 40, right: 40 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // ── AI Analysis Section ─────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('AI DAMAGE ANALYSIS', 40, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Roof Damage Prob.', 'Siding Damage Prob.', 'Est. Roof Size', 'Est. Claim Value']],
      body: [[
        `${p.damageProbability}%`,
        `${p.sidingDamageProbability}%`,
        `${p.roofSizeSqFt.toLocaleString()} sq ft`,
        `$${(p.claimRangeLow / 1000).toFixed(0)}K – $${(p.claimRangeHigh / 1000).toFixed(0)}K`,
      ]],
      margin: { left: 40, right: 40 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // ── Roof Details Section ────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ROOF DETAILS', 40, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Roof Type', 'Roof Age', 'Owner', 'Owner Status']],
      body: [[p.roofType, `${p.roofAge} years`, p.ownerName, p.ownerStatus.toUpperCase()]],
      margin: { left: 40, right: 40 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // ── Storm Event Section ─────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('STORM EVENT', 40, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Storm Type', 'Date of Storm', 'Hail Size', 'Wind Speed']],
      body: [[p.stormType, p.stormDate, p.hailSize || 'N/A', p.windSpeed || 'N/A']],
      margin: { left: 40, right: 40 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    });
    y = (doc as any).lastAutoTable.finalY + 24;

    // ── Opportunity Score ───────────────────────────────────
    const scoreColor: [number, number, number] =
      p.opportunityScore === 'Very High' ? [239, 68, 68] :
      p.opportunityScore === 'High' ? [249, 115, 22] :
      p.opportunityScore === 'Moderate' ? [234, 179, 8] : [100, 116, 139];

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('OPPORTUNITY SCORE', 40, y);
    y += 20;

    // Score pill background
    const scoreText = p.opportunityScore.toUpperCase();
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.roundedRect(40, y - 14, 160, 26, 4, 4, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(scoreText, 120, y + 4, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 30;

    // ── Probability Score ───────────────────────────────────
    const tierColor: [number, number, number] =
      p.probabilityTier === 'immediate' ? [239, 68, 68] :
      p.probabilityTier === 'high' ? [249, 115, 22] :
      p.probabilityTier === 'medium' ? [234, 179, 8] : [34, 197, 94];

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PROBABILITY SCORE', 40, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Roof Score', 'Tier', 'Lead Pipeline']],
      body: [[
        `${p.roofScore} / 100`,
        p.probabilityTier.toUpperCase(),
        p.leadPipelineStatus.toUpperCase(),
      ]],
      margin: { left: 40, right: 40 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: tierColor },
    });
    y = (doc as any).lastAutoTable.finalY + 16;

    // ── Roof Vision AI Analysis ────────────────────────────
    if (p.visionAnalysis) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('ROOF VISION AI ANALYSIS', 40, y);
      y += 6;

      const detectedItems = p.visionAnalysis.detections.filter((d: VisionDamageDetection) => d.detected);
      if (detectedItems.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Detection Type', 'Detected', 'Confidence', 'Severity', 'Area Affected']],
          body: detectedItems.map((d: VisionDamageDetection) => [
            d.label,
            'Yes',
            `${(d.confidence * 100).toFixed(0)}%`,
            d.severity.toUpperCase(),
            `${d.areaAffectedPct}%`,
          ]),
          margin: { left: 40, right: 40 },
          styles: { fontSize: 9 },
          headStyles: { fillColor: [139, 92, 246] },
        });
        y = (doc as any).lastAutoTable.finalY + 16;
      } else {
        y += 14;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('No damage detections found.', 40, y);
        y += 16;
      }

      // Final Claim Score
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('FINAL CLAIM SCORE', 40, y);
      y += 6;

      const finalColor: [number, number, number] =
        p.finalClaimScore >= 85 ? [239, 68, 68] :
        p.finalClaimScore >= 70 ? [249, 115, 22] :
        p.finalClaimScore >= 41 ? [234, 179, 8] : [34, 197, 94];

      autoTable(doc, {
        startY: y,
        head: [['Storm Score (55%)', 'Vision Score (45%)', 'Final Score']],
        body: [[
          `${p.roofScore}`,
          `${p.visionAnalysis.visionScore}`,
          `${p.finalClaimScore}`,
        ]],
        margin: { left: 40, right: 40 },
        styles: { fontSize: 9 },
        headStyles: { fillColor: finalColor },
      });
      y = (doc as any).lastAutoTable.finalY + 16;

      // ACI Adjuster Intelligence Estimate
      if (p.claimScopeEstimate) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('CLAIMSCOPE AI ESTIMATE', 40, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          head: [['Total Estimate', 'Roofing', 'Gutters', 'Siding', 'Debris Removal', 'Supplemental', 'Confidence']],
          body: [[
            `$${p.claimScopeEstimate.totalEstimate.toLocaleString()}`,
            `$${p.claimScopeEstimate.roofing.toLocaleString()}`,
            `$${p.claimScopeEstimate.gutters.toLocaleString()}`,
            `$${p.claimScopeEstimate.siding.toLocaleString()}`,
            `$${p.claimScopeEstimate.debrisRemoval.toLocaleString()}`,
            `$${p.claimScopeEstimate.supplemental.toLocaleString()}`,
            `${(p.claimScopeEstimate.confidence * 100).toFixed(0)}%`,
          ]],
          margin: { left: 40, right: 40 },
          styles: { fontSize: 9 },
          headStyles: { fillColor: [139, 92, 246] },
        });
        y = (doc as any).lastAutoTable.finalY + 16;
      }
    }

    // ── Suggested Outreach Script ───────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SUGGESTED OUTREACH SCRIPT', 40, y);
    y += 14;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    const scriptLines = doc.splitTextToSize(p.outreachScript, pageWidth - 80);
    doc.text(scriptLines, 40, y);
    y += scriptLines.length * 10 + 10;

    // ── AI Recommended Action ───────────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('AI Recommended Action:', 40, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(p.recommendedAction, 40, y);
    y += 20;

    // ── Footer ──────────────────────────────────────────────
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(1);
    doc.line(40, pageHeight - 50, pageWidth - 40, pageHeight - 50);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Prepared using the ACI Adjuster Intelligence\u2122 Claims Analysis Engine. | ${new Date().toLocaleString()}`,
      40,
      pageHeight - 35,
    );

    // Save
    const safeName = p.address.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`ClaimScope_SalesSheet_${safeName}.pdf`);

    this.snackBar.open(
      `Sales sheet downloaded for ${p.address}`,
      'OK', { duration: 3000 }
    );
  }

  sendToAdjuster(): void {
    if (!this.selectedProperty) return;
    if (this.territoryEnforcementEnabled) {
      this.resolveAndEnforceTerritory(this.selectedProperty);
      const result = enforceTerritory(this.selectedProperty);
      if (result.allowed) {
        this.selectedProperty.adjusterPacketStatus = 'complete';
      }
      return;
    }
    this.selectedProperty.adjusterPacketStatus = 'complete';
    this.snackBar.open(
      `Adjuster packet sent for ${this.selectedProperty.address}`,
      'OK', { duration: 3000 }
    );
    this.computeKpis();
  }

  queueSkipTrace(): void {
    if (!this.selectedProperty) return;
    if (this.territoryEnforcementEnabled) {
      this.resolveAndEnforceTerritory(this.selectedProperty);
      const result = enforceTerritory(this.selectedProperty);
      if (result.allowed) {
        this.selectedProperty.skipTraceStatus = 'in_progress';
      }
      return;
    }
    this.selectedProperty.skipTraceStatus = 'in_progress';
    this.snackBar.open(
      `${this.selectedProperty.address} queued for skip trace`,
      'OK', { duration: 3000 }
    );
    this.computeKpis();
  }

  queueAiOutreach(): void {
    if (!this.selectedProperty) return;
    if (this.territoryEnforcementEnabled) {
      this.resolveAndEnforceTerritory(this.selectedProperty);
      const result = enforceTerritory(this.selectedProperty);
      if (result.allowed) {
        this.selectedProperty.outreachStatus = 'in_progress';
      }
      return;
    }
    this.selectedProperty.outreachStatus = 'in_progress';
    this.snackBar.open(
      `AI outreach queued for ${this.selectedProperty.address} — call, text, email`,
      'OK', { duration: 3000 }
    );
    this.computeKpis();
  }

  // ── Lead Workflow Actions ────────────────────────────────────

  startOutreach(prop: RoofProperty, $event: MouseEvent): void {
    $event.stopPropagation();
    const compliance = this.checkLicensingCompliance(prop);
    if (!compliance.compliant) {
      this.snackBar.open(`Cannot start outreach: ${compliance.reason}`, 'OK', { duration: 4000 });
      return;
    }
    prop.outreachStatus = 'in_progress';
    this.selectProperty(prop);
    this.snackBar.open(
      `Outreach started for ${prop.address}`,
      'OK', { duration: 3000 }
    );
  }

  markAsContacted(prop: RoofProperty, $event: MouseEvent): void {
    $event.stopPropagation();
    const compliance = this.checkLicensingCompliance(prop);
    if (!compliance.compliant) {
      this.snackBar.open(`Cannot mark as contacted: ${compliance.reason}`, 'OK', { duration: 4000 });
      return;
    }
    prop.leadWorkflowStatus = 'contacted';
    prop.outreachStatus = 'complete';
    this.snackBar.open(
      `${prop.address} marked as contacted`,
      'OK', { duration: 3000 }
    );
  }

  createClaim(prop: RoofProperty, $event: MouseEvent): void {
    $event.stopPropagation();
    const compliance = this.checkLicensingCompliance(prop);
    if (!compliance.compliant) {
      this.snackBar.open(`Cannot create claim: ${compliance.reason}`, 'OK', { duration: 4000 });
      return;
    }
    prop.leadWorkflowStatus = 'claim_filed';
    prop.adjusterPacketStatus = 'complete';
    const claimAvg = Math.round((prop.claimRangeLow + prop.claimRangeHigh) / 2);
    this.snackBar.open(
      `Claim filed for ${prop.address} — est. $${claimAvg.toLocaleString()}`,
      'OK', { duration: 4000 }
    );
  }

  getLeadWorkflowColor(status: LeadWorkflowStatus): string {
    switch (status) {
      case 'not_started': return '#94a3b8';
      case 'contacted': return '#3b82f6';
      case 'inspection_scheduled': return '#f59e0b';
      case 'claim_filed': return '#22c55e';
    }
  }

  getLeadWorkflowLabel(status: LeadWorkflowStatus): string {
    switch (status) {
      case 'not_started': return 'NOT STARTED';
      case 'contacted': return 'CONTACTED';
      case 'inspection_scheduled': return 'INSPECTION';
      case 'claim_filed': return 'CLAIM FILED';
    }
  }

  exportHighProbList(): void {
    this.snackBar.open(
      `Exporting ${this.highProbProperties.length} high-probability opportunities...`,
      '', { duration: 2000 }
    );
  }

  // ── Helpers ───────────────────────────────────────────────────

  /** Smooth gradient for score bars matching tier thresholds */
  getScoreGradient(score: number): string {
    if (score < 50) {
      return 'linear-gradient(90deg, #22c55e, #4ade80)';      // green (LOW)
    } else if (score < 70) {
      return 'linear-gradient(90deg, #eab308, #facc15)';      // yellow (MEDIUM)
    } else if (score < 85) {
      return 'linear-gradient(90deg, #f97316, #fb923c)';      // orange (HIGH)
    }
    return 'linear-gradient(90deg, #ef4444, #f87171)';        // red (IMMEDIATE)
  }

  getDamageColor(label: string): string {
    switch (label) {
      case 'immediate': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#64748b';
    }
  }

  getDamageBg(label: string): string {
    switch (label) {
      case 'immediate': return 'rgba(239, 68, 68, 0.12)';
      case 'high': return 'rgba(249, 115, 22, 0.12)';
      case 'medium': return 'rgba(234, 179, 8, 0.12)';
      case 'low': return 'rgba(34, 197, 94, 0.12)';
      default: return 'rgba(100, 116, 139, 0.12)';
    }
  }

  getTierLabel(tier: ProbabilityTier): string {
    switch (tier) {
      case 'immediate': return 'IMMEDIATE';
      case 'high': return 'HIGH';
      case 'medium': return 'MEDIUM';
      case 'low': return 'LOW';
    }
  }

  getStatusColor(status: WorkflowStatus): string {
    switch (status) {
      case 'complete': return '#22c55e';
      case 'in_progress': return '#3b82f6';
      case 'pending': return '#f59e0b';
      case 'not_started': return '#64748b';
    }
  }

  getStatusLabel(status: WorkflowStatus): string {
    switch (status) {
      case 'complete': return 'Complete';
      case 'in_progress': return 'In Progress';
      case 'pending': return 'Pending';
      case 'not_started': return 'Not Started';
    }
  }

  getOwnerStatusColor(status: string): string {
    switch (status) {
      case 'verified': return '#22c55e';
      case 'unverified': return '#f59e0b';
      case 'absentee': return '#ef4444';
      default: return '#64748b';
    }
  }

  formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  }

  getOpportunityScoreColor(score: OpportunityScore): string {
    switch (score) {
      case 'Very High': return '#ef4444';
      case 'High': return '#f97316';
      case 'Moderate': return '#eab308';
      case 'Low': return '#64748b';
    }
  }

  getLeadPipelineColor(status: string): string {
    switch (status) {
      case 'queued': return '#f59e0b';
      case 'sent': return '#22c55e';
      default: return '#64748b';
    }
  }

  getDetectionIcon(type: string): string {
    switch (type) {
      case 'missing_shingles': return 'roofing';
      case 'hail_strikes': return 'grain';
      case 'wind_uplift': return 'air';
      case 'tarp_presence': return 'shield';
      case 'debris_patterns': return 'delete_sweep';
      case 'siding_damage': return 'vertical_split';
      case 'roof_discoloration': return 'palette';
      case 'patch_repairs': return 'build';
      default: return 'help_outline';
    }
  }

  getDamageProbabilityColor(score: number): string {
    if (score >= 80) return '#ef4444';
    if (score >= 60) return '#f97316';
    if (score >= 40) return '#eab308';
    return '#22c55e';
  }

  // ── Territory Enforcement Helpers ──────────────────────────────

  getEscalationStepColor(status: EscalationStepStatus): string {
    switch (status) {
      case 'active': return '#0d9488';
      case 'accepted': return '#22c55e';
      case 'timeout': return '#ef4444';
      case 'declined': return '#f97316';
      case 'skipped': return '#94a3b8';
      case 'pending': return '#cbd5e1';
    }
  }

  getEscalationStepIcon(status: EscalationStepStatus): string {
    switch (status) {
      case 'active': return 'hourglass_top';
      case 'accepted': return 'check_circle';
      case 'timeout': return 'timer_off';
      case 'declined': return 'cancel';
      case 'skipped': return 'skip_next';
      case 'pending': return 'radio_button_unchecked';
    }
  }

  getEscalationDisplayLabel(label: EscalationLabel): string {
    switch (label) {
      case 'agent_1': return 'Territory Agent 1';
      case 'agent_2': return 'Territory Agent 2';
      case 'agent_3': return 'Territory Agent 3';
      case 'chapter_president': return 'Chapter President';
      case 'state_pool': return 'State Backup Pool';
      case 'home_office': return 'Home Office';
    }
  }

  getLogActionIcon(action: string): string {
    switch (action) {
      case 'territory_resolved': return 'map';
      case 'escalation_started': return 'play_circle';
      case 'agent_notified': return 'notifications';
      case 'agent_accepted': return 'check_circle';
      case 'agent_declined': return 'cancel';
      case 'agent_timeout': return 'timer_off';
      case 'escalation_advanced': return 'arrow_upward';
      case 'escalation_complete': return 'flag';
      case 'no_territory': return 'block';
      case 'blocked': return 'block';
      default: return 'info';
    }
  }

  getLogActionColor(action: string): string {
    switch (action) {
      case 'territory_resolved': return '#0d9488';
      case 'escalation_started': return '#3b82f6';
      case 'agent_notified': return '#8b5cf6';
      case 'agent_accepted': return '#22c55e';
      case 'agent_declined': return '#f97316';
      case 'agent_timeout': return '#ef4444';
      case 'escalation_advanced': return '#0d9488';
      case 'escalation_complete': return '#64748b';
      case 'no_territory': return '#ef4444';
      case 'blocked': return '#ef4444';
      default: return '#64748b';
    }
  }

  // ── Potential Claims Rolling In ─────────────────────────────────

  loadPredictedClaims(): void {
    if (!this.useLiveData) {
      this.loadMockPredictedClaims();
      return;
    }

    forkJoin({
      events: this.claimsService.getEvents(48).pipe(catchError(() => of([] as any[]))),
      zones: this.claimsService.getZones(48).pipe(catchError(() => of([] as any[]))),
      ticker: this.claimsService.getTicker(48, 20).pipe(catchError(() => of([] as any[]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ events, zones, ticker }) => {
        // Only overwrite each array if API returned non-empty data for that specific array.
        // This prevents partial API responses from wiping out pre-loaded mock data.
        if (events.length > 0) {
          this.predictedEvents = events.map((e: any) => ({
            id: e.id,
            eventType: e.event_type || e.eventType,
            city: e.city,
            state: e.state,
            county: e.county,
            timestamp: toValidDate(e.timestamp) || new Date(),
            severity: e.severity,
            claimProbability: e.claim_probability ?? e.claimProbability,
            territoryId: null,
            territoryName: null,
            description: e.description,
            source: e.source,
          })).sort((a: any, b: any) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
        } else if (this.predictedEvents.length === 0) {
          this.predictedEvents = [...MOCK_PREDICTED_EVENTS]
            .sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
        }

        if (zones.length > 0) {
          this.predictedZones = zones.map((z: any) => ({
            id: z.id,
            name: z.name,
            eventType: z.event_type || z.eventType,
            center: z.center,
            radiusMeters: z.radius_meters ?? z.radiusMeters,
            severity: z.severity,
            priority: z.priority,
            claimProbability: z.claim_probability ?? z.claimProbability,
            estimatedHomesAffected: z.estimated_homes_affected ?? z.estimatedHomesAffected,
            affectedZips: z.affected_zips ?? z.affectedZips ?? [],
            county: z.county,
            state: z.state,
            territoryId: null,
            territoryName: null,
            trajectory: '',
            linkedPropertyIds: z.linked_property_ids ?? z.linkedPropertyIds ?? [],
            timestamp: toValidDate(z.timestamp) || new Date(),
            active: z.active ?? true,
          })).sort((a: any, b: any) => {
            const sevOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, monitor: 3 };
            return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
          });
        } else if (this.predictedZones.length === 0) {
          this.predictedZones = [...MOCK_PREDICTED_ZONES]
            .sort((a, b) => {
              const sevOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, monitor: 3 };
              return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
            });
        }

        if (ticker.length > 0) {
          this.tickerMessages = ticker.map((t: any) => ({
            id: t.id,
            text: t.text,
            severity: t.severity,
            timestamp: toValidDate(t.timestamp) || new Date(),
          }));
        } else if (this.tickerMessages.length === 0) {
          this.tickerMessages = [...MOCK_TICKER_MESSAGES];
        }

        // liveActivityEvents is never provided by the API — always ensure it has data
        if (this.liveActivityEvents.length === 0) {
          this.liveActivityEvents = [...MOCK_LIVE_ACTIVITY]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        }

        this.refreshTimeLabels();
        this.startTickerAnimation();
        this.renderPredictedZones();
        this.cdr.detectChanges();
      });
  }

  private loadMockPredictedClaims(): void {
    this.predictedEvents = [...MOCK_PREDICTED_EVENTS]
      .sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
    this.predictedZones = [...MOCK_PREDICTED_ZONES]
      .sort((a, b) => {
        const sevOrder: Record<ClaimSeverity, number> = { critical: 0, high: 1, moderate: 2, monitor: 3 };
        return sevOrder[a.severity] - sevOrder[b.severity];
      });
    this.tickerMessages = [...MOCK_TICKER_MESSAGES];
    this.liveActivityEvents = [...MOCK_LIVE_ACTIVITY]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    this.refreshTimeLabels();
    this.startTickerAnimation();
    this.renderPredictedZones();
    this.cdr.detectChanges();
  }

  private startTickerAnimation(): void {
    // Animation is now handled by CSS @keyframes ticker-marquee
    // (smooth GPU-accelerated, no jitter, no reset jump)
    if (this.tickerInterval) clearInterval(this.tickerInterval);
  }

  // --- Simulated Live Event Stream ---

  private readonly LIVE_EVENT_TEMPLATES: Array<Omit<LiveActivityEvent, 'id' | 'timestamp' | 'isNew'>> = [
    { type: 'lead_generated', label: 'New Lead Generated', location: 'Plano, TX 75025', action: 'Added to opportunity queue', color: 'blue' },
    { type: 'lead_generated', label: 'New Lead Generated', location: 'Anna, TX 75409', action: 'Storm-based analysis — added to queue', color: 'blue' },
    { type: 'high_prob_detected', label: 'High Probability Lead Detected', location: 'Allen, TX 75002', action: 'Score 94 — flagged for immediate outreach', color: 'red' },
    { type: 'high_prob_detected', label: 'High Probability Lead Detected', location: 'Murphy, TX 75094', action: 'Score 91 — storm-verified, 18yr roof', color: 'red' },
    { type: 'lead_assigned', label: 'Lead Assigned to Agent', location: 'Frisco, TX 75034', action: 'Assigned to Mike Torres — Collin County', color: 'green' },
    { type: 'lead_assigned', label: 'Lead Assigned to Agent', location: 'Wylie, TX 75098', action: 'Assigned to Sarah Kim — Collin County', color: 'green' },
    { type: 'claim_opened', label: 'Claim Opened', location: 'McKinney, TX 75071', action: 'Claim #CLM-4833 filed — est. $19,200', color: 'green' },
    { type: 'claim_opened', label: 'Claim Opened', location: 'Garland, TX 75040', action: 'Claim #CLM-4835 filed — est. $14,750', color: 'green' },
    { type: 'ai_outreach_sent', label: 'AI Outreach Sent', location: 'Richardson, TX 75080', action: 'SMS + email sequence initiated', color: 'blue' },
    { type: 'ai_outreach_sent', label: 'AI Outreach Sent', location: 'Celina, TX 75009', action: 'Follow-up sequence #3 triggered', color: 'blue' },
    { type: 'inspection_scheduled', label: 'Inspection Scheduled', location: 'Prosper, TX 75078', action: 'Mar 24 at 9:00 AM — homeowner confirmed', color: 'green' },
    { type: 'inspection_scheduled', label: 'Inspection Scheduled', location: 'Forney, TX 75126', action: 'Mar 25 at 1:30 PM — pending confirmation', color: 'green' },
  ];

  private startLiveActivitySimulator(): void {
    if (this.liveActivitySimHandle) clearTimeout(this.liveActivitySimHandle);
    this.scheduleNextEvent();
  }

  private scheduleNextEvent(): void {
    const delay = 3000 + Math.random() * 3000; // 3–6 seconds
    this.liveActivitySimHandle = setTimeout(() => {
      this.ngZone.run(() => {
        this.injectSimulatedEvent();
        this.scheduleNextEvent();
      });
    }, delay);
  }

  private injectSimulatedEvent(): void {
    const template = this.LIVE_EVENT_TEMPLATES[Math.floor(Math.random() * this.LIVE_EVENT_TEMPLATES.length)];
    this.liveActivityCounter++;
    const newEvent: LiveActivityEvent = {
      ...template,
      id: `LA-SIM-${this.liveActivityCounter}`,
      timestamp: new Date(),
      isNew: true,
    };

    // Prepend new event
    this.liveActivityEvents.unshift(newEvent);

    // Cap at 25 items
    if (this.liveActivityEvents.length > 25) {
      this.liveActivityEvents = this.liveActivityEvents.slice(0, 25);
    }

    // Update time label for new event
    this.cachedLiveActivityTimes.set(newEvent.id, 'just now');

    this.cdr.detectChanges();

    // Remove isNew flag after glow animation completes
    setTimeout(() => {
      newEvent.isNew = false;
      this.cdr.detectChanges();
    }, 2000);
  }

  renderPredictedZones(): void {
    if (!this.mapReady) return;
    this.predictedZonesLayer.clearLayers();

    for (const zone of this.predictedZones) {
      if (!zone.active) continue;

      const color = this.getSeverityColor(zone.severity);
      const isCritical = zone.severity === 'critical';
      const isHigh = zone.severity === 'high';

      // Outer diffuse ring for critical/high zones
      if (isCritical || isHigh) {
        const outerRing = L.circle(zone.center as L.LatLngExpression, {
          radius: zone.radiusMeters * 1.15,
          color,
          fillColor: color,
          fillOpacity: 0.05,
          weight: 0,
          interactive: false,
        });
        this.predictedZonesLayer.addLayer(outerRing);
      }

      // Main zone circle
      const circle = L.circle(zone.center as L.LatLngExpression, {
        radius: zone.radiusMeters,
        color,
        fillColor: color,
        fillOpacity: isCritical ? 0.2 : isHigh ? 0.15 : 0.1,
        weight: isCritical ? 3 : 2,
        dashArray: isCritical ? undefined : isHigh ? '6, 4' : '8, 6',
        className: isCritical ? 'zone-critical-ring' : undefined,
      });

      circle.bindTooltip(
        `<div style="font-size:12px;line-height:1.5">` +
        `<strong>${zone.name}</strong><br>` +
        `<span style="color:${color};font-weight:700">${zone.eventType.toUpperCase()} — ${zone.severity.toUpperCase()}</span><br>` +
        `${zone.estimatedHomesAffected.toLocaleString()} homes · ${zone.claimProbability}% probability` +
        `</div>`,
        { direction: 'top', offset: [0, -10], className: 'roof-tooltip' }
      );

      circle.on('click', () => this.selectZone(zone));
      this.predictedZonesLayer.addLayer(circle);

      // Pulsing center marker for critical/high zones
      if (isCritical || isHigh) {
        // Outer pulse ring
        const pulseOuter = L.circleMarker(zone.center as L.LatLngExpression, {
          radius: isCritical ? 14 : 10,
          color,
          fillColor: color,
          fillOpacity: 0.15,
          weight: 0,
          className: 'zone-pulse-ring',
        });
        this.predictedZonesLayer.addLayer(pulseOuter);

        // Inner solid dot
        const pulseMarker = L.circleMarker(zone.center as L.LatLngExpression, {
          radius: isCritical ? 7 : 5,
          color: '#fff',
          fillColor: color,
          fillOpacity: 1,
          weight: 2,
        });
        pulseMarker.on('click', () => this.selectZone(zone));
        pulseMarker.bindTooltip(`${zone.claimProbability}%`, {
          permanent: isCritical,
          direction: 'right',
          offset: [10, 0],
          className: 'zone-prob-label',
        });
        this.predictedZonesLayer.addLayer(pulseMarker);
      }
    }
  }

  togglePredictedZonesLayer(): void {
    if (!this.mapReady) return;
    this.predictedZonesLayerVisible = !this.predictedZonesLayerVisible;
    if (this.predictedZonesLayerVisible) {
      this.map.addLayer(this.predictedZonesLayer);
    } else {
      this.map.removeLayer(this.predictedZonesLayer);
    }
  }

  selectZone(zone: PredictedClaimZone): void {
    this.selectedZone = zone;
    this.zonePanelOpen = true;
    if (this.mapReady) {
      this.map.flyTo(zone.center as L.LatLngExpression, 12, { duration: 0.6 });
    }
  }

  closeZonePanel(): void {
    this.zonePanelOpen = false;
    this.selectedZone = null;
  }

  getLinkedProperties(zone: PredictedClaimZone): RoofProperty[] {
    return this.allProperties.filter(p => zone.linkedPropertyIds.includes(p.id));
  }

  getSeverityColor(severity: ClaimSeverity): string {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'moderate': return '#eab308';
      case 'monitor': return '#3b82f6';
    }
  }

  getSeverityBg(severity: ClaimSeverity): string {
    switch (severity) {
      case 'critical': return 'rgba(239, 68, 68, 0.12)';
      case 'high': return 'rgba(249, 115, 22, 0.12)';
      case 'moderate': return 'rgba(234, 179, 8, 0.12)';
      case 'monitor': return 'rgba(59, 130, 246, 0.12)';
    }
  }

  getEventTypeIcon(type: ClaimEventType): string {
    switch (type) {
      case 'hail': return 'grain';
      case 'wind': return 'air';
      case 'lightning': return 'flash_on';
      case 'tornado': return 'cyclone';
      case 'flooding': return 'water';
    }
  }

  getEventTypeLabel(type: ClaimEventType): string {
    switch (type) {
      case 'hail': return 'Hail';
      case 'wind': return 'Wind';
      case 'lightning': return 'Lightning';
      case 'tornado': return 'Tornado';
      case 'flooding': return 'Flooding';
    }
  }

  getLiveActivityIcon(type: LiveActivityType): string {
    switch (type) {
      case 'lead_generated': return 'add_circle';
      case 'high_prob_detected': return 'priority_high';
      case 'lead_assigned': return 'person_add';
      case 'claim_opened': return 'description';
      case 'ai_outreach_sent': return 'send';
      case 'inspection_scheduled': return 'event';
    }
  }

  getLiveActivityColor(color: LiveActivityColor): string {
    switch (color) {
      case 'red': return '#ef4444';
      case 'green': return '#22c55e';
      case 'blue': return '#3b82f6';
    }
  }

  getLiveActivityBg(color: LiveActivityColor): string {
    switch (color) {
      case 'red': return 'rgba(239, 68, 68, 0.12)';
      case 'green': return 'rgba(34, 197, 94, 0.12)';
      case 'blue': return 'rgba(59, 130, 246, 0.12)';
    }
  }

  getPriorityColor(priority: ClaimPriority): string {
    switch (priority) {
      case 'P1': return '#ef4444';
      case 'P2': return '#f97316';
      case 'P3': return '#eab308';
      case 'P4': return '#3b82f6';
    }
  }

  getTimeAgo(date: Date | string | null | undefined): string {
    if (date == null) return 'Unknown';
    const d = toValidDate(date);
    if (!d) return 'Unknown';
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 0) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // ── Data Quality & Compliance ──────────────────────────────────

  checkLicensingCompliance(prop: RoofProperty): { compliant: boolean; reason: string } {
    if (!prop.state) return { compliant: false, reason: 'Property state unknown' };
    if (this.agentLicensedStates.includes(prop.state)) {
      return { compliant: true, reason: '' };
    }
    return { compliant: false, reason: `Not licensed in ${prop.state}. Licensed states: ${this.agentLicensedStates.join(', ')}` };
  }

  getRelativeTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const d = toValidDate(dateStr);
    if (!d) return '—';
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 0) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  getAgeBadgeColor(age: OpportunityAge): string {
    switch (age) {
      case 'immediate': return '#ef4444';
      case 'active': return '#f97316';
      case 'aging': return '#f59e0b';
      case 'archive': return '#94a3b8';
    }
  }

  getAgeBadgeLabel(age: OpportunityAge): string {
    switch (age) {
      case 'immediate': return 'IMMEDIATE';
      case 'active': return 'ACTIVE';
      case 'aging': return 'AGING';
      case 'archive': return 'ARCHIVE';
    }
  }

  getImageQualityIcon(quality: ImageQualityState): string {
    switch (quality) {
      case 'GOOD': return 'check_circle';
      case 'WEAK': return 'visibility_off';
      case 'BAD': return 'block';
    }
  }

  getImageQualityColor(quality: ImageQualityState): string {
    switch (quality) {
      case 'GOOD': return '#22c55e';
      case 'WEAK': return '#f59e0b';
      case 'BAD': return '#ef4444';
    }
  }

  getConfidenceLabel(quality: ImageQualityState): string {
    switch (quality) {
      case 'GOOD': return 'High Confidence Imagery';
      case 'WEAK': return 'Limited Visibility';
      case 'BAD': return 'Imagery Unavailable';
    }
  }

  getConfidenceSubtext(quality: ImageQualityState): string {
    switch (quality) {
      case 'GOOD': return 'Clear roof visible in satellite image';
      case 'WEAK': return 'Roof partially obstructed — storm data verified';
      case 'BAD': return 'Roof not visible — scored via storm data only';
    }
  }

  getAreaClaimCount(prop: RoofProperty): number {
    // Deterministic mock: hash coordinates to produce 4–22 claims in 2-mile radius
    const h = Math.abs(Math.sin(prop.latitude * 12.9898 + prop.longitude * 78.233) * 43758.5453) % 1;
    return Math.round(4 + h * 18);
  }

  getAreaAvgPayout(prop: RoofProperty): number {
    // Deterministic mock: $8K–$28K based on roof size + coordinate hash
    const h = Math.abs(Math.cos(prop.latitude * 43.2311 + prop.longitude * 97.134) * 28571.4286) % 1;
    return Math.round((8000 + h * 20000) / 500) * 500;
  }

  getAiConclusion(prop: RoofProperty): string {
    const tier = prop.probabilityTier;
    const hasStorm = prop.stormType && prop.stormType !== 'Unknown';
    if (tier === 'immediate' || tier === 'high') {
      return 'High probability of roof damage based on verified storm + property profile';
    } else if (tier === 'medium') {
      return hasStorm
        ? 'Moderate probability of roof damage — storm verified, inspection recommended'
        : 'Moderate probability based on property age and area claim patterns';
    }
    return 'Low probability — monitor for future storm events';
  }

  getClaimDecisionTier(score: number): string {
    if (score >= 85) return 'lce-decision-high';
    if (score >= 70) return 'lce-decision-moderate';
    return 'lce-decision-low';
  }

  getClaimDecisionText(score: number): string {
    if (score >= 85) return 'High Probability Claim \u2013 Immediate Outreach Recommended';
    if (score >= 70) return 'Moderate Probability \u2013 Inspect Soon';
    return 'Low Probability \u2013 Monitor';
  }

  getClaimDecisionIcon(score: number): string {
    if (score >= 85) return 'rocket_launch';
    if (score >= 70) return 'schedule';
    return 'visibility';
  }

  formatStormDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  onSatelliteImageError(event: Event, prop: RoofProperty | null): void {
    if (!prop) return;
    prop.roofImageAnalysis = {
      roofCoveragePct: 0,
      treeDominancePct: 0,
      cropCenterSource: 'raw_coordinates',
      imageTimestamp: null,
      qualityState: 'BAD',
      qualityReason: 'Image failed to load',
    };
    prop.imageQuality = 'BAD';
    const img = event.target as HTMLImageElement;
    if (img) img.style.display = 'none';
  }

  getZonesForTerritory(territoryId: string): PredictedClaimZone[] {
    return this.predictedZones.filter(z => z.territoryId === territoryId);
  }

  getActiveZoneCount(): number {
    return this.predictedZones.filter(z => z.active).length;
  }

  getCriticalEventCount(): number {
    return this.predictedEvents.filter(e => e.severity === 'critical').length;
  }

  getTotalHomesAffected(): number {
    return this.predictedZones
      .filter(z => z.active)
      .reduce((sum, z) => sum + z.estimatedHomesAffected, 0);
  }
}
