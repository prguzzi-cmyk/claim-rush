export type StormEventType = 'hail' | 'wind' | 'hurricane' | 'lightning' | 'tornado';
export type SeverityLevel = 'low' | 'moderate' | 'high' | 'severe' | 'extreme';

export interface StormEvent {
  id: string;
  event_type: StormEventType;
  title: string;
  description: string;
  severity: SeverityLevel;
  latitude: number;
  longitude: number;
  radius_miles: number;
  state: string;
  county: string;
  zip_codes: string[];
  reported_at: Date;
  expires_at: Date;
  source: string;

  // Hail-specific
  hail_size_inches?: number;

  // Wind-specific
  wind_speed_mph?: number;
  gust_speed_mph?: number;

  // Hurricane-specific
  hurricane_category?: number;
  hurricane_name?: string;
  track_points?: { lat: number; lng: number }[];

  // Lightning-specific
  strike_count?: number;
}

export interface StormTargetArea {
  id: string;
  rank: number;
  county: string;
  state: string;
  zip_codes: string[];
  primary_event_type: StormEventType;
  severity: SeverityLevel;
  event_count: number;
  affected_area_sq_miles: number;
  estimated_properties: number;
  risk_score: number; // 0-100
  events: StormEvent[];
}

export interface StormKpiSummary {
  hail_risk_areas: number;
  wind_damage_alerts: number;
  hurricane_impact_zones: number;
  lightning_clusters: number;
  total_events: number;
  last_updated: Date;
}

export interface StormFilterState {
  dateRange: '24h' | '3d' | '7d' | '30d';
  eventTypes: StormEventType[];
  state: string;
  county: string;
  minSeverity: SeverityLevel | '';
}

export interface ZipBoundaryFeature {
  type: 'Feature';
  properties: {
    GEOID: string;
    BASENAME?: string;
    AREALAND?: number;
    AREAWATER?: number;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface ZipBoundaryCollection {
  type: 'FeatureCollection';
  features: ZipBoundaryFeature[];
}

export interface ImpactedProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  property_type: string;
}

export interface RoofAnalysisResult {
  property_id: string;
  damage_score: number;
  damage_label: 'none' | 'low' | 'moderate' | 'high' | 'severe';
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  indicators: string[];
  image_url: string | null;
  error: string | null;
}

export interface RoofAnalysisResponse {
  results: RoofAnalysisResult[];
  total: number;
  analyzed: number;
  failed: number;
}

export interface OutreachBatchPayload {
  target_area_id: string;
  county: string;
  state: string;
  zip_codes: string[];
  event_type: StormEventType;
  severity: SeverityLevel;
  estimated_properties: number;
  risk_score: number;
  created_at: Date;
  created_by: string;
}

export interface OutreachTarget {
  property: ImpactedProperty;
  analysis: RoofAnalysisResult;
  emailDraft: string;
  textDraft: string;
  callScript: string;
}

export interface OutreachPack {
  stormEvent: StormEvent;
  generatedAt: Date;
  targets: OutreachTarget[];
  totalProperties: number;
  analyzedProperties: number;
  qualifiedTargets: number;
}
