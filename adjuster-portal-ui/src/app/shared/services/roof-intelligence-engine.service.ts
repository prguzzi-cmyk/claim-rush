import { Injectable } from '@angular/core';

import { RoofAnalysisRecord, RoofAnalysisStats } from 'src/app/models/roof-intelligence.model';
import { ManualLeadIntakeRequest } from 'src/app/models/lead-intake.model';
import {
  DamageProbability,
  DAMAGE_PROBABILITY_META,
  RoofOpportunity,
  ScoringInputs,
  ROOF_MATERIAL_RISK,
  RoofDashboardMetrics,
  RoofMapMarker,
} from '../models/roof-opportunity.model';

/**
 * RoofIntelligenceEngine
 *
 * Pure computation service for roof damage probability scoring,
 * lead generation payloads, map marker generation, and dashboard metrics.
 *
 * Integrates with (does NOT duplicate):
 * - RoofIntelligenceService (HTTP CRUD — this engine is called AFTER data is fetched)
 * - StormDataService (storm event data source)
 * - LeadIntakeService (lead creation via existing endpoint)
 * - LeadRotationEngine (territory routing for generated leads)
 * - TerritoryService (territory lookup)
 *
 * No HTTP calls — pure computation and payload building.
 */
@Injectable({ providedIn: 'root' })
export class RoofIntelligenceEngineService {

  // ═══════════════════════════════════════════════════════════════
  // 1. Damage Probability Scoring
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculate a damage probability score (0-100) from storm and property data.
   *
   * Scoring formula:
   *   hailScore (0-40) + windScore (0-30) + ageScore (0-20) + materialScore (0-10)
   *
   * Hail: linear 0-4" mapped to 0-40 points
   * Wind: linear 0-130 mph mapped to 0-30 points
   * Roof Age: linear 0-30 years mapped to 0-20 points
   * Material: risk factor multiplied into final score
   */
  computeDamageScore(inputs: ScoringInputs): number {
    const hailScore = this.scoreHail(inputs.hailSizeInches);
    const windScore = this.scoreWind(inputs.windSpeedMph);
    const ageScore = this.scoreAge(inputs.roofAgeYears);
    const materialFactor = this.getMaterialFactor(inputs.roofType);

    const rawScore = hailScore + windScore + ageScore;
    return Math.min(100, Math.round(rawScore * materialFactor));
  }

  private scoreHail(inches: number | null): number {
    if (!inches || inches <= 0) return 0;
    // 1" = 10pt, 2" = 20pt, 3" = 30pt, 4"+ = 40pt
    return Math.min(40, Math.round(inches * 10));
  }

  private scoreWind(mph: number | null): number {
    if (!mph || mph <= 0) return 0;
    // 60 mph = 14pt, 90 mph = 21pt, 130+ mph = 30pt
    if (mph < 50) return 0;
    return Math.min(30, Math.round((mph - 50) * 0.375));
  }

  private scoreAge(years: number | null): number {
    if (!years || years <= 0) return 0;
    // 10yr = 7pt, 20yr = 13pt, 30yr+ = 20pt
    return Math.min(20, Math.round(years * 0.67));
  }

  private getMaterialFactor(material: string | null): number {
    if (!material) return 1.0;
    const normalized = material.toLowerCase().replace(/[\s/-]+/g, '_');
    return ROOF_MATERIAL_RISK[normalized] || 1.0;
  }

