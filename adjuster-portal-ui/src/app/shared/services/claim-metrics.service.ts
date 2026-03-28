import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { Claim } from 'src/app/models/claim.model';
import { ClaimService } from 'src/app/services/claim.service';
import { ClaimFinancialEngineService } from './claim-financial-engine.service';
import { ClaimStatusEngineService } from './claim-status-engine.service';
import { ClaimMetrics, PaymentSummaryPayload } from '../models/claim-financials.model';

/**
 * ClaimMetricsService
 *
 * Orchestrator: fetches raw data via ClaimService, then delegates computation
 * to ClaimFinancialEngine and ClaimStatusEngine.
 *
 * Returns a single ClaimMetrics observable — the one-stop source of truth
 * that any tab or widget should consume.
 *
 * Usage:
 *   this.claimMetricsService.getMetrics(claim).subscribe(m => { ... });
 */
@Injectable({ providedIn: 'root' })
export class ClaimMetricsService {

  constructor(
    private claimService: ClaimService,
    private financialEngine: ClaimFinancialEngineService,
    private statusEngine: ClaimStatusEngineService,
  ) {}

  /**
   * Fetch and compute all metrics for the given claim.
   * Fires two API calls in parallel (payment summary + timeline),
   * then runs both engines and returns the combined result.
   */
  getMetrics(claim: Claim): Observable<ClaimMetrics> {
    const paymentSummary$ = this.claimService
      .getClaimPaymentSummary(claim.id)
      .pipe(catchError(() => of({} as PaymentSummaryPayload)));

    const timeline$ = this.claimService
      .getClaimTimeline(claim.id)
      .pipe(catchError(() => of([] as any[])));

    return forkJoin([paymentSummary$, timeline$]).pipe(
      map(([summary, timeline]) => {
        const financials = this.financialEngine.compute(summary);
        const status = this.statusEngine.compute(claim, timeline || []);

        return {
          financials,
          status,
          computedAt: new Date().toISOString(),
        } as ClaimMetrics;
      })
    );
  }
}
