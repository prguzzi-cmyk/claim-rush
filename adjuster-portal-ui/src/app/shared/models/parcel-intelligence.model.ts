/**
 * Parcel Intelligence Models
 *
 * Shared types for property targeting within storm impact zones.
 * Integrates with existing RoofAnalysisRecord (roof data),
 * StormEvent (storm data), and ManualLeadIntakeRequest (lead creation).
 *
 * Does NOT duplicate:
 * - RoofAnalysisRecord (roof-specific fields — this references it)
 * - ImpactedProperty (simple storm property — this extends it)
 * - Territory (routing — consumed by lead generation)
 * - Lead (lead creation — produces payloads for existing service)
 */

import { DamageProbability, DAMAGE_PROBABILITY_META } from './roof-opportunity.model';

// ── Parcel Record ──────────────────────────────────────────────

export interface ParcelRecord {
  parcelId: string;
  propertyAddress: string;
  city: string;
  state: string;
  county: string | null;
  zipCode: string;
  latitude: number;
  longitude: number;

  // Building characteristics
  buildingArea: number | null;
  roofAreaEstimate: number | null;
  constructionYear: number | null;
  roofMaterialEstimate: string | null;
  stories: number | null;
  propertyType: string | null;

  // Parcel boundary (GeoJSON polygon coordinates)
  boundaryCoords: [number, number][] | null;

  // Storm exposure (populated by intersection)
  stormExposure: ParcelStormExposure | null;

  // Roof intelligence link (populated when roof analysis exists)
  roofAnalysisId: string | null;
  roofDamageScore: number | null;
  roofDamageProbability: DamageProbability | null;

  // Targeting state
  inspectionPriority: number | null;
  targetingStatus: ParcelTargetingStatus;
  outreachStatus: string;
  skipTraceStatus: string;
  ownerName: string | null;
  ownerPhone: string | null;
  leadId: string | null;

  // Metadata
  territoryId: string | null;
  territoryName: string | null;
  batchId: string | null;
  createdAt: string;
}

// ── Storm Exposure ─────────────────────────────────────────────

export interface ParcelStormExposure {
  stormEventId: string;
  stormType: string;
  hailSizeInches: number | null;
  windSpeedMph: number | null;
  severity: string;
  distanceFromEpicenterMiles: number | null;
  exposureDate: string;
}

// ── Targeting Status ───────────────────────────────────────────

export type ParcelTargetingStatus =
  | 'unanalyzed'
  | 'analyzed'
  | 'targeted'
  | 'skip_traced'
  | 'outreach_queued'
  | 'lead_created'
  | 'contacted'
  | 'converted'
  | 'excluded';

export const TARGETING_STATUS_META: Record<ParcelTargetingStatus, {
  label: string;
  icon: string;
  color: string;
  order: number;
}> = {
  unanalyzed:      { label: 'Unanalyzed',      icon: 'help_outline',       color: '#9e9e9e', order: 0 },
  analyzed:        { label: 'Analyzed',         icon: 'analytics',          color: '#2196f3', order: 1 },
  targeted:        { label: 'Targeted',         icon: 'gps_fixed',          color: '#ff9800', order: 2 },
  skip_traced:     { label: 'Skip Traced',      icon: 'person_search',      color: '#7b1fa2', order: 3 },
  outreach_queued: { label: 'Outreach Queued',  icon: 'schedule_send',      color: '#00838f', order: 4 },
  lead_created:    { label: 'Lead Created',     icon: 'person_add',         color: '#1565c0', order: 5 },
  contacted:       { label: 'Contacted',        icon: 'phone_in_talk',      color: '#e65100', order: 6 },
  converted:       { label: 'Converted',        icon: 'check_circle',       color: '#4caf50', order: 7 },
  excluded:        { label: 'Excluded',         icon: 'block',              color: '#f44336', order: 8 },
};

// ── Targeting Filters ──────────────────────────────────────────

export interface ParcelTargetingFilter {
  stormType: string | null;
  minDamageProbability: DamageProbability | null;
  minRoofSize: number | null;
  maxConstructionYear: number | null;
  territoryId: string | null;
  targetingStatus: ParcelTargetingStatus | null;
  state: string | null;
  county: string | null;
}

export function createEmptyFilter(): ParcelTargetingFilter {
  return {
    stormType: null, minDamageProbability: null, minRoofSize: null,
    maxConstructionYear: null, territoryId: null, targetingStatus: null,
    state: null, county: null,
  };
}

// ── Campaign Export ────────────────────────────────────────────

export type CampaignExportType = 'ai_outreach' | 'sms_campaign' | 'direct_mail' | 'skip_trace';

export interface CampaignExportPayload {
  exportType: CampaignExportType;
  parcelIds: string[];
  totalParcels: number;
  filterApplied: ParcelTargetingFilter;
  createdAt: string;
}

export const CAMPAIGN_EXPORT_META: Record<CampaignExportType, {
  label: string;
  icon: string;
  color: string;
}> = {
  ai_outreach:  { label: 'AI Outreach Queue',   icon: 'smart_toy',    color: '#1565c0' },
  sms_campaign: { label: 'SMS Campaign',         icon: 'sms',          color: '#2e7d32' },
  direct_mail:  { label: 'Direct Mail Campaign', icon: 'mail',         color: '#e65100' },
  skip_trace:   { label: 'Skip Trace Pipeline',  icon: 'person_search', color: '#7b1fa2' },
};

// ── Dashboard Metrics ──────────────────────────────────────────

export interface ParcelDashboardMetrics {
  parcelsAnalyzed: number;
  parcelsTargeted: number;
  leadsGenerated: number;
  claimsCreated: number;
  byProbability: Record<DamageProbability, number>;
  byTargetingStatus: Record<string, number>;
  byStormType: Record<string, number>;
  avgDamageScore: number;
  conversionRate: number;
}

// ── Map Layer Data ─────────────────────────────────────────────

export interface ParcelMapFeature {
  parcelId: string;
  latitude: number;
  longitude: number;
  boundaryCoords: [number, number][] | null;
  markerColor: string;
  fillColor: string;
  fillOpacity: number;
  probability: DamageProbability | null;
  damageScore: number;
  tooltipHtml: string;
}
