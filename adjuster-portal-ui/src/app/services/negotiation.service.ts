import { Injectable } from '@angular/core';
import {
  GapAnalysisReport,
  NegotiationStrategy,
  SettlementScenario,
  NegotiationRound,
  DocumentType,
  PositionStrength,
  NegotiationApproach,
} from '../models/gap-analysis.model';
import { PolicyIntelligence } from '../models/policy-document.model';

@Injectable({ providedIn: 'root' })
export class NegotiationService {

  assessPositionStrength(
    report: GapAnalysisReport,
    policyIntel?: PolicyIntelligence | null
  ): NegotiationStrategy {
    let score = 50;

    // Score based on findings severity
    for (const f of report.findings) {
      if (f.severity === 'critical') score += 10;
      else if (f.severity === 'warning') score += 5;
    }

    // Score based on policy provisions
    if (policyIntel) {
      if (policyIntel.matching_language) score += 10;
      if (policyIntel.ordinance_and_law) score += 10;
      if (policyIntel.replacement_cost_language) score += 5;
      if (policyIntel.appraisal_clause) score += 10;
    }

    score = Math.min(score, 100);

    const positionStrength: PositionStrength =
      score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

    const approach: NegotiationApproach =
      positionStrength === 'strong'
        ? 'aggressive'
        : positionStrength === 'moderate'
          ? 'collaborative'
          : 'appraisal';

    const leveragePoints = this.buildLeveragePoints(report, policyIntel);
    const risks = this.buildRisks(report, policyIntel, positionStrength);
    const recommendedActions = this.buildRecommendedActions(positionStrength, report, policyIntel);

    return {
      positionStrength,
      strengthScore: score,
      approach,
      leveragePoints,
      risks,
      recommendedActions,
    };
  }

  buildLeveragePoints(
    report: GapAnalysisReport,
    policyIntel?: PolicyIntelligence | null
  ): string[] {
    const points: string[] = [];

    const missingScopeFindings = report.findings.filter(f => f.category === 'missing_scope');
    if (missingScopeFindings.length > 0) {
      const total = missingScopeFindings.reduce((s, f) => s + (f.difference || 0), 0);
      points.push(`Missing scope items totaling $${total.toLocaleString()} not included in carrier estimate`);
    }

    const underpaidFindings = report.findings.filter(f => f.category === 'underpaid');
    if (underpaidFindings.length > 0) {
      const total = underpaidFindings.reduce((s, f) => s + (f.difference || 0), 0);
      points.push(`Underpaid line items totaling $${total.toLocaleString()} below PA pricing`);
    }

    const codeFindings = report.findings.filter(f => f.category === 'code_upgrade');
    if (codeFindings.length > 0) {
      const total = codeFindings.reduce((s, f) => s + (f.difference || 0), 0);
      points.push(`Code upgrade coverage: carrier missed $${total.toLocaleString()} in required upgrades`);
    }

    if (policyIntel?.matching_language) {
      points.push('Matching language in policy requires full replacement of adjacent areas');
    }

    if (policyIntel?.ordinance_and_law) {
      const olFindings = report.findings.filter(f => f.category === 'code_upgrade');
      if (olFindings.length > 0) {
        const total = olFindings.reduce((s, f) => s + (f.difference || 0), 0);
        points.push(`Ordinance and law coverage applies to $${total.toLocaleString()} in code-required work`);
      }
    }

    if (policyIntel?.replacement_cost_language) {
      points.push('Replacement cost valuation requires full cost to repair/replace without depreciation');
    }

    if (policyIntel?.appraisal_clause) {
      points.push('Appraisal clause available as escalation path if carrier refuses to negotiate');
    }

    if (report.totalGap > 0) {
      const gapPct = ((report.totalGap / report.paEstimateTotal) * 100).toFixed(1);
      points.push(`Total gap of $${report.totalGap.toLocaleString()} represents ${gapPct}% of the PA estimate`);
    }

    return points;
  }

  private buildRisks(
    report: GapAnalysisReport,
    policyIntel?: PolicyIntelligence | null,
    strength?: PositionStrength
  ): string[] {
    const risks: string[] = [];

    if (!policyIntel) {
      risks.push('No policy intelligence available — leverage points may be weaker without policy language support');
    }

    if (report.findings.filter(f => f.severity === 'critical').length === 0) {
      risks.push('No critical findings — carrier may argue differences are within normal variance');
    }

    const matchedCount = report.comparisons.filter(c => c.status === 'matched').length;
    const totalComps = report.comparisons.length;
    if (totalComps > 0 && matchedCount / totalComps > 0.8) {
      risks.push('High match rate between estimates — carrier may argue only minor adjustments needed');
    }

    if (strength === 'weak') {
      risks.push('Weak position — consider appraisal process or third-party umpire');
    }

    const deductibleIssues = report.findings.filter(f => f.category === 'deductible_issue');
    if (deductibleIssues.length > 0) {
      risks.push('Deductible issues detected — carrier may use these to offset settlement');
    }

    return risks;
  }

