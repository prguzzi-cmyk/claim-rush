import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

import { RotationLeadService } from 'src/app/services/rotation-lead.service';
import { LeadDistributionService } from 'src/app/services/lead-distribution.service';
import { TerritoryService } from 'src/app/services/territory.service';
import { TerritoryWithAssignments } from 'src/app/models/territory.model';
import {
  RotationLead,
  RotationConfig,
  AgentBreakdown,
  AgentAvailability,
  AgentPerformanceWeight,
  EligibleAgent,
  ResponseTimerThreshold,
  DEFAULT_RESPONSE_THRESHOLDS,
  LeadResponseTimerState,
  LeadSource,
  LEAD_SOURCE_META,
  LeadSourceRoutingRule,
} from 'src/app/models/rotation-lead.model';
import {
  TerritoryRotationState,
} from 'src/app/models/lead-distribution.model';

/**
 * LeadRotationEngine
 *
 * Central orchestration service for lead assignment.
 * Ties together territory routing, availability checks, fair rotation,
 * performance weighting, and response time monitoring.
 *
 * Integrates with (does NOT duplicate):
 * - RotationLeadService (CRUD operations, contact attempts, reassignment)
 * - LeadDistributionService (distribute, history, rotation state)
 * - TerritoryService (territory data, user assignments)
 * - Existing RotationConfig (timeout/attempts/auto-reassign settings)
 *
 * The engine provides pure computation + orchestration.
 * All HTTP calls are delegated to the existing services.
 */
@Injectable({ providedIn: 'root' })
export class LeadRotationEngineService {

