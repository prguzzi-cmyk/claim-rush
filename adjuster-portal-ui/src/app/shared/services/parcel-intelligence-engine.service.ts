import { Injectable } from '@angular/core';

import { RoofAnalysisRecord } from 'src/app/models/roof-intelligence.model';
import { StormEvent } from 'src/app/models/storm-event.model';
import { ManualLeadIntakeRequest } from 'src/app/models/lead-intake.model';
import { RoofIntelligenceEngineService } from './roof-intelligence-engine.service';
import {
  DamageProbability,
  DAMAGE_PROBABILITY_META,
  ScoringInputs,
} from '../models/roof-opportunity.model';
import {
  ParcelRecord,
  ParcelStormExposure,
  ParcelTargetingStatus,
  ParcelTargetingFilter,
  ParcelDashboardMetrics,
  ParcelMapFeature,
  CampaignExportPayload,
  CampaignExportType,
  TARGETING_STATUS_META,
} from '../models/parcel-intelligence.model';

/**
 * ParcelIntelligenceEngine
 *
 * Pure computation service for property targeting within storm zones.
 * Intersects parcels with storm data, applies roof scoring via the
 * existing RoofIntelligenceEngine, and produces lead/campaign payloads.
 *
 * Integrates with (does NOT duplicate):
 * - RoofIntelligenceEngine (damage scoring — delegates to it)
 * - RoofIntelligenceService (roof analysis data — consumed by caller)
 * - StormDataService (storm events — consumed by caller)
 * - LeadIntakeService (lead creation — produces payloads)
 * - TerritoryService (territory lookup — consumed by caller)
 *
 * No HTTP calls — pure computation and payload building.
 */
@Injectable({ providedIn: 'root' })
export class ParcelIntelligenceEngineService {

  constructor(private roofEngine: RoofIntelligenceEngineService) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. Storm Overlay / Intersection
  // ═══════════════════════════════════════════════════════════════

  /**
   * Intersect parcels with a storm event to determine exposure.
   * Uses simple radius-based intersection (haversine distance).
   */
  intersectWithStorm(
    parcels: ParcelRecord[],
    storm: StormEvent,
  ): ParcelRecord[] {
    const radiusKm = (storm.radius_miles || 10) * 1.60934;

    return parcels.map(p => {
      const distKm = this.haversineKm(
        storm.latitude, storm.longitude,
        p.latitude, p.longitude,
      );
      const distMiles = distKm / 1.60934;

      if (distKm > radiusKm) return p;

      const exposure: ParcelStormExposure = {
        stormEventId: storm.id,
        stormType: storm.event_type,
        hailSizeInches: storm.hail_size_inches || null,
        windSpeedMph: storm.wind_speed_mph || storm.gust_speed_mph || null,
        severity: storm.severity,
        distanceFromEpicenterMiles: Math.round(distMiles * 10) / 10,
        exposureDate: storm.reported_at instanceof Date ? storm.reported_at.toISOString() : String(storm.reported_at),
      };

      return { ...p, stormExposure: exposure };
    }).filter(p => p.stormExposure !== null);
  }