  private buildRecommendedActions(
    strength: PositionStrength,
    report: GapAnalysisReport,
    policyIntel?: PolicyIntelligence | null
  ): string[] {
    const actions: string[] = [];

    if (strength === 'strong') {
      actions.push('Send a formal demand letter citing specific policy language and gap findings');
      actions.push('Request a desk adjuster meeting to present line-by-line comparison');
      if (report.findings.filter(f => f.category === 'missing_scope').length > 0) {
        actions.push('Submit supplement for all missing scope items with supporting documentation');
      }
    } else if (strength === 'moderate') {
      actions.push('Open collaborative dialogue with carrier adjuster, presenting gap findings');
      actions.push('Focus on the strongest findings first to build momentum');
      if (policyIntel?.appraisal_clause) {
        actions.push('Reserve appraisal clause as escalation if initial negotiation stalls');
      }
    } else {
      if (policyIntel?.appraisal_clause) {
        actions.push('Invoke appraisal clause — position may be stronger with independent umpire');
      }
      actions.push('Gather additional documentation to strengthen weakest findings');
      actions.push('Consider engaging an independent expert to validate PA estimate pricing');
    }

    actions.push('Document all communication and negotiation rounds for audit trail');

    return actions;
  }

  calculateSettlement(
    percentage: number,
    report: GapAnalysisReport,
    policyIntel?: PolicyIntelligence | null
  ): SettlementScenario {
    const totalGap = report.totalGap;
    const gapRecovered = totalGap * percentage / 100;
    const settlementAmount = report.carrierEstimateTotal + gapRecovered;
    const deductibleAmount = policyIntel?.deductible_amount ?? 0;
    const netAfterDeductible = settlementAmount - deductibleAmount;

    return {
      settlementPercentage: percentage,
      settlementAmount,
      paTotal: report.paEstimateTotal,
      carrierTotal: report.carrierEstimateTotal,
      gapRecovered,
      gapRecoveryPercent: percentage,
      netAfterDeductible,
      deductibleAmount,
    };
  }

  createRound(
    roundNumber: number,
    date: string,
    carrierOffer: number,
    paCounter: number,
    notes: string
  ): NegotiationRound {
    return {
      id: crypto.randomUUID(),
      roundNumber,
      date,
      carrierOfferAmount: carrierOffer,
      paCounterAmount: paCounter,
      notes,
      outcome: 'pending',
    };
  }

  getDocumentTypes(): { type: DocumentType; label: string; icon: string; actionType: string }[] {
    return [
      { type: 'demand_letter', label: 'Demand Letter', icon: 'send', actionType: 'supplement_support' },
      { type: 'estimate_defense', label: 'Estimate Defense', icon: 'shield', actionType: 'estimate_defense' },
      { type: 'followup_letter', label: 'Follow-Up Letter', icon: 'forward_to_inbox', actionType: 'followup_letter' },
    ];
  }

  buildClaimContextForAI(
    report: GapAnalysisReport,
    strategy: NegotiationStrategy,
    rounds: NegotiationRound[]
  ): string {
    let ctx = `GAP ANALYSIS SUMMARY:\n`;
    ctx += `PA Estimate: $${report.paEstimateTotal.toLocaleString()}\n`;
    ctx += `Carrier Estimate: $${report.carrierEstimateTotal.toLocaleString()}\n`;
    ctx += `Total Gap: $${report.totalGap.toLocaleString()}\n`;
    ctx += `Findings: ${report.findings.length} (${report.findings.filter(f => f.severity === 'critical').length} critical)\n\n`;

    ctx += `POSITION ASSESSMENT:\n`;
    ctx += `Strength: ${strategy.positionStrength.toUpperCase()} (${strategy.strengthScore}/100)\n`;
    ctx += `Approach: ${strategy.approach}\n\n`;

    if (strategy.leveragePoints.length > 0) {
      ctx += `KEY LEVERAGE POINTS:\n`;
      for (const lp of strategy.leveragePoints) {
        ctx += `- ${lp}\n`;
      }
      ctx += '\n';
    }

    ctx += `TOP FINDINGS:\n`;
    for (const f of report.findings.slice(0, 10)) {
      ctx += `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`;
      if (f.difference) ctx += ` ($${f.difference.toLocaleString()})`;
      ctx += '\n';
    }

    if (rounds.length > 0) {
      ctx += `\nNEGOTIATION HISTORY:\n`;
      for (const r of rounds) {
        ctx += `Round ${r.roundNumber} (${r.date}): Carrier offered $${r.carrierOfferAmount.toLocaleString()}, PA countered $${r.paCounterAmount.toLocaleString()}`;
        if (r.notes) ctx += ` — ${r.notes}`;
        ctx += '\n';
      }
    }

    if (report.summary) {
      ctx += `\nDETAILED SUMMARY:\n${report.summary}\n`;
    }

    return ctx;
  }
}
