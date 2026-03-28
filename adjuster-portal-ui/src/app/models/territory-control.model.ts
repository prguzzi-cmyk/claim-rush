export type StateCpStatus = 'available' | 'reserved' | 'assigned' | 'locked';
export type CountyAgentStatus = 'open' | 'recruiting' | 'full' | 'locked';

export interface StateControlRow {
  id: string;
  name: string;
  state: string;
  is_active: boolean;
  chapter_president_name: string | null;
  cp_status: StateCpStatus;
  notes: string;
  allow_cp_applications: boolean;
}

export interface CountyControlRow {
  id: string;
  name: string;
  state: string;
  county: string;
  is_active: boolean;
  max_adjusters: number;
  adjuster_count: number;
  agent_status: CountyAgentStatus;
  notes: string;
  allow_agent_applications: boolean;
  lead_fire_enabled: boolean;
  lead_hail_enabled: boolean;
  lead_storm_enabled: boolean;
  lead_lightning_enabled: boolean;
  lead_flood_enabled: boolean;
  lead_theft_vandalism_enabled: boolean;
}

export interface TerritoryControlOverrides {
  [territoryId: string]: {
    notes?: string;
    cp_status_override?: StateCpStatus;
    agent_status_override?: CountyAgentStatus;
    allow_cp_applications?: boolean;
    allow_agent_applications?: boolean;
  };
}
