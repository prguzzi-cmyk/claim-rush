import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Tenant theme + brand resolver.
 *
 * Phase 1 hard-codes a single tenant ('settlement_iq') with the
 * master-brand Settlement IQ values. When tenant #2 (Pax Equitas)
 * onboards, additional entries plug into TENANT_THEMES — and the
 * service exposes a `brandClass` that consumers bind to the layout
 * wrapper for CSS-variable scoping.
 *
 * No CSS variables are written directly to the document root — the
 * tokens are defined in settlement-iq-theme.scss under a scoped
 * `.si-tenant-{id}` class so they don't leak into the rest of the
 * portal.
 */

export interface TenantBrand {
  tenantId: string;
  brandName: string;
  brandTagline: string;
  brandClass: string;          // CSS class applied to the layout wrapper
}

const TENANT_THEMES: Record<string, TenantBrand> = {
  settlement_iq: {
    tenantId: 'settlement_iq',
    brandName: 'Settlement IQ',
    brandTagline: 'Forensic Settlement Analysis',
    brandClass: 'si-tenant-settlement_iq',
  },
  // Reserved for tenant #2 — uncomment + supply matching CSS tokens
  // in settlement-iq-theme.scss when Pax Equitas onboards.
  // pax_equitas: {
  //   tenantId: 'pax_equitas',
  //   brandName: 'Pax Equitas',
  //   brandTagline: 'Settlement Forensics',
  //   brandClass: 'si-tenant-pax_equitas',
  // },
};

const DEFAULT_TENANT = 'settlement_iq';

@Injectable({ providedIn: 'root' })
export class TenantThemeService {
  private readonly current$ = new BehaviorSubject<TenantBrand>(
    TENANT_THEMES[DEFAULT_TENANT],
  );

  readonly brand$: Observable<TenantBrand> = this.current$.asObservable();

  /**
   * Switch the active tenant. Phase 1 only knows 'settlement_iq'; an
   * unknown id logs a warning and leaves the current tenant in place
   * (failure mode: graceful no-op, never blow up the UI).
   */
  setTenant(tenantId: string): void {
    const next = TENANT_THEMES[tenantId];
    if (!next) {
      // eslint-disable-next-line no-console
      console.warn(
        `[settlement-iq] unknown tenant_id ${tenantId}; falling back to ${DEFAULT_TENANT}`,
      );
      return;
    }
    this.current$.next(next);
  }

  get current(): TenantBrand {
    return this.current$.value;
  }
}
