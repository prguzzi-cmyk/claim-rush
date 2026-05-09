import { Injectable } from '@angular/core';

/**
 * Single source of truth for incident priority classification across
 * the Global Intelligence Command Center. KPI counts, ticker, map,
 * and the right-side live feed all read priority from this service so
 * the dashboard never regresses into raw PulsePoint dispatch noise.
 *
 * Add new call-type rules here ONLY. If a surface starts classifying
 * inline, that surface is wrong.
 */

export type IncidentPriority = 'high' | 'medium' | 'low' | 'unknown';

export interface PrioritizedIncident {
  /** Original raw type / call_type / event_type as provided by upstream. */
  type?: string;
  /** Optional richer description (e.g. "Structure Fire", "Lift Assist"). */
  call_type?: string;
  call_type_description?: string;
  /** Title and detail from PlatformActivity events. */
  title?: string;
  detail?: string;
  peril?: string;
  /** Stamped priority — set by IncidentPriorityService.tag(). */
  priority?: IncidentPriority;
}

// ── Rule tables ───────────────────────────────────────────────────
//
// Tested against lower-cased text by `priorityFor`. Order matters
// inside a tier (more specific first), but tiers are checked in
// HIGH → MEDIUM → LOW order.

const HIGH_RULES: Array<RegExp> = [
  /\bstructure fire\b/,
  /\bcommercial fire\b/,
  /\bresidential fire\b/,
  /\bworking fire\b/,
  /\bbuilding fire\b/,
  /\bvehicle fire\b/,         // can damage adjacent property
  /\bwildland\b/,
  /\bbrush fire\b/,
  /\bgrass fire\b/,
];

const MEDIUM_RULES: Array<RegExp> = [
  /\bsmoke investigation\b/,
  /\bsmoke (check|odor|scare)\b/,
  /\bfire alarm\b/,
  /\balarm[: -]*fire\b/,
  /\bgas leak\b/,
  /\bhazmat\b/,
];

const LOW_RULES: Array<RegExp> = [
  /\bmedical( emergency)?\b/,
  /\blift assist\b/,
  /\btraffic collision\b/,
  /\b(mva|motor vehicle accident)\b/,
  /\bvehicle (?:accident|crash)\b/,
  /\bcarbon monoxide\b/,
  /\b\bco\b alarm\b/,
  /\bpublic (service|assist)\b/,
  /\balarm system\b/,
  /\bsystem (alarm|trouble)\b/,
  /\bgeneral alarm\b/,
  /\bautomatic alarm\b/,        // fire panel auto-alarms (mostly nuisance)
  /\bems\b/,
  /\bmutual aid\b/,
  /\bcancelled\b/,
  /\bfalse alarm\b/,
  /\binvestigation\b(?! .*fire)/, // bare "investigation" without fire context
  /\bservice call\b/,
];

// Some perils are non-fire incident sources (storm, crime, etc.) — they
// pass through the same gate so map/ticker/feed share one filter.
const STORM_HIGH_RULES = [/\b(hurricane|tornado)\b/];
const STORM_MEDIUM_RULES = [/\b(hail|wind|lightning)\b/];

// Crime is medium by default — break-ins are property loss but not life-safety.
const CRIME_MEDIUM_RULES = [/\b(burglary|theft|vandalism|break.?in)\b/];


@Injectable({ providedIn: 'root' })
export class IncidentPriorityService {

  /**
   * Compute the priority tier for an incident based on whatever
   * fields are populated. Falls through HIGH → MEDIUM → LOW; defaults
   * to `unknown` when no rule matches (rendered as low-priority).
   */
  priorityFor(incident: PrioritizedIncident | null | undefined): IncidentPriority {
    if (!incident) return 'unknown';

    const text = this.normalizeText(incident);
    if (!text) return 'unknown';

    if (HIGH_RULES.some(r => r.test(text)))         return 'high';
    if (STORM_HIGH_RULES.some(r => r.test(text)))   return 'high';

    if (MEDIUM_RULES.some(r => r.test(text)))       return 'medium';
    if (STORM_MEDIUM_RULES.some(r => r.test(text))) return 'medium';
    if (CRIME_MEDIUM_RULES.some(r => r.test(text))) return 'medium';

    if (LOW_RULES.some(r => r.test(text)))          return 'low';

    // Bare `type === 'fire'` from upstream — treat as HIGH only when
    // there's no contradicting noise text. (IncidentFeedService used to
    // stamp every PulsePoint row as `type: 'fire'` regardless of the
    // real call_type. With this fall-through, only rows that survive
    // the LOW filter above end up classified HIGH.)
    if ((incident.type || '').toLowerCase() === 'fire') return 'high';

    return 'unknown';
  }

  /** Mutate-and-return: stamp `priority` on the incident. */
  tag<T extends PrioritizedIncident>(incident: T): T {
    incident.priority = this.priorityFor(incident);
    return incident;
  }

  /** Bulk tag. */
  tagAll<T extends PrioritizedIncident>(items: T[]): T[] {
    if (!Array.isArray(items)) return items;
    for (const it of items) this.tag(it);
    return items;
  }

  /** Filter a list down to whichever priority tiers are enabled. */
  filterByPriority<T extends PrioritizedIncident>(
    items: T[],
    enabled: { high?: boolean; medium?: boolean; low?: boolean; unknown?: boolean },
  ): T[] {
    if (!Array.isArray(items)) return [];
    const include = (p: IncidentPriority) => {
      if (p === 'high'    && enabled.high)    return true;
      if (p === 'medium'  && enabled.medium)  return true;
      if (p === 'low'     && enabled.low)     return true;
      if (p === 'unknown' && enabled.low)     return true;  // unknown rides with LOW
      return false;
    };
    return items.filter(it => include(it.priority || this.priorityFor(it)));
  }

  /** Color for a priority tier — Bloomberg-dark palette. */
  colorFor(priority: IncidentPriority | undefined): string {
    switch (priority) {
      case 'high':   return '#ff1744';  // accent-red — life-safety property loss
      case 'medium': return '#ff6d00';  // accent-orange — investigate
      case 'low':    return '#64748b';  // text-muted — dispatch noise
      default:       return '#64748b';
    }
  }

  /** Display label. */
  labelFor(priority: IncidentPriority | undefined): string {
    switch (priority) {
      case 'high':   return 'High';
      case 'medium': return 'Medium';
      case 'low':    return 'Low';
      default:       return 'Unknown';
    }
  }

  // ── internals ────────────────────────────────────────────────────
  private normalizeText(incident: PrioritizedIncident): string {
    const parts = [
      incident.call_type_description,
      incident.call_type,
      incident.peril,
      incident.title,
      incident.detail,
      incident.type,
    ].filter(Boolean);
    return parts.join(' | ').toLowerCase();
  }
}
