import { CommonModule } from '@angular/common';
import { Component, HostBinding } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { TenantThemeService } from '../core/tenant-theme.service';

/**
 * Outer shell for the Settlement IQ public surface.
 *
 * Wraps the three homeowner screens (Door / Upload / Report) plus the
 * right-to-delete data-request form. Renders a forensic-toned masthead
 * and footer. No portal sidebar, no auth chrome, no app navigation —
 * the homeowner sees one product, not the rest of the RIN platform.
 *
 * @HostBinding applies the tenant brand class to the component's host
 * element, which scopes the CSS-variable tokens defined in the SCSS
 * `:host(.si-tenant-{id})` blocks. Tokens inherit down the tree to
 * every child component without polluting the global document.
 */
@Component({
  selector: 'si-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './settlement-iq-layout.component.html',
  styleUrls: ['./settlement-iq-layout.component.scss'],
})
export class SettlementIqLayoutComponent {
  readonly brand$ = this.theme.brand$;

  constructor(private readonly theme: TenantThemeService) {}

  @HostBinding('class')
  get hostClass(): string {
    // Phase 1: always 'si-tenant-settlement_iq'. Future: read from a
    // tenant resolver service that inspects the request (header,
    // subdomain, or signed brand token).
    return this.theme.current.brandClass;
  }
}
