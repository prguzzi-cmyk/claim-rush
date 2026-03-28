import { Injectable } from '@angular/core';
import {
  LeadScore, LeadScoringInput, ScoreFactor, PriorityGroup, PrioritySummary, PRIORITY_META,
} from '../models/lead-priority.model';
import { RotationLead } from 'src/app/models/rotation-lead.model';

/**
 * LeadPriorityEngine
 *
 * Pure scoring engine — no HTTP calls.
 * Computes a 0-100 score and priority group for each lead.
 *
 * Scoring weights:
 *   Property value: 25 points
 *   Incident type:  20 points
 *   Response activity: 15 points
 *   Location: 15 points
 *   Recency: 15 points
 *   Contact quality: 10 points
 */
@Injectable({ providedIn: 'root' })
export class LeadPriorityEngineService {

  // ── Scoring ──

  computeScore(input: LeadScoringInput): LeadScore {
    const factors: ScoreFactor[] = [
      this.scorePropertyValue(input.propertyValue),
      this.scoreIncidentType(input.incidentType),
      this.scoreResponseActivity(input.responseCount),
      this.scoreLocation(input.state),
      this.scoreRecency(input.daysSinceIncident),
      this.scoreContactQuality(input.hasPhone, input.hasEmail),
    ];

    if (input.roofAge != null) factors.push(this.scoreRoofAge(input.roofAge));
    if (input.stormSeverity) factors.push(this.scoreStormSeverity(input.stormSeverity));

    const baseScore = factors.reduce((s, f) => s + f.points, 0);
    const maxPossible = factors.reduce((s, f) => s + f.weight, 0);
    const normalized = maxPossible > 0 ? Math.round((baseScore / maxPossible) * 100) : 0;
    const score = Math.min(100, Math.max(0, normalized));

    return {
      leadId: '',
      score,
      priority: this.classify(score),
      factors,
      computedAt: new Date().toISOString(),
    };
  }

  classify(score: number): PriorityGroup {
    if (score >= 80) return 'A';
    if (score >= 50) return 'B';
    return 'C';
  }

  // ── Factor Scoring ──

  private scorePropertyValue(value: number | null): ScoreFactor {
    const weight = 25;
    if (!value) return { name: 'Property Value', weight, rawValue: 0, points: 5 };
    let pts = 5;
    if (value >= 500000) pts = 25;
    else if (value >= 300000) pts = 20;
    else if (value >= 150000) pts = 15;
    else if (value >= 75000) pts = 10;
    return { name: 'Property Value', weight, rawValue: value, points: pts };
  }

  private scoreIncidentType(type: string | null): ScoreFactor {
    const weight = 20;
    if (!type) return { name: 'Incident Type', weight, rawValue: 0, points: 5 };
    const scores: Record<string, number> = {
      fire: 20, hail: 18, hurricane: 20, wind: 16, tornado: 20,
      flood: 14, lightning: 12, theft: 8, vandalism: 6,
    };
    const t = type.toLowerCase();
    const pts = scores[t] || 10;
    return { name: 'Incident Type', weight, rawValue: 0, points: pts };
  }

  private scoreResponseActivity(count: number): ScoreFactor {
    const weight = 15;
    let pts = 3;
    if (count >= 3) pts = 15;
    else if (count >= 2) pts = 12;
    else if (count >= 1) pts = 8;
    return { name: 'Response Activity', weight, rawValue: count, points: pts };
  }

  private scoreLocation(state: string | null): ScoreFactor {
    const weight = 15;
    if (!state) return { name: 'Location', weight, rawValue: 0, points: 8 };
    const highValue = new Set(['TX', 'FL', 'LA', 'OK', 'CO', 'GA', 'NC', 'SC', 'AL', 'MS']);
    const pts = highValue.has(state.toUpperCase()) ? 15 : 10;
    return { name: 'Location', weight, rawValue: 0, points: pts };
  }

  private scoreRecency(days: number | null): ScoreFactor {
    const weight = 15;
    if (days == null) return { name: 'Recency', weight, rawValue: 0, points: 5 };
    let pts = 3;
    if (days <= 3) pts = 15;
    else if (days <= 7) pts = 12;
    else if (days <= 14) pts = 9;
    else if (days <= 30) pts = 6;
    return { name: 'Recency', weight, rawValue: days, points: pts };
  }

  private scoreContactQuality(hasPhone: boolean, hasEmail: boolean): ScoreFactor {
    const weight = 10;
    let pts = 2;
    if (hasPhone && hasEmail) pts = 10;
    else if (hasPhone) pts = 7;
    else if (hasEmail) pts = 5;
    return { name: 'Contact Quality', weight, rawValue: 0, points: pts };
  }

  private scoreRoofAge(years: number): ScoreFactor {
    const weight = 5;
    let pts = 1;
    if (years >= 20) pts = 5;
    else if (years >= 15) pts = 4;
    else if (years >= 10) pts = 3;
    return { name: 'Roof Age', weight, rawValue: years, points: pts };
  }

  private scoreStormSeverity(severity: string): ScoreFactor {
    const weight = 5;
    const scores: Record<string, number> = { extreme: 5, severe: 4, high: 3, moderate: 2, low: 1 };
    return { name: 'Storm Severity', weight, rawValue: 0, points: scores[severity.toLowerCase()] || 2 };
  }

  // ── Batch + Lead Helpers ──

  scoreRotationLead(lead: RotationLead): LeadScore {
    const input: LeadScoringInput = {
      propertyValue: null,
      incidentType: lead.incident_type || null,
      responseCount: lead.contact_attempt_count || 0,
      state: lead.property_state || null,
      daysSinceIncident: lead.created_at ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000) : null,
      hasPhone: !!lead.phone,
      hasEmail: !!lead.email,
      roofAge: null,
      stormSeverity: null,
    };
    const result = this.computeScore(input);
    result.leadId = lead.id;
    return result;
  }

  scoreBatch(leads: RotationLead[]): LeadScore[] {
    return leads.map(l => this.scoreRotationLead(l));
  }

  computeSummary(scores: LeadScore[]): PrioritySummary {
    return {
      priorityA: scores.filter(s => s.priority === 'A').length,
      priorityB: scores.filter(s => s.priority === 'B').length,
      priorityC: scores.filter(s => s.priority === 'C').length,
      total: scores.length,
    };
  }

  sortByPriority(scores: LeadScore[]): LeadScore[] {
    return [...scores].sort((a, b) => b.score - a.score);
  }
}
