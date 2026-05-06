export type RoutingMode =
  | 'zip'
  | 'county'
  | 'state'
  | 'custom'
  | 'hybrid'
  | 'manual'
  | 'round_robin';

export interface LeadRoutingSettings {
  id: string;
  lead_source: string;
  routing_mode: RoutingMode;
  fallback_owner_id: string | null;
  fallback_queue: string;
  is_active: boolean;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LeadRoutingSettingsUpsert {
  lead_source: string;
  routing_mode: RoutingMode;
  fallback_owner_id: string | null;
  fallback_queue: string;
  is_active: boolean;
}

export const ROUTING_MODES: RoutingMode[] = [
  'zip',
  'county',
  'state',
  'custom',
  'hybrid',
  'manual',
  'round_robin',
];

// Lead sources the admin can configure. 'all' is the global default.
export const LEAD_SOURCES = [
  'all',
  'fire',
  'storm',
  'crime',
  'water',
  'roof',
  'manual',
  'import',
];