  /**
   * Classify a damage score into a probability category.
   */
  classifyProbability(score: number): DamageProbability {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  /**
   * Compute inspection priority (1 = highest priority).
   * Critical = 1, High = 2, Medium = 3, Low = 4
   */
  computeInspectionPriority(probability: DamageProbability): number {
    const priorities: Record<DamageProbability, number> = {
      critical: 1, high: 2, medium: 3, low: 4,
    };
    return priorities[probability];
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Roof Opportunity Enrichment
  // ═══════════════════════════════════════════════════════════════

  /**
   * Enrich a RoofAnalysisRecord into a scored RoofOpportunity.
   */
  enrichRecord(record: RoofAnalysisRecord): RoofOpportunity {
    const inputs: ScoringInputs = {
      hailSizeInches: record.hail_size_inches,
      windSpeedMph: record.wind_speed_mph,
      roofAgeYears: record.roof_age_years,
      roofType: record.roof_type,
      stormDurationMinutes: null,
      roofSizeSqft: record.roof_size_sqft,
    };

    // Use backend score if available, otherwise compute locally
    const score = record.damage_score > 0 ? record.damage_score : this.computeDamageScore(inputs);
    const probability = this.classifyProbability(score);
    const priority = this.computeInspectionPriority(probability);
    const shouldGenerate = probability === 'high' || probability === 'critical';

    return {
      record,
      damageProbability: probability,
      inspectionPriority: priority,
      estimatedClaimValue: record.estimated_claim_value || 0,
      shouldGenerateLead: shouldGenerate,
      leadGenerated: record.outreach_status === 'lead_created' || record.outreach_status === 'contacted',
      leadId: null,
    };
  }

  /**
   * Enrich a batch of records.
   */
  enrichBatch(records: RoofAnalysisRecord[]): RoofOpportunity[] {
    return records.map(r => this.enrichRecord(r));
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Lead Generation Payload
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build a ManualLeadIntakeRequest from a roof opportunity.
   * This payload is compatible with the existing lead-intake endpoint.
   */
  buildLeadPayload(opp: RoofOpportunity): ManualLeadIntakeRequest {
    const r = opp.record;
    return {
      incident_type: r.storm_type || 'hail',
      address: r.address,
      city: r.city,
      state: r.state,
      county: r.county || undefined,
      latitude: r.latitude,
      longitude: r.longitude,
      source: 'roof_intelligence',
      full_name: r.owner_name || undefined,
      phone_number: undefined,
      auto_distribute: true,
    };
  }

  /**
   * Filter opportunities that should generate leads.
   */
  getLeadCandidates(opportunities: RoofOpportunity[]): RoofOpportunity[] {
    return opportunities.filter(o => o.shouldGenerateLead && !o.leadGenerated);
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Map Marker Generation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Convert roof opportunities into map markers for Leaflet display.
   */
  buildMapMarkers(opportunities: RoofOpportunity[]): RoofMapMarker[] {
    return opportunities.map(opp => {
      const r = opp.record;
      const meta = DAMAGE_PROBABILITY_META[opp.damageProbability];

      return {
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        color: meta.markerColor,
        probability: opp.damageProbability,
        address: r.address,
        damageScore: r.damage_score,
        ownerName: r.owner_name,
        tooltipHtml: this.buildTooltip(opp),
      };
    });
  }

  private buildTooltip(opp: RoofOpportunity): string {
    const r = opp.record;
    const meta = DAMAGE_PROBABILITY_META[opp.damageProbability];
    const lines = [
      `<strong>${r.address}</strong>`,
      `${r.city}, ${r.state} ${r.zip_code}`,
      `<span style="color:${meta.color};font-weight:600">${meta.label} Probability</span> (Score: ${r.damage_score})`,
    ];
    if (r.hail_size_inches) lines.push(`Hail: ${r.hail_size_inches}″`);
    if (r.wind_speed_mph) lines.push(`Wind: ${r.wind_speed_mph} mph`);
    if (r.roof_age_years) lines.push(`Roof Age: ${r.roof_age_years} yrs`);
    if (r.roof_type) lines.push(`Material: ${r.roof_type}`);
    if (r.owner_name) lines.push(`Owner: ${r.owner_name}`);
    if (r.estimated_claim_value) {
      lines.push(`Est. Value: $${r.estimated_claim_value.toLocaleString()}`);
    }
    return lines.join('<br>');
  }

  /**
   * Filter markers by probability for map layer toggling.
   */
  filterMarkersByProbability(
    markers: RoofMapMarker[],
    minProbability: DamageProbability,
  ): RoofMapMarker[] {
    const minScore = DAMAGE_PROBABILITY_META[minProbability].minScore;
    return markers.filter(m => m.damageScore >= minScore);
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Dashboard Metrics
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compute dashboard metrics from enriched opportunities.
   */
  computeDashboardMetrics(
    opportunities: RoofOpportunity[],
    stats?: RoofAnalysisStats,
  ): RoofDashboardMetrics {
    const byProb: Record<DamageProbability, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byStorm: Record<string, number> = {};
    const byTerritory = new Map<string, { name: string; count: number; totalScore: number }>();

    let totalScore = 0;
    let leadsGenerated = 0;

    for (const opp of opportunities) {
      byProb[opp.damageProbability]++;
      totalScore += opp.record.damage_score;

      const storm = opp.record.storm_type || 'unknown';
      byStorm[storm] = (byStorm[storm] || 0) + 1;

      if (opp.leadGenerated) leadsGenerated++;

      const tid = opp.record.territory_id || 'unassigned';
      const tname = opp.record.territory_name || 'Unassigned';
      if (!byTerritory.has(tid)) byTerritory.set(tid, { name: tname, count: 0, totalScore: 0 });
      const t = byTerritory.get(tid)!;
      t.count++;
      t.totalScore += opp.record.damage_score;
    }

    const topTerritories = Array.from(byTerritory.values())
      .map(t => ({ territoryName: t.name, count: t.count, avgScore: Math.round(t.totalScore / t.count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      propertiesAnalyzed: stats?.total || opportunities.length,
      highProbabilityRoofs: byProb.high,
      criticalProbabilityRoofs: byProb.critical,
      leadsGenerated,
      leadsConverted: 0, // populated from lead service data
      avgDamageScore: opportunities.length > 0 ? Math.round(totalScore / opportunities.length) : 0,
      byProbability: byProb,
      byStormType: byStorm,
      topTerritories,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Outreach Queue Payloads
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build batch data for skip trace export.
   */
  buildSkipTraceBatch(opportunities: RoofOpportunity[]): { addresses: string[]; count: number } {
    const addresses = opportunities.map(o =>
      `${o.record.address}, ${o.record.city}, ${o.record.state} ${o.record.zip_code}`
    );
    return { addresses, count: addresses.length };
  }

  /**
   * Build batch data for AI outreach queue.
   */
  buildOutreachQueueBatch(opportunities: RoofOpportunity[]): {
    properties: { id: string; address: string; phone: string | null; ownerName: string | null; probability: string; score: number }[];
    count: number;
  } {
    const properties = opportunities.map(o => ({
      id: o.record.id,
      address: o.record.address,
      phone: null,
      ownerName: o.record.owner_name,
      probability: o.damageProbability,
      score: o.record.damage_score,
    }));
    return { properties, count: properties.length };
  }
}
