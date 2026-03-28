import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TerritoryService } from './territory.service';
import { TerritoryWithAssignments } from '../models/territory.model';
import {
  StateControlRow,
  CountyControlRow,
  StateCpStatus,
  CountyAgentStatus,
  TerritoryControlOverrides,
} from '../models/territory-control.model';

const OVERRIDES_KEY = 'territory_control_overrides';

@Injectable({
  providedIn: 'root',
})
export class TerritoryControlService {

  constructor(private territoryService: TerritoryService) {}

  private getOverrides(): TerritoryControlOverrides {
    try {
      return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}');
    } catch {
      return {};
    }
  }

  private saveOverrides(overrides: TerritoryControlOverrides): void {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  }

  buildStateRow(t: TerritoryWithAssignments): StateControlRow {
    const overrides = this.getOverrides();
    const o = overrides[t.id] || {};
    const derivedStatus = this.deriveStateCpStatus(t);
    const cpName = t.chapter_president
      ? `${t.chapter_president.first_name} ${t.chapter_president.last_name}`
      : null;
    return {
      id: t.id,
      name: t.name,
      state: t.state || '',
      is_active: t.is_active !== false,
      chapter_president_name: cpName,
      cp_status: o.cp_status_override || derivedStatus,
      notes: o.notes || '',
      allow_cp_applications: o.allow_cp_applications !== undefined ? o.allow_cp_applications : true,
    };
  }

  buildCountyRow(t: TerritoryWithAssignments): CountyControlRow {
    const overrides = this.getOverrides();
    const o = overrides[t.id] || {};
    const derivedStatus = this.deriveCountyAgentStatus(t);
    return {
      id: t.id,
      name: t.name,
      state: t.state || '',
      county: t.county || '',
      is_active: t.is_active !== false,
      max_adjusters: t.max_adjusters || 0,
      adjuster_count: t.adjuster_count || 0,
      agent_status: o.agent_status_override || derivedStatus,
      notes: o.notes || '',
      allow_agent_applications: o.allow_agent_applications !== undefined ? o.allow_agent_applications : true,
      lead_fire_enabled: t.lead_fire_enabled !== undefined ? t.lead_fire_enabled : true,
      lead_hail_enabled: t.lead_hail_enabled !== undefined ? t.lead_hail_enabled : true,
      lead_storm_enabled: t.lead_storm_enabled !== undefined ? t.lead_storm_enabled : true,
      lead_lightning_enabled: t.lead_lightning_enabled !== undefined ? t.lead_lightning_enabled : false,
      lead_flood_enabled: t.lead_flood_enabled !== undefined ? t.lead_flood_enabled : true,
      lead_theft_vandalism_enabled: t.lead_theft_vandalism_enabled !== undefined ? t.lead_theft_vandalism_enabled : true,
    };
  }

  private deriveStateCpStatus(t: TerritoryWithAssignments): StateCpStatus {
    if (!t.is_active) return 'locked';
    if (t.chapter_president) return 'assigned';
    return 'available';
  }

  private deriveCountyAgentStatus(t: TerritoryWithAssignments): CountyAgentStatus {
    if (!t.is_active) return 'locked';
    const max = t.max_adjusters || 0;
    const count = t.adjuster_count || 0;
    if (max > 0 && count >= max) return 'full';
    return 'open';
  }

  getStateRows(): Observable<StateControlRow[]> {
    return this.territoryService.getTerritoriesWithAssignments().pipe(
      map((territories) => {
        const overrides = this.getOverrides();
        return territories
          .filter((t) => t.territory_type === 'state')
          .map((t) => {
            const o = overrides[t.id] || {};
            const derivedStatus = this.deriveStateCpStatus(t);
            const cpName = t.chapter_president
              ? `${t.chapter_president.first_name} ${t.chapter_president.last_name}`
              : null;
            return {
              id: t.id,
              name: t.name,
              state: t.state || '',
              is_active: t.is_active !== false,
              chapter_president_name: cpName,
              cp_status: o.cp_status_override || derivedStatus,
              notes: o.notes || '',
              allow_cp_applications: o.allow_cp_applications !== undefined ? o.allow_cp_applications : true,
            } as StateControlRow;
          });
      })
    );
  }

  getCountyRows(): Observable<CountyControlRow[]> {
    return this.territoryService.getTerritoriesWithAssignments().pipe(
      map((territories) => {
        const overrides = this.getOverrides();
        return territories
          .filter((t) => t.territory_type === 'county')
          .map((t) => {
            const o = overrides[t.id] || {};
            const derivedStatus = this.deriveCountyAgentStatus(t);
            return {
              id: t.id,
              name: t.name,
              state: t.state || '',
              county: t.county || '',
              is_active: t.is_active !== false,
              max_adjusters: t.max_adjusters || 0,
              adjuster_count: t.adjuster_count || 0,
              agent_status: o.agent_status_override || derivedStatus,
              notes: o.notes || '',
              allow_agent_applications: o.allow_agent_applications !== undefined ? o.allow_agent_applications : true,
              lead_fire_enabled: t.lead_fire_enabled !== undefined ? t.lead_fire_enabled : true,
              lead_hail_enabled: t.lead_hail_enabled !== undefined ? t.lead_hail_enabled : true,
              lead_storm_enabled: t.lead_storm_enabled !== undefined ? t.lead_storm_enabled : true,
              lead_lightning_enabled: t.lead_lightning_enabled !== undefined ? t.lead_lightning_enabled : false,
              lead_flood_enabled: t.lead_flood_enabled !== undefined ? t.lead_flood_enabled : true,
              lead_theft_vandalism_enabled: t.lead_theft_vandalism_enabled !== undefined ? t.lead_theft_vandalism_enabled : true,
            } as CountyControlRow;
          });
      })
    );
  }

  saveStateRow(row: StateControlRow): Observable<any> {
    const overrides = this.getOverrides();
    overrides[row.id] = {
      ...overrides[row.id],
      notes: row.notes,
      cp_status_override: row.cp_status,
      allow_cp_applications: row.allow_cp_applications,
    };

    // Clear override if it matches derived status (let backend drive it)
    if (row.cp_status === 'locked' || row.cp_status === 'available' || row.cp_status === 'assigned') {
      delete overrides[row.id].cp_status_override;
    }

    this.saveOverrides(overrides);

    // Map status to backend fields
    const is_active = row.cp_status !== 'locked';

    const territory: any = {
      id: row.id,
      is_active,
    };

    return this.territoryService.updateTerritory(territory);
  }

  saveCountyRow(row: CountyControlRow): Observable<any> {
    const overrides = this.getOverrides();
    overrides[row.id] = {
      ...overrides[row.id],
      notes: row.notes,
      agent_status_override: row.agent_status,
      allow_agent_applications: row.allow_agent_applications,
    };

    // Clear override if it matches derived status
    if (row.agent_status === 'locked' || row.agent_status === 'open' || row.agent_status === 'full') {
      delete overrides[row.id].agent_status_override;
    }

    this.saveOverrides(overrides);

    // Map status to backend fields
    const is_active = row.agent_status !== 'locked';

    const territory: any = {
      id: row.id,
      is_active,
      max_adjusters: row.max_adjusters,
      lead_fire_enabled: row.lead_fire_enabled,
      lead_hail_enabled: row.lead_hail_enabled,
      lead_storm_enabled: row.lead_storm_enabled,
      lead_lightning_enabled: row.lead_lightning_enabled,
      lead_flood_enabled: row.lead_flood_enabled,
      lead_theft_vandalism_enabled: row.lead_theft_vandalism_enabled,
    };

    return this.territoryService.updateTerritory(territory);
  }
}
