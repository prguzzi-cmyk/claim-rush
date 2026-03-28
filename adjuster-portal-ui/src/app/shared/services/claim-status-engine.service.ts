import { Injectable } from '@angular/core';
import { Claim } from 'src/app/models/claim.model';
import { ClaimStatusSnapshot } from '../models/claim-financials.model';

/**
 * ClaimStatusEngine
 *
 * Derives a normalised ClaimStatusSnapshot from a Claim object and its
 * recent activity timeline.  No HTTP calls — pure logic.
 *
 * Reuse this wherever you need claim-phase / next-step intelligence:
 *   Recovery tab, Task Board, Dashboard widgets, Notifications.
 */
@Injectable({ providedIn: 'root' })
export class ClaimStatusEngineService {

  // ── Phase normalisation map ────────────────────────────────────────────────
  // Maps raw current_phase values to clean display labels.
  // Extend this as new phases appear in the backend.
  private static readonly PHASE_MAP: Record<string, string> = {
    'initial_review':   'Initial Review',
    'initial review':   'Initial Review',
    'field_inspection': 'Field Inspection',
    'field inspection': 'Field Inspection',
    'estimate':         'Estimating',
    'estimating':       'Estimating',
    'supplement':       'Supplement',
    'negotiation':      'Negotiation',
    'appraisal':        'Appraisal',
    'umpire':           'Umpire',
    'litigation':       'Litigation',
    'closed':           'Closed',
    'settled':          'Settled',
  };

  // Activity types that indicate carrier actions
  private static readonly CARRIER_ACTIONS = new Set([
    'carrier-estimate-received',
    'payment-issued',
    'payment-updated',
  ]);

  // Activity types that indicate insured actions
  private static readonly INSURED_ACTIONS = new Set([
    'document-uploaded',
    'comment-added',
  ]);

  /**
   * Compute the status snapshot from a Claim and its recent timeline events.
   *
   * @param claim - The claim object (must have current_phase at minimum).
   * @param timelineEvents - Recent activity events (newest first).
   */
  compute(claim: Claim, timelineEvents: any[] = []): ClaimStatusSnapshot {
    const claimPhase = this.normalisePhase(claim?.current_phase);

    const lastCarrierAction = this.findLastAction(
      timelineEvents, ClaimStatusEngineService.CARRIER_ACTIONS
    );
    const lastInsuredAction = this.findLastAction(
      timelineEvents, ClaimStatusEngineService.INSURED_ACTIONS
    );

    const pendingNextStep = this.inferNextStep(claim, claimPhase, timelineEvents);

    return { claimPhase, lastCarrierAction, lastInsuredAction, pendingNextStep };
  }

  /** Normalise a raw phase string to a clean display label. */
  private normalisePhase(raw: string | undefined): string {
    if (!raw) return 'Unknown';
    const key = raw.trim().toLowerCase();
    return ClaimStatusEngineService.PHASE_MAP[key] ?? this.titleCase(raw);
  }

  /** Find the most recent event matching one of the given activity types. */
  private findLastAction(events: any[], types: Set<string>): string | null {
    const match = events.find(e => types.has(e.activity_type));
    return match?.title ?? null;
  }

  /**
   * Infer the logical next step based on claim phase and recent activity.
   * This is a best-effort heuristic — extend as business rules evolve.
   */
  private inferNextStep(claim: Claim, phase: string, events: any[]): string | null {
    // Check for supplement-related signals
    const hasSupplementEmail = events.some(e => e.activity_type === 'supplement-email-sent');
    const hasCarrierEstimate = events.some(e => e.activity_type === 'carrier-estimate-received');

    switch (phase) {
      case 'Initial Review':
        return 'Schedule field inspection';
      case 'Field Inspection':
        return 'Complete inspection and begin estimating';
      case 'Estimating':
        return 'Finalize ACI estimate and submit to carrier';
      case 'Supplement':
        if (hasSupplementEmail && !hasCarrierEstimate) {
          return 'Awaiting carrier response to supplement';
        }
        return 'Prepare and send supplement documentation';
      case 'Negotiation':
        return 'Follow up on carrier negotiation';
      case 'Appraisal':
        return 'Await appraisal panel decision';
      case 'Umpire':
        return 'Await umpire ruling';
      case 'Litigation':
        return 'Coordinate with legal counsel';
      case 'Settled':
      case 'Closed':
        return null; // No next step for terminal phases
      default:
        return null;
    }
  }

  private titleCase(s: string): string {
    return s.replace(/\b\w/g, c => c.toUpperCase());
  }
}