  /**
   * Intersect parcels with multiple storm events.
   * Uses the most severe storm for each parcel.
   */
  intersectWithStorms(
    parcels: ParcelRecord[],
    storms: StormEvent[],
  ): ParcelRecord[] {
    const results = new Map<string, ParcelRecord>();

    for (const storm of storms) {
      const exposed = this.intersectWithStorm(parcels, storm);
      for (const p of exposed) {
        const existing = results.get(p.parcelId);
        if (!existing || (p.stormExposure && existing.stormExposure &&
          this.stormSeverityRank(p.stormExposure.severity) >
          this.stormSeverityRank(existing.stormExposure.severity))) {
          results.set(p.parcelId, p);
        }
      }
    }

    return Array.from(results.values());
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Scoring (delegates to RoofIntelligenceEngine)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Score a parcel using the existing roof scoring engine.
   */
  scoreParcel(parcel: ParcelRecord): ParcelRecord {
    const inputs: ScoringInputs = {
      hailSizeInches: parcel.stormExposure?.hailSizeInches || null,
      windSpeedMph: parcel.stormExposure?.windSpeedMph || null,
      roofAgeYears: parcel.constructionYear
        ? new Date().getFullYear() - parcel.constructionYear
        : null,
      roofType: parcel.roofMaterialEstimate,
      stormDurationMinutes: null,
      roofSizeSqft: parcel.roofAreaEstimate,
    };

    const score = this.roofEngine.computeDamageScore(inputs);
    const probability = this.roofEngine.classifyProbability(score);
    const priority = this.roofEngine.computeInspectionPriority(probability);

    return {
      ...parcel,
      roofDamageScore: score,
      roofDamageProbability: probability,
      inspectionPriority: priority,
      targetingStatus: score > 0 ? 'analyzed' : parcel.targetingStatus,
    };
  }

  /**
   * Score a batch of parcels.
   */
  scoreBatch(parcels: ParcelRecord[]): ParcelRecord[] {
    return parcels.map(p => this.scoreParcel(p));
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Targeting Filters
  // ═══════════════════════════════════════════════════════════════

  /**
   * Apply targeting filters to a list of parcels.
   */
  applyFilters(
    parcels: ParcelRecord[],
    filter: ParcelTargetingFilter,
  ): ParcelRecord[] {
    let filtered = [...parcels];

    if (filter.stormType) {
      filtered = filtered.filter(p =>
        p.stormExposure?.stormType === filter.stormType
      );
    }

    if (filter.minDamageProbability) {
      const minScore = DAMAGE_PROBABILITY_META[filter.minDamageProbability].minScore;
      filtered = filtered.filter(p => (p.roofDamageScore || 0) >= minScore);
    }

    if (filter.minRoofSize != null) {
      filtered = filtered.filter(p =>
        (p.roofAreaEstimate || 0) >= filter.minRoofSize!
      );
    }

    if (filter.maxConstructionYear != null) {
      filtered = filtered.filter(p =>
        p.constructionYear != null && p.constructionYear <= filter.maxConstructionYear!
      );
    }

    if (filter.territoryId) {
      filtered = filtered.filter(p => p.territoryId === filter.territoryId);
    }

    if (filter.targetingStatus) {
      filtered = filtered.filter(p => p.targetingStatus === filter.targetingStatus);
    }

    if (filter.state) {
      filtered = filtered.filter(p =>
        p.state.toUpperCase() === filter.state!.toUpperCase()
      );
    }

    if (filter.county) {
      filtered = filtered.filter(p =>
        p.county?.toLowerCase() === filter.county!.toLowerCase()
      );
    }

    return filtered;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Lead Creation Payloads
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build a ManualLeadIntakeRequest from a parcel record.
   * Compatible with the existing lead-intake endpoint.
   */
  buildLeadPayload(parcel: ParcelRecord): ManualLeadIntakeRequest {
    return {
      incident_type: parcel.stormExposure?.stormType || 'hail',
      address: parcel.propertyAddress,
      city: parcel.city,
      state: parcel.state,
      county: parcel.county || undefined,
      latitude: parcel.latitude,
      longitude: parcel.longitude,
      source: 'parcel_intelligence',
      full_name: parcel.ownerName || undefined,
      phone_number: parcel.ownerPhone || undefined,
      auto_distribute: true,
    };
  }

  /**
   * Get parcels that should generate leads (high/critical probability, not yet created).
   */
  getLeadCandidates(parcels: ParcelRecord[]): ParcelRecord[] {
    return parcels.filter(p =>
      (p.roofDamageProbability === 'high' || p.roofDamageProbability === 'critical')
      && p.targetingStatus !== 'lead_created'
      && p.targetingStatus !== 'contacted'
      && p.targetingStatus !== 'converted'
      && p.targetingStatus !== 'excluded'
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Campaign Export Payloads
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build a campaign export payload for selected parcels.
   */
  buildCampaignExport(
    exportType: CampaignExportType,
    parcels: ParcelRecord[],
    filter: ParcelTargetingFilter,
  ): CampaignExportPayload {
    return {
      exportType,
      parcelIds: parcels.map(p => p.parcelId),
      totalParcels: parcels.length,
      filterApplied: filter,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Build skip trace batch from parcels.
   */
  buildSkipTraceBatch(parcels: ParcelRecord[]): {
    addresses: { address: string; city: string; state: string; zip: string }[];
    count: number;
  } {
    const addresses = parcels.map(p => ({
      address: p.propertyAddress,
      city: p.city,
      state: p.state,
      zip: p.zipCode,
    }));
    return { addresses, count: addresses.length };
  }

  /**
   * Build AI outreach queue batch from parcels.
   */
  buildOutreachBatch(parcels: ParcelRecord[]): {
    targets: {
      parcelId: string;
      address: string;
      ownerName: string | null;
      phone: string | null;
      probability: string;
      score: number;
    }[];
    count: number;
  } {
    const targets = parcels.map(p => ({
      parcelId: p.parcelId,
      address: `${p.propertyAddress}, ${p.city}, ${p.state} ${p.zipCode}`,
      ownerName: p.ownerName,
      phone: p.ownerPhone,
      probability: p.roofDamageProbability || 'unknown',
      score: p.roofDamageScore || 0,
    }));
    return { targets, count: targets.length };
  }

  /**
   * Build direct mail list from parcels.
   */
  buildDirectMailList(parcels: ParcelRecord[]): {
    recipients: {
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
    }[];
    count: number;
  } {
    const recipients = parcels
      .filter(p => p.ownerName)
      .map(p => ({
        name: p.ownerName!,
        address: p.propertyAddress,
        city: p.city,
        state: p.state,
        zip: p.zipCode,
      }));
    return { recipients, count: recipients.length };
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Map Features
  // ═══════════════════════════════════════════════════════════════

  /**
   * Convert parcels into map features for Leaflet rendering.
   */
  buildMapFeatures(parcels: ParcelRecord[]): ParcelMapFeature[] {
    return parcels.map(p => {
      const prob = p.roofDamageProbability || 'low';
      const meta = DAMAGE_PROBABILITY_META[prob] || DAMAGE_PROBABILITY_META.low;

      return {
        parcelId: p.parcelId,
        latitude: p.latitude,
        longitude: p.longitude,
        boundaryCoords: p.boundaryCoords,
        markerColor: meta.markerColor,
        fillColor: meta.markerColor,
        fillOpacity: prob === 'critical' ? 0.5 : prob === 'high' ? 0.35 : 0.2,
        probability: p.roofDamageProbability,
        damageScore: p.roofDamageScore || 0,
        tooltipHtml: this.buildTooltip(p),
      };
    });
  }

  private buildTooltip(p: ParcelRecord): string {
    const prob = p.roofDamageProbability || 'low';
    const meta = DAMAGE_PROBABILITY_META[prob] || DAMAGE_PROBABILITY_META.low;
    const lines = [
      `<strong>${p.propertyAddress}</strong>`,
      `${p.city}, ${p.state} ${p.zipCode}`,
      `<span style="color:${meta.color};font-weight:600">${meta.label} Probability</span> (Score: ${p.roofDamageScore || 0})`,
    ];
    if (p.roofAreaEstimate) lines.push(`Roof: ${p.roofAreaEstimate.toLocaleString()} sqft`);
    if (p.constructionYear) lines.push(`Built: ${p.constructionYear}`);
    if (p.roofMaterialEstimate) lines.push(`Material: ${p.roofMaterialEstimate}`);
    if (p.stormExposure) {
      lines.push(`Storm: ${p.stormExposure.stormType}`);
      if (p.stormExposure.hailSizeInches) lines.push(`Hail: ${p.stormExposure.hailSizeInches}″`);
      if (p.stormExposure.windSpeedMph) lines.push(`Wind: ${p.stormExposure.windSpeedMph} mph`);
    }
    if (p.ownerName) lines.push(`Owner: ${p.ownerName}`);
    const statusMeta = TARGETING_STATUS_META[p.targetingStatus];
    lines.push(`Status: ${statusMeta?.label || p.targetingStatus}`);
    return lines.join('<br>');
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. Dashboard Metrics
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compute dashboard metrics from a list of parcels.
   */
  computeMetrics(parcels: ParcelRecord[]): ParcelDashboardMetrics {
    const byProb: Record<DamageProbability, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byStatus: Record<string, number> = {};
    const byStorm: Record<string, number> = {};
    let totalScore = 0;
    let analyzed = 0;
    let targeted = 0;
    let leads = 0;
    let converted = 0;

    for (const p of parcels) {
      if (p.roofDamageProbability) byProb[p.roofDamageProbability]++;
      byStatus[p.targetingStatus] = (byStatus[p.targetingStatus] || 0) + 1;
      if (p.stormExposure) {
        byStorm[p.stormExposure.stormType] = (byStorm[p.stormExposure.stormType] || 0) + 1;
      }
      totalScore += p.roofDamageScore || 0;
      if (p.targetingStatus !== 'unanalyzed') analyzed++;
      if (p.targetingStatus === 'targeted' || TARGETING_STATUS_META[p.targetingStatus]?.order >= 2) targeted++;
      if (p.targetingStatus === 'lead_created' || TARGETING_STATUS_META[p.targetingStatus]?.order >= 5) leads++;
      if (p.targetingStatus === 'converted') converted++;
    }

    return {
      parcelsAnalyzed: analyzed,
      parcelsTargeted: targeted,
      leadsGenerated: leads,
      claimsCreated: converted,
      byProbability: byProb,
      byTargetingStatus: byStatus,
      byStormType: byStorm,
      avgDamageScore: parcels.length > 0 ? Math.round(totalScore / parcels.length) : 0,
      conversionRate: leads > 0 ? (converted / leads) * 100 : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. Parcel ↔ RoofAnalysisRecord Bridge
  // ═══════════════════════════════════════════════════════════════

  /**
   * Convert RoofAnalysisRecords into ParcelRecords.
   * This bridges the existing roof intelligence data into the parcel model.
   */
  fromRoofAnalysisRecords(records: RoofAnalysisRecord[]): ParcelRecord[] {
    return records.map(r => ({
      parcelId: r.property_id || r.id,
      propertyAddress: r.address,
      city: r.city,
      state: r.state,
      county: r.county,
      zipCode: r.zip_code,
      latitude: r.latitude,
      longitude: r.longitude,
      buildingArea: null,
      roofAreaEstimate: r.roof_size_sqft,
      constructionYear: null,
      roofMaterialEstimate: r.roof_type,
      stories: null,
      propertyType: null,
      boundaryCoords: null,
      stormExposure: r.storm_event_id ? {
        stormEventId: r.storm_event_id,
        stormType: r.storm_type || 'unknown',
        hailSizeInches: r.hail_size_inches,
        windSpeedMph: r.wind_speed_mph,
        severity: r.damage_label || 'unknown',
        distanceFromEpicenterMiles: null,
        exposureDate: r.created_at,
      } : null,
      roofAnalysisId: r.id,
      roofDamageScore: r.damage_score,
      roofDamageProbability: this.roofEngine.classifyProbability(r.damage_score),
      inspectionPriority: this.roofEngine.computeInspectionPriority(
        this.roofEngine.classifyProbability(r.damage_score)
      ),
      targetingStatus: this.mapOutreachToTargeting(r.outreach_status),
      outreachStatus: r.outreach_status,
      skipTraceStatus: r.skip_trace_status,
      ownerName: r.owner_name,
      ownerPhone: null,
      leadId: null,
      territoryId: r.territory_id,
      territoryName: r.territory_name,
      batchId: r.batch_id,
      createdAt: r.created_at,
    }));
  }

  private mapOutreachToTargeting(outreach: string): ParcelTargetingStatus {
    const map: Record<string, ParcelTargetingStatus> = {
      pending: 'analyzed',
      targeted: 'targeted',
      skip_traced: 'skip_traced',
      queued: 'outreach_queued',
      lead_created: 'lead_created',
      contacted: 'contacted',
      converted: 'converted',
      excluded: 'excluded',
    };
    return map[outreach] || 'analyzed';
  }

  // ═══════════════════════════════════════════════════════════════
  // Private Utilities
  // ═══════════════════════════════════════════════════════════════

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number { return deg * Math.PI / 180; }

  private stormSeverityRank(severity: string): number {
    const ranks: Record<string, number> = {
      low: 1, moderate: 2, high: 3, severe: 4, extreme: 5,
    };
    return ranks[severity?.toLowerCase()] || 0;
  }
}