  constructor(
    private rotationLeadService: RotationLeadService,
    private distributionService: LeadDistributionService,
    private territoryService: TerritoryService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. Territory Routing
  // ═══════════════════════════════════════════════════════════════

  /**
   * Find the matching territory for a lead based on state, county, and ZIP.
   * Returns the best match from the territories-with-assignments list.
   */
  findMatchingTerritory(
    territories: TerritoryWithAssignments[],
    state: string,
    county?: string,
    zip?: string,
  ): TerritoryWithAssignments | null {
    if (!state) return null;
    const normalState = state.trim().toUpperCase();

    // Priority: ZIP > county > state
    if (zip) {
      const zipMatch = territories.find(
        t => t.zip_code === zip && t.is_active
      );
      if (zipMatch) return zipMatch;
    }

    if (county) {
      const normalCounty = county.trim().toLowerCase();
      const countyMatch = territories.find(
        t => t.state?.toUpperCase() === normalState
          && t.county?.toLowerCase() === normalCounty
          && t.is_active
      );
      if (countyMatch) return countyMatch;
    }

    // State-level fallback
    const stateMatch = territories.find(
      t => t.state?.toUpperCase() === normalState
        && !t.county && !t.zip_code
        && t.is_active
    );
    return stateMatch || null;
  }

  /**
   * Check if a territory supports the given lead/incident type.
   */
  territorySupportsLeadType(territory: TerritoryWithAssignments, incidentType: string): boolean {
    const type = (incidentType || '').toLowerCase();
    if (type.includes('fire'))      return territory.lead_fire_enabled !== false;
    if (type.includes('hail'))      return territory.lead_hail_enabled !== false;
    if (type.includes('storm'))     return territory.lead_storm_enabled !== false;
    if (type.includes('lightning')) return territory.lead_lightning_enabled !== false;
    if (type.includes('flood'))     return territory.lead_flood_enabled !== false;
    if (type.includes('theft') || type.includes('vandalism'))
      return territory.lead_theft_vandalism_enabled !== false;
    // Default: allow if no specific flag
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Availability Checks
  // ═══════════════════════════════════════════════════════════════

  /**
   * Filter agents to only those who are eligible to receive a lead.
   * Checks: active, accepting leads, within daily limit, in territory.
   */
  filterEligibleAgents(
    agents: AgentAvailability[],
    territoryId: string,
  ): AgentAvailability[] {
    return agents.filter(a =>
      a.isActive
      && a.isAcceptingLeads
      && a.leadsAssignedToday < a.dailyLeadLimit
      && (a.nationalAccess || a.territories.includes(territoryId))
    );
  }

  /**
   * Build availability profiles from territory assignment data and metrics.
   * This maps the raw territory/agent data into the structured availability model.
   */
  buildAvailabilityProfiles(
    territory: TerritoryWithAssignments,
    agentMetrics: AgentBreakdown[],
    dailyLeadLimit: number = 10,
  ): AgentAvailability[] {
    const adjusters = territory.adjusters || territory.assigned_users || [];
    return adjusters.map(user => {
      const metrics = agentMetrics.find(m => m.agent_id === user.user_id);
      return {
        agentId: user.user_id,
        agentName: `${user.first_name} ${user.last_name}`.trim(),
        isActive: true,
        isAcceptingLeads: true,
        dailyLeadLimit,
        leadsAssignedToday: metrics?.leads_assigned || 0,
        territories: [territory.id],
        nationalAccess: false,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Fair Rotation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Select the next agent using round-robin rotation with the existing
   * rotation state (last_assigned_agent_id, rotation_index).
   *
   * Returns the chosen agent and the new rotation index.
   */
  selectNextAgent(
    eligible: EligibleAgent[],
    rotationState: TerritoryRotationState | null,
  ): { agent: EligibleAgent; newIndex: number } | null {
    if (eligible.length === 0) return null;

    const lastId = rotationState?.last_assigned_agent_id;
    let startIndex = 0;

    if (lastId) {
      const lastIdx = eligible.findIndex(a => a.agentId === lastId);
      if (lastIdx >= 0) {
        startIndex = (lastIdx + 1) % eligible.length;
      }
    }

    const agent = eligible[startIndex];
    return { agent, newIndex: startIndex };
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. Performance Weighting
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compute performance weights for agents from their metrics.
   * Produces a composite score (0-100) used to sort eligible agents
   * so higher-performing agents get slight priority in rotation.
   *
   * Weighting formula:
   *   40% closing rate + 30% response speed + 30% satisfaction
   *
   * The rotation still cycles fairly — weighting only affects the
   * ordering of equally-positioned agents in the rotation queue.
   */
  computePerformanceWeights(
    agentMetrics: AgentBreakdown[],
  ): AgentPerformanceWeight[] {
    if (agentMetrics.length === 0) return [];

    // Normalize each metric to 0-100 range
    const maxSigned = Math.max(...agentMetrics.map(m => m.leads_signed), 1);
    const maxAssigned = Math.max(...agentMetrics.map(m => m.leads_assigned), 1);

    return agentMetrics.map(m => {
      const closingRate = m.leads_assigned > 0
        ? (m.leads_signed / m.leads_assigned) * 100
        : 0;

      // Invert response hours: lower is better. Cap at 48h.
      const responseScore = m.avg_response_hours != null
        ? Math.max(0, 100 - (m.avg_response_hours / 48) * 100)
        : 50; // default mid-range if no data

      // Client satisfaction: placeholder score (future data source)
      const satisfaction = 70; // default until real data is available

      const compositeScore =
        closingRate * 0.4 +
        responseScore * 0.3 +
        satisfaction * 0.3;

      return {
        agentId: m.agent_id,
        closingRate,
        avgResponseHours: m.avg_response_hours || 0,
        clientSatisfaction: satisfaction,
        compositeScore: Math.round(compositeScore * 10) / 10,
      };
    });
  }

  /**
   * Build the eligible agent list with weights applied.
   * Agents are sorted by composite score (descending) so the rotation
   * naturally favors higher performers while still cycling through all.
   */
  buildWeightedEligibleList(
    available: AgentAvailability[],
    weights: AgentPerformanceWeight[],
  ): EligibleAgent[] {
    const weightMap = new Map(weights.map(w => [w.agentId, w.compositeScore]));

    return available
      .map(a => ({
        agentId: a.agentId,
        agentName: a.agentName,
        weight: weightMap.get(a.agentId) || 50,
        lastAssignedAt: null,
        leadsToday: a.leadsAssignedToday,
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Response Time Monitoring
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compute the response timer state for an assigned lead.
   * Determines how long since assignment and what the next action should be.
   */
  computeResponseTimerState(
    lead: RotationLead,
    thresholds: ResponseTimerThreshold[] = DEFAULT_RESPONSE_THRESHOLDS,
  ): LeadResponseTimerState | null {
    if (!lead.assigned_agent_id || !lead.assignment_date) return null;
    if (lead.contact_attempt_count > 0) return null; // Agent already responded

    const assignedAt = new Date(lead.assignment_date);
    const now = new Date();
    const minutesSince = Math.floor((now.getTime() - assignedAt.getTime()) / (1000 * 60));

    // Find the current threshold index
    let currentIdx = -1;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (minutesSince >= thresholds[i].minutesAfterAssignment) {
        currentIdx = i;
        break;
      }
    }

    const nextThreshold = currentIdx < thresholds.length - 1
      ? thresholds[currentIdx + 1]
      : null;

    return {
      leadId: lead.id,
      assignedAgentId: lead.assigned_agent_id,
      assignedAt: lead.assignment_date,
      minutesSinceAssignment: minutesSince,
      currentThresholdIndex: currentIdx,
      nextAction: nextThreshold,
      isOverdue: currentIdx >= 0,
    };
  }

  /**
   * Get all leads that have breached a response threshold.
   * Returns leads grouped by the action that should be taken.
   */
  getOverdueLeads(
    leads: RotationLead[],
    thresholds: ResponseTimerThreshold[] = DEFAULT_RESPONSE_THRESHOLDS,
  ): Map<string, { lead: RotationLead; timer: LeadResponseTimerState }[]> {
    const grouped = new Map<string, { lead: RotationLead; timer: LeadResponseTimerState }[]>();

    for (const lead of leads) {
      const timer = this.computeResponseTimerState(lead, thresholds);
      if (!timer || !timer.isOverdue) continue;

      const threshold = thresholds[timer.currentThresholdIndex];
      const action = threshold.action;
      if (!grouped.has(action)) grouped.set(action, []);
      grouped.get(action)!.push({ lead, timer });
    }

    return grouped;
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Lead Source Awareness
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get routing priority for a lead source. Lower = higher priority.
   */
  getSourcePriority(source: string): number {
    const normalized = (source || '').toLowerCase().replace(/[\s-]+/g, '_') as LeadSource;
    return LEAD_SOURCE_META[normalized]?.priority || 99;
  }

  /**
   * Sort leads by source priority so higher-priority leads are processed first.
   */
  sortBySourcePriority(leads: RotationLead[]): RotationLead[] {
    return [...leads].sort((a, b) =>
      this.getSourcePriority(a.lead_source) - this.getSourcePriority(b.lead_source)
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. Full Rotation Orchestration
  // ═══════════════════════════════════════════════════════════════

  /**
   * Execute the full rotation algorithm for a single lead.
   *
   * Steps:
   * 1. Find matching territory by state/county/zip
   * 2. Verify territory supports the lead/incident type
   * 3. Get agents assigned to the territory
   * 4. Filter by availability (active, accepting, daily limit)
   * 5. Apply performance weighting
   * 6. Select next agent via round-robin rotation
   * 7. Return the assignment decision
   *
   * This is a pure computation — the caller must execute the actual
   * assignment via RotationLeadService or LeadDistributionService.
   */
  computeAssignment(
    lead: RotationLead,
    territories: TerritoryWithAssignments[],
    agentMetrics: AgentBreakdown[],
    rotationState: TerritoryRotationState | null,
    dailyLeadLimit: number = 10,
  ): RotationDecision {
    // Step 1: Territory match
    const territory = this.findMatchingTerritory(
      territories, lead.property_state, undefined, lead.property_zip
    );
    if (!territory) {
      return {
        success: false,
        reason: `No active territory found for ${lead.property_state} / ${lead.property_zip}`,
        leadId: lead.id,
        territoryId: null,
        assignedAgentId: null,
        assignedAgentName: null,
        newRotationIndex: null,
      };
    }

    // Step 2: Lead type check
    if (!this.territorySupportsLeadType(territory, lead.incident_type)) {
      return {
        success: false,
        reason: `Territory "${territory.name}" does not accept ${lead.incident_type} leads`,
        leadId: lead.id,
        territoryId: territory.id,
        assignedAgentId: null,
        assignedAgentName: null,
        newRotationIndex: null,
      };
    }

    // Step 3-4: Build availability and filter
    const profiles = this.buildAvailabilityProfiles(territory, agentMetrics, dailyLeadLimit);
    const eligible = this.filterEligibleAgents(profiles, territory.id);
    if (eligible.length === 0) {
      return {
        success: false,
        reason: `No eligible agents available in territory "${territory.name}"`,
        leadId: lead.id,
        territoryId: territory.id,
        assignedAgentId: null,
        assignedAgentName: null,
        newRotationIndex: null,
      };
    }

    // Step 5: Performance weighting
    const weights = this.computePerformanceWeights(agentMetrics);
    const weightedList = this.buildWeightedEligibleList(eligible, weights);

    // Step 6: Round-robin selection
    const selection = this.selectNextAgent(weightedList, rotationState);
    if (!selection) {
      return {
        success: false,
        reason: 'Rotation selection failed — no agents available',
        leadId: lead.id,
        territoryId: territory.id,
        assignedAgentId: null,
        assignedAgentName: null,
        newRotationIndex: null,
      };
    }

    return {
      success: true,
      reason: null,
      leadId: lead.id,
      territoryId: territory.id,
      assignedAgentId: selection.agent.agentId,
      assignedAgentName: selection.agent.agentName,
      newRotationIndex: selection.newIndex,
    };
  }
}

/** Result of the rotation algorithm. */
export interface RotationDecision {
  success: boolean;
  reason: string | null;
  leadId: string;
  territoryId: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  newRotationIndex: number | null;
}
