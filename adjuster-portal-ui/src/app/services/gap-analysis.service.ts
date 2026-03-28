import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  ClaimDocumentBundle,
  GapAnalysisReadiness,
  GapAnalysisContext,
  NormalizedLineItem,
  LineItemComparison,
  GapFinding,
  GapAnalysisReport,
  CarrierEstimateData,
  GapCategory,
  GapSeverity,
} from 'src/app/models/gap-analysis.model';
import { GapAnalysisResult, PolicyIntelligence } from 'src/app/models/policy-document.model';
import { EstimateProject } from 'src/app/models/estimating.model';

@Injectable({ providedIn: 'root' })
export class GapAnalysisService {

  /**
   * Build a ClaimDocumentBundle from the IDs currently known.
   * In the future this will call the backend; for now it just structures
   * the IDs the caller already has.
   */
  buildBundle(
    claimId: string,
    policyId: string | null,
    paEstimateId: string | null = null,
    carrierEstimateId: string | null = null,
    supplementEstimateId: string | null = null,
  ): ClaimDocumentBundle {
    return {
      claimId,
      policyId,
      paEstimateId,
      carrierEstimateId,
      supplementEstimateId,
    };
  }

  /**
   * Determine whether gap analysis can run for a given bundle.
   * Requires at minimum a policy AND at least one estimate.
   */
  checkReadiness(bundle: ClaimDocumentBundle): GapAnalysisReadiness {
    const hasPolicy = !!bundle.policyId;
    const hasPaEstimate = !!bundle.paEstimateId;
    const hasCarrierEstimate = !!bundle.carrierEstimateId;
    const hasSupplementEstimate = !!bundle.supplementEstimateId;
    const hasAnyEstimate = hasPaEstimate || hasCarrierEstimate || hasSupplementEstimate;
    const canRunAnalysis = hasPolicy && hasAnyEstimate;

    let message: string;
    if (canRunAnalysis) {
      message = 'Gap analysis will run when both policy and estimate data are available.';
    } else if (!hasPolicy) {
      message = 'Estimate comparison available once policy analysis is complete.';
    } else {
      message = 'Estimate comparison available once claim estimates are uploaded.';
    }

    return {
      hasPolicy,
      hasPaEstimate,
      hasCarrierEstimate,
      hasSupplementEstimate,
      canRunAnalysis,
      message,
    };
  }

  /**
   * Placeholder for the future analysis engine.
   * Currently returns an observable with null — no analysis is run.
   */
  runAnalysis(bundle: ClaimDocumentBundle): Observable<GapAnalysisResult | null> {
    // Future: POST to backend gap-analysis endpoint
    return of(null);
  }

  /**
   * Convenience: build bundle + check readiness in one call.
   */
  getContext(
    claimId: string,
    policyId: string | null,
    paEstimateId: string | null = null,
    carrierEstimateId: string | null = null,
    supplementEstimateId: string | null = null,
  ): GapAnalysisContext {
    const bundle = this.buildBundle(claimId, policyId, paEstimateId, carrierEstimateId, supplementEstimateId);
    const readiness = this.checkReadiness(bundle);
    return { bundle, readiness, result: null };
  }

  // ── Gap Analysis Engine ──

  private nextId = 1;
  private uid(): string {
    return 'gap-' + (this.nextId++);
  }

