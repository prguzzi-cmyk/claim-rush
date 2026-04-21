import { StatementBranding } from '../models/commission-engine.model';

/**
 * ACI Adjustment Group — branding for commission statements ONLY.
 *
 * Statement branding is deliberately isolated from portal branding:
 *   - Portal chrome (sidebar, login) references its own logo files directly
 *     (assets/logo.png, assets/rin-logo.png — the RIN Portal marks).
 *   - Statements are an official ACI financial document and use assets under
 *     assets/branding/aci/. Swap this file / object to publish statements under
 *     a different brand without touching portal UI.
 */
export const ACI_STATEMENT_BRANDING: StatementBranding = {
  company_name: 'ACI Adjustment Group',
  company_short: 'ACI',
  // Canonical ACI brand mark — hex "A" + "ACI Adjustment Group" wordmark.
  // Master copy lives at ../aci-adjustment-v2-build/public/images/aci-logo-full-light.svg;
  // this file is the bundled mirror so the Angular dev/prod server can serve it.
  logo_path: 'assets/branding/aci/aci-logo-full-light.svg',
  address_lines: [
    'ACI Adjustment Group',
    'Commission Administration',
  ],
  footer_tagline: 'ACI Adjustment Group — Official Commission Statement',
  accent_hex: '#00C2FF',
  contact_email: 'accounting@aciadjustmentgroup.com',
  contact_phone: '',
  ein: '',
};

/** Default brand used when none is supplied. */
export const DEFAULT_STATEMENT_BRANDING: StatementBranding = ACI_STATEMENT_BRANDING;
