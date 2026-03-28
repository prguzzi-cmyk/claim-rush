/**
 * Lead Priority AI Scoring Models
 *
 * Ranks incoming leads by claim probability and potential value.
 * Integrates with Lead Rotation Engine for priority-based distribution.
 */

export type PriorityGroup = 'A' | 'B' | 'C';

export const PRIORITY_META: Record<PriorityGroup, {
  label: string;
  color: string;
  bgColor: string;
  minScore: number;
}> = {
  A: { label: 'Priority A', color: '#c62828', bgColor: '#fce4ec', minScore: 80 },
  B: { label: 'Priority B', color: '#e65100', bgColor: '#fff3e0', minScore: 50 },
  C: { label: 'Priority C', color: '#757575', bgColor: '#f5f5f5', minScore: 0 },
};

export interface LeadScore {
  leadId: string;
  score: number;
  priority: PriorityGroup;
  factors: ScoreFactor[];
  computedAt: string;
}

export interface ScoreFactor {
  name: string;
  weight: number;
  rawValue: number;
  points: number;
}

export interface LeadScoringInput {
  propertyValue: number | null;
  incidentType: string | null;
  responseCount: number;
  state: string | null;
  daysSinceIncident: number | null;
  hasPhone: boolean;
  hasEmail: boolean;
  roofAge: number | null;
  stormSeverity: string | null;
}

export interface PrioritySummary {
  priorityA: number;
  priorityB: number;
  priorityC: number;
  total: number;
}