  private normalizeDesc(desc: string): string {
    return (desc || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  normalizeEstimateProject(project: EstimateProject): NormalizedLineItem[] {
    const items: NormalizedLineItem[] = [];
    for (const room of project.rooms || []) {
      for (const li of room.line_items || []) {
        items.push({
          id: li.id || this.uid(),
          room: room.name || 'Unknown',
          description: li.description || '',
          descriptionNorm: this.normalizeDesc(li.description),
          quantity: li.quantity || 0,
          unit: li.unit || 'EA',
          unitCost: li.unit_cost || 0,
          totalCost: li.total_cost || ((li.quantity || 0) * (li.unit_cost || 0)),
          source: 'pa',
          category: this.inferCategory(li.description),
        });
      }
    }
    return items;
  }

  private inferCategory(desc: string): string {
    const d = (desc || '').toLowerCase();
    if (/roof|shingle|flashing|ridge|soffit|fascia|gutter/.test(d)) return 'roofing';
    if (/floor|carpet|tile|vinyl|laminate|hardwood/.test(d)) return 'flooring';
    if (/drywall|plaster|wall|paint|primer|texture/.test(d)) return 'drywall';
    if (/plumb|pipe|faucet|toilet|water heater/.test(d)) return 'plumbing';
    if (/electr|wire|outlet|switch|panel|breaker/.test(d)) return 'electrical';
    if (/window|door|frame|trim|casing/.test(d)) return 'openings';
    if (/hvac|duct|furnace|air condition|heat/.test(d)) return 'hvac';
    if (/demo|tear|remove|haul|debris/.test(d)) return 'demolition';
    if (/insul/.test(d)) return 'insulation';
    if (/cabinet|counter|appliance|sink/.test(d)) return 'kitchen';
    return 'general';
  }

  parseCarrierEstimateText(rawText: string): CarrierEstimateData {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const items: NormalizedLineItem[] = [];
    let totalCost = 0;

    // Try CSV-like parsing: description, qty, unit, unit_cost, total_cost
    // Or tab-separated
    for (const line of lines) {
      // Skip headers and summary lines
      if (/^(item|description|line|#|total|subtotal|grand|---)/i.test(line)) continue;

      // Try to extract numbers from end of line
      const parts = line.split(/[,\t]+/).map(p => p.trim());
      if (parts.length >= 3) {
        const desc = parts[0];
        const nums = parts.slice(1).map(p => parseFloat(p.replace(/[$,]/g, ''))).filter(n => !isNaN(n));
        if (nums.length >= 2) {
          const qty = nums[0];
          const cost = nums[nums.length - 1];
          const unitCost = nums.length >= 3 ? nums[1] : (qty > 0 ? cost / qty : cost);
          const item: NormalizedLineItem = {
            id: this.uid(),
            room: '',
            description: desc,
            descriptionNorm: this.normalizeDesc(desc),
            quantity: qty,
            unit: 'EA',
            unitCost: unitCost,
            totalCost: cost,
            source: 'carrier',
            category: this.inferCategory(desc),
          };
          items.push(item);
          totalCost += cost;
          continue;
        }
      }

      // Fallback: try regex pattern: description followed by dollar amounts
      const match = line.match(/^(.+?)\s+([\d,.]+)\s+(\w+)\s+\$?([\d,.]+)\s+\$?([\d,.]+)$/);
      if (match) {
        const qty = parseFloat(match[2].replace(/,/g, ''));
        const uc = parseFloat(match[4].replace(/,/g, ''));
        const tc = parseFloat(match[5].replace(/,/g, ''));
        const item: NormalizedLineItem = {
          id: this.uid(),
          room: '',
          description: match[1].trim(),
          descriptionNorm: this.normalizeDesc(match[1]),
          quantity: qty,
          unit: match[3],
          unitCost: uc,
          totalCost: tc,
          source: 'carrier',
          category: this.inferCategory(match[1]),
        };
        items.push(item);
        totalCost += tc;
        continue;
      }

      // Try simple: description $amount
      const simpleMatch = line.match(/^(.+?)\s+\$?([\d,]+\.?\d*)$/);
      if (simpleMatch) {
        const cost = parseFloat(simpleMatch[2].replace(/,/g, ''));
        if (cost > 0) {
          const item: NormalizedLineItem = {
            id: this.uid(),
            room: '',
            description: simpleMatch[1].trim(),
            descriptionNorm: this.normalizeDesc(simpleMatch[1]),
            quantity: 1,
            unit: 'EA',
            unitCost: cost,
            totalCost: cost,
            source: 'carrier',
            category: this.inferCategory(simpleMatch[1]),
          };
          items.push(item);
          totalCost += cost;
        }
      }
    }

    return { lineItems: items, totalCost, rawText };
  }

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(' ').filter(w => w.length > 1));
    const setB = new Set(b.split(' ').filter(w => w.length > 1));
    if (setA.size === 0 && setB.size === 0) return 0;
    let intersection = 0;
    setA.forEach(w => { if (setB.has(w)) intersection++; });
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  matchLineItems(paItems: NormalizedLineItem[], carrierItems: NormalizedLineItem[]): LineItemComparison[] {
    const comparisons: LineItemComparison[] = [];
    const usedCarrier = new Set<string>();

    for (const pa of paItems) {
      let bestMatch: NormalizedLineItem | null = null;
      let bestScore = 0;

      for (const ca of carrierItems) {
        if (usedCarrier.has(ca.id)) continue;
        let score = this.jaccardSimilarity(pa.descriptionNorm, ca.descriptionNorm);
        // Bonus for same room
        if (pa.room && ca.room && pa.room.toLowerCase() === ca.room.toLowerCase()) {
          score += 0.15;
        }
        // Bonus for same category
        if (pa.category && ca.category && pa.category === ca.category) {
          score += 0.1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestMatch = ca;
        }
      }

      if (bestMatch && bestScore >= 0.4) {
        usedCarrier.add(bestMatch.id);
        comparisons.push({
          paItem: pa,
          carrierItem: bestMatch,
          matchScore: Math.min(bestScore, 1),
          priceDifference: pa.totalCost - bestMatch.totalCost,
          quantityDifference: pa.quantity - bestMatch.quantity,
          status: 'matched',
        });
      } else {
        comparisons.push({
          paItem: pa,
          carrierItem: null,
          matchScore: 0,
          priceDifference: pa.totalCost,
          quantityDifference: pa.quantity,
          status: 'pa_only',
        });
      }
    }

    // Carrier-only items
    for (const ca of carrierItems) {
      if (!usedCarrier.has(ca.id)) {
        comparisons.push({
          paItem: null,
          carrierItem: ca,
          matchScore: 0,
          priceDifference: -ca.totalCost,
          quantityDifference: -ca.quantity,
          status: 'carrier_only',
        });
      }
    }

    return comparisons;
  }

  runFullAnalysis(
    paItems: NormalizedLineItem[],
    carrierItems: NormalizedLineItem[],
    caseId: string,
    policyIntel?: PolicyIntelligence | null,
  ): GapAnalysisReport {
    const comparisons = this.matchLineItems(paItems, carrierItems);
    const paTotal = paItems.reduce((s, i) => s + i.totalCost, 0);
    const carrierTotal = carrierItems.reduce((s, i) => s + i.totalCost, 0);

    const findings: GapFinding[] = [
      ...this.detectMissingScope(comparisons),
      ...this.detectUnderpaidItems(comparisons),
      ...this.detectCodeUpgradeCoverage(comparisons, policyIntel),
      ...this.detectMatchingViolations(comparisons, policyIntel),
      ...this.detectCoverageLimits(paTotal, carrierTotal, policyIntel),
      ...this.detectALECoverage(comparisons, policyIntel),
      ...this.calculateDeductibleImpact(carrierTotal, policyIntel),
    ];

    const report: GapAnalysisReport = {
      id: this.uid(),
      caseId,
      createdAt: new Date(),
      paEstimateTotal: paTotal,
      carrierEstimateTotal: carrierTotal,
      totalGap: paTotal - carrierTotal,
      comparisons,
      findings,
      summary: '',
    };
    report.summary = this.generateSummary(report);
    return report;
  }

  private detectMissingScope(comparisons: LineItemComparison[]): GapFinding[] {
    return comparisons
      .filter(c => c.status === 'pa_only' && c.paItem)
      .map(c => ({
        id: this.uid(),
        category: 'missing_scope' as GapCategory,
        severity: (c.paItem!.totalCost > 500 ? 'critical' : 'warning') as GapSeverity,
        title: 'Missing from carrier estimate',
        description: `"${c.paItem!.description}" (${c.paItem!.room}) is in the PA estimate but not in the carrier's.`,
        paAmount: c.paItem!.totalCost,
        carrierAmount: 0,
        difference: c.paItem!.totalCost,
        relatedItems: [c.paItem!.id],
        recommendation: 'Include in supplement request with supporting documentation.',
      }));
  }

  private detectUnderpaidItems(comparisons: LineItemComparison[]): GapFinding[] {
    return comparisons
      .filter(c => c.status === 'matched' && c.priceDifference > 0)
      .filter(c => {
        const carrierCost = c.carrierItem!.totalCost;
        return carrierCost > 0 && (c.priceDifference / carrierCost) > 0.1;
      })
      .map(c => ({
        id: this.uid(),
        category: 'underpaid' as GapCategory,
        severity: (c.priceDifference > 1000 ? 'critical' : 'warning') as GapSeverity,
        title: 'Underpaid line item',
        description: `"${c.paItem!.description}" — PA: $${c.paItem!.totalCost.toFixed(2)} vs Carrier: $${c.carrierItem!.totalCost.toFixed(2)} (${((c.priceDifference / c.carrierItem!.totalCost) * 100).toFixed(0)}% underpaid).`,
        paAmount: c.paItem!.totalCost,
        carrierAmount: c.carrierItem!.totalCost,
        difference: c.priceDifference,
        relatedItems: [c.paItem!.id, c.carrierItem!.id],
        recommendation: 'Request price adjustment with local market pricing data.',
      }));
  }

  private detectCodeUpgradeCoverage(comparisons: LineItemComparison[], policyIntel?: PolicyIntelligence | null): GapFinding[] {
    const codeKeywords = /code|upgrade|ordinance|permit|compliance|ada|ibc|irc/i;
    const findings: GapFinding[] = [];

    const paCodeItems = comparisons.filter(c => c.status === 'pa_only' && c.paItem && codeKeywords.test(c.paItem.description));
    if (paCodeItems.length > 0) {
      const total = paCodeItems.reduce((s, c) => s + (c.paItem?.totalCost || 0), 0);
      findings.push({
        id: this.uid(),
        category: 'code_upgrade',
        severity: 'critical',
        title: `${paCodeItems.length} code/upgrade item(s) missing from carrier`,
        description: `Code compliance and upgrade items totaling $${total.toFixed(2)} are not included in the carrier estimate.`,
        paAmount: total,
        carrierAmount: 0,
        difference: total,
        relatedItems: paCodeItems.map(c => c.paItem!.id),
        recommendation: policyIntel?.ordinance_and_law
          ? `Policy has Ordinance & Law coverage: "${policyIntel.ordinance_and_law}". Include in supplement.`
          : 'Check policy for Ordinance & Law coverage to support these items.',
      });
    }
    return findings;
  }

  private detectMatchingViolations(comparisons: LineItemComparison[], policyIntel?: PolicyIntelligence | null): GapFinding[] {
    if (!policyIntel?.matching_language) return [];
    const matchingCategories = ['roofing', 'flooring', 'drywall'];
    const findings: GapFinding[] = [];

    for (const cat of matchingCategories) {
      const paItems = comparisons.filter(c => c.paItem?.category === cat);
      const carrierItems = comparisons.filter(c => c.carrierItem?.category === cat);
      const paMissing = paItems.filter(c => c.status === 'pa_only');
      if (paMissing.length > 0 && carrierItems.length > 0) {
        const total = paMissing.reduce((s, c) => s + (c.paItem?.totalCost || 0), 0);
        findings.push({
          id: this.uid(),
          category: 'matching_violation',
          severity: 'warning',
          title: `Matching violation in ${cat}`,
          description: `Carrier included some ${cat} items but omitted ${paMissing.length} related items. Policy matching language: "${policyIntel.matching_language}"`,
          paAmount: total,
          difference: total,
          recommendation: 'Cite matching language in supplement to require uniform repair across adjacent areas.',
        });
      }
    }
    return findings;
  }

  private detectCoverageLimits(paTotal: number, carrierTotal: number, policyIntel?: PolicyIntelligence | null): GapFinding[] {
    const findings: GapFinding[] = [];
    if (policyIntel?.coverage_a_dwelling) {
      const limit = policyIntel.coverage_a_dwelling;
      if (paTotal > limit) {
        findings.push({
          id: this.uid(),
          category: 'coverage_limit',
          severity: 'critical',
          title: 'PA estimate exceeds Coverage A limit',
          description: `PA estimate ($${paTotal.toFixed(2)}) exceeds the Coverage A dwelling limit ($${limit.toFixed(2)}) by $${(paTotal - limit).toFixed(2)}.`,
          paAmount: paTotal,
          carrierAmount: limit,
          difference: paTotal - limit,
          recommendation: 'Review for additional coverage under endorsements or consider appraisal process.',
        });
      }
    }
    return findings;
  }

  private detectALECoverage(comparisons: LineItemComparison[], policyIntel?: PolicyIntelligence | null): GapFinding[] {
    const aleKeywords = /ale|additional living|loss of use|temporary housing|hotel|rental|relocation/i;
    const paAle = comparisons.filter(c => c.status === 'pa_only' && c.paItem && aleKeywords.test(c.paItem.description));
    if (paAle.length === 0) return [];

    const total = paAle.reduce((s, c) => s + (c.paItem?.totalCost || 0), 0);
    return [{
      id: this.uid(),
      category: 'ale_gap',
      severity: 'warning',
      title: 'ALE/Loss of Use items missing from carrier',
      description: `${paAle.length} additional living expense item(s) totaling $${total.toFixed(2)} not in carrier estimate.`,
      paAmount: total,
      carrierAmount: 0,
      difference: total,
      relatedItems: paAle.map(c => c.paItem!.id),
      recommendation: policyIntel?.ale_loss_of_use_details
        ? `Policy ALE details: "${policyIntel.ale_loss_of_use_details}". Include in supplement.`
        : 'Check Coverage D limits for ALE coverage.',
    }];
  }

  private calculateDeductibleImpact(carrierTotal: number, policyIntel?: PolicyIntelligence | null): GapFinding[] {
    if (!policyIntel?.deductible_amount) return [];
    const deductible = policyIntel.deductible_amount;
    const findings: GapFinding[] = [];

    if (deductible > carrierTotal * 0.5) {
      findings.push({
        id: this.uid(),
        category: 'deductible_issue',
        severity: 'info',
        title: 'High deductible impact',
        description: `Deductible ($${deductible.toFixed(2)}) represents ${((deductible / carrierTotal) * 100).toFixed(0)}% of the carrier estimate ($${carrierTotal.toFixed(2)}).`,
        carrierAmount: carrierTotal,
        difference: deductible,
        recommendation: 'Verify deductible has been correctly applied. Net carrier payout: $' + (carrierTotal - deductible).toFixed(2),
      });
    }

    if (policyIntel.deductible_wind_hail && policyIntel.deductible_wind_hail > deductible) {
      findings.push({
        id: this.uid(),
        category: 'deductible_issue',
        severity: 'warning',
        title: 'Wind/Hail deductible may apply',
        description: `Wind/Hail deductible ($${policyIntel.deductible_wind_hail.toFixed(2)}) is higher than the standard deductible. Ensure carrier applied the correct deductible.`,
        difference: policyIntel.deductible_wind_hail - deductible,
        recommendation: 'Confirm loss type and applicable deductible with carrier.',
      });
    }

    return findings;
  }

  generateSummary(report: GapAnalysisReport): string {
    const critical = report.findings.filter(f => f.severity === 'critical').length;
    const warnings = report.findings.filter(f => f.severity === 'warning').length;
    const matched = report.comparisons.filter(c => c.status === 'matched').length;
    const paOnly = report.comparisons.filter(c => c.status === 'pa_only').length;
    const carrierOnly = report.comparisons.filter(c => c.status === 'carrier_only').length;

    let summary = `Gap Analysis: PA estimate $${report.paEstimateTotal.toFixed(2)} vs Carrier estimate $${report.carrierEstimateTotal.toFixed(2)}. `;
    summary += `Total gap: $${report.totalGap.toFixed(2)}. `;
    summary += `${matched} matched items, ${paOnly} PA-only (missing from carrier), ${carrierOnly} carrier-only. `;
    summary += `${report.findings.length} findings: ${critical} critical, ${warnings} warnings. `;

    const missingTotal = report.findings
      .filter(f => f.category === 'missing_scope')
      .reduce((s, f) => s + (f.difference || 0), 0);
    if (missingTotal > 0) {
      summary += `Missing scope items total $${missingTotal.toFixed(2)}. `;
    }

    const underpaidTotal = report.findings
      .filter(f => f.category === 'underpaid')
      .reduce((s, f) => s + (f.difference || 0), 0);
    if (underpaidTotal > 0) {
      summary += `Underpaid items total $${underpaidTotal.toFixed(2)}.`;
    }

    return summary;
  }

  toCSVRows(report: GapAnalysisReport): string[][] {
    const rows: string[][] = [
      ['Room', 'Description', 'PA Qty', 'PA Unit Cost', 'PA Total', 'Carrier Qty', 'Carrier Unit Cost', 'Carrier Total', 'Difference', 'Status'],
    ];

    for (const c of report.comparisons) {
      rows.push([
        c.paItem?.room || c.carrierItem?.room || '',
        c.paItem?.description || c.carrierItem?.description || '',
        c.paItem ? String(c.paItem.quantity) : '',
        c.paItem ? c.paItem.unitCost.toFixed(2) : '',
        c.paItem ? c.paItem.totalCost.toFixed(2) : '',
        c.carrierItem ? String(c.carrierItem.quantity) : '',
        c.carrierItem ? c.carrierItem.unitCost.toFixed(2) : '',
        c.carrierItem ? c.carrierItem.totalCost.toFixed(2) : '',
        c.priceDifference.toFixed(2),
        c.status,
      ]);
    }

    // Summary rows
    rows.push([]);
    rows.push(['', '', '', 'PA Total', report.paEstimateTotal.toFixed(2), '', '', 'Carrier Total', report.carrierEstimateTotal.toFixed(2), '']);
    rows.push(['', '', '', '', '', '', '', 'Gap', report.totalGap.toFixed(2), '']);

    return rows;
  }
}
