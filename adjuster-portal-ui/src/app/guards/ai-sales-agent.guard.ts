import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

import { environment } from '../../environments/environment';

/**
 * AI Sales Agent route guard.
 *
 * The AI Sales Agent surfaces (sales-agent-dashboard, conversation
 * engine, intake-launcher, appointment-scheduling, sales-script-manager,
 * sales-kpi-dashboard) currently render mock/static data and imply
 * real customer contact they cannot perform. Audit 2026-05-09.
 *
 * This guard gates every /app/ai-sales-agent/* route behind the
 * `featureFlags.aiSalesAgent` boolean:
 *   - environment.ts (dev)       → true   (designers/devs can still load the pages)
 *   - environment.prod.ts (prod) → false  (operators redirected away)
 *
 * When the flag is false, any direct navigation to a guarded route
 * is redirected to /app/dashboard/intelligence (the canonical Global
 * Intelligence Command Center landing).
 *
 * NOTE: The guard does NOT delete or alter the components — they
 * remain in the codebase for future production wiring. Flip the
 * prod flag to true once the surfaces are connected to the real
 * outreach engine + skip-trace pipeline.
 */
@Injectable({ providedIn: 'root' })
export class AiSalesAgentGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean | UrlTree {
    const enabled = environment?.featureFlags?.aiSalesAgent === true;
    if (enabled) return true;
    return this.router.createUrlTree(['/app/dashboard/intelligence']);
  }
}
