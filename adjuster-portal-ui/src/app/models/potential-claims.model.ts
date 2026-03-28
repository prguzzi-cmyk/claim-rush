export type ClaimEventType = 'hail' | 'wind' | 'lightning' | 'tornado' | 'flooding' | 'fire';
export type ClaimSeverity = 'critical' | 'high' | 'moderate' | 'monitor';
export type ClaimPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface PredictedClaimEvent {
  id: string;
  event_type: string;
  city: string;
  state: string;
  county: string;
  timestamp: Date;
  severity: ClaimSeverity;
  claim_probability: number;
  description: string;
  source: string;
}

export interface PredictedClaimZone {
  id: string;
  name: string;
  event_type: string;
  center: [number, number];
  radius_meters: number;
  severity: ClaimSeverity;
  priority: ClaimPriority;
  claim_probability: number;
  estimated_homes_affected: number;
  affected_zips: string[];
  county: string;
  state: string;
  linked_property_ids: string[];
  timestamp: Date;
  active: boolean;
  auto_lead_generated?: boolean;
}

export interface ClaimTickerMessage {
  id: string;
  text: string;
  severity: ClaimSeverity;
  timestamp: Date;
}
