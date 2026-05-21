import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface OwnerTerritory {
  territory_type: string;   // 'state' | 'county' | 'zip' | 'custom'
  state: string | null;
  county: string | null;
  zip_code: string | null;
  value: string;            // display label, e.g. 'PA' / 'PA · Bucks' / '18901'
}

interface IntakePublicResponse {
  slug: string;
  intake_name: string;
  is_active: boolean;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_role: string | null;
  // Partner profile photo. Optional; when missing, the partner card
  // falls back to initials so the layout stays intact.
  owner_image_url?: string | null;
  territory_state: string | null;
  territory_county: string | null;
  territory_label: string | null;
  owner_territories?: OwnerTerritory[];
  form_url: string;
}

// USPS code → full state name. Drives SEO copy ("Pennsylvania homeowners"
// reads better than "PA homeowners" for both search engines and trust).
const _STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

interface FaqItem { q: string; a: string; }

@Component({
  selector: 'app-community-landing',
  templateUrl: './community-landing.component.html',
  styleUrls: ['./community-landing.component.scss'],
  standalone: false,
})
export class CommunityLandingComponent implements OnInit, AfterViewInit, OnDestroy {
  slug = '';
  loading = true;
  notFound = false;
  intake: IntakePublicResponse | null = null;

  // Snapshot of body/html overflow + height styles before this component
  // forces native page scroll. Restored on destroy so the RIN app shell —
  // which sets `body { overflow: hidden }` for its fixed-viewport layout —
  // is unaffected once the visitor leaves this public page.
  private _origBodyOverflow = '';
  private _origHtmlOverflow = '';
  private _origBodyHeight = '';
  private _origHtmlHeight = '';
  private _origAppRootHeight = '';
  private _origAppRootOverflow = '';
  private _revealObserver?: IntersectionObserver;

  readonly faqs: FaqItem[] = [
    { q: 'Do I have to pay anything to submit a claim through UPA?',
      a: 'No. Submitting a claim through your local UPA Community Partner is free. Public advocates are paid only when your claim is settled, and the standard fee structure is fully disclosed in writing before any work begins.' },
    { q: 'Why do I need a public advocate when I already have an insurance adjuster?',
      a: 'Insurance company adjusters work for the insurance company. A UPA Community Partner works for the homeowner — documenting damage, interpreting policy language, and negotiating a fair settlement on your behalf.' },
    { q: 'What kinds of property damage does UPA help with?',
      a: 'Fire damage, water damage, storm damage (wind, hail, hurricane, tornado), and other covered property losses. If you are not sure whether your loss is covered, submit the claim form and your local Community Partner will review the policy with you.' },
    { q: 'How fast will I hear back after I submit a claim?',
      a: 'Most homeowners are contacted within one business day. Submissions are routed directly to the UPA Community Partner who serves your territory.' },
    { q: 'Can I track the status of my claim online?',
      a: 'A homeowner-facing claim status portal is in development. For now your Community Partner will provide updates by phone, email, or text — and a written progress report is provided at each major milestone.' },
  ];

  readonly processSteps = [
    { n: '01', t: 'You submit the claim form', d: 'A short form captures your name, address, phone, and damage type.' },
    { n: '02', t: 'Your local Community Partner reviews', d: 'A real person — not a call center — reviews the submission and contacts you within one business day.' },
    { n: '03', t: 'We document the damage', d: 'On-site inspection, photo and policy documentation, and a written scope of damages.' },
    { n: '04', t: 'We negotiate with the insurance company', d: 'Your advocate handles correspondence, supplements, and settlement negotiations on your behalf.' },
    { n: '05', t: 'You receive a fair settlement', d: 'You stay informed at every milestone. UPA only earns a fee when your claim is settled.' },
  ];

  readonly damageTypes = [
    { icon: '🔥', t: 'Fire damage claims', d: 'Smoke, soot, and structural fire loss — including total loss and contents.' },
    { icon: '💧', t: 'Water damage claims', d: 'Burst pipes, appliance failures, roof leaks, and mold remediation coverage.' },
    { icon: '🌪️', t: 'Storm damage claims', d: 'Wind, hail, hurricane, tornado, and lightning losses on roofs, siding, and structures.' },
    { icon: '🏚️', t: 'Property damage documentation', d: 'Scope-of-damages reports, contents inventory, and policy interpretation.' },
  ];

  readonly howWeHelp = [
    { icon: '🛡️', t: 'Advocacy on your side', d: 'Your insurance company has its own adjuster. We make sure you have one too.' },
    { icon: '📋', t: 'Damage documentation', d: 'Photos, scope sheets, and policy review — written records carriers respect.' },
    { icon: '🤝', t: 'Negotiation, not paperwork', d: 'We handle the back-and-forth so homeowners can focus on getting their lives back.' },
    { icon: '📞', t: 'Local point of contact', d: 'A real person in your territory — never a call-center menu.' },
  ];

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    // Free up native page scroll for this public page. The RIN shell pins
    // body/html/app-root to viewport height + `overflow: hidden` for its
    // pane layout — releasing **both** overflow AND height is required,
    // because clearing only overflow leaves the body clamped to 100vh and
    // `window.scrollTo` becomes a no-op even though content is 6 000 px.
    const body = document.body;
    const html = document.documentElement;
    const appRoot = document.querySelector('app-root') as HTMLElement | null;
    this._origBodyOverflow = body.style.overflow;
    this._origHtmlOverflow = html.style.overflow;
    this._origBodyHeight = body.style.height;
    this._origHtmlHeight = html.style.height;
    body.style.overflow = 'visible';
    html.style.overflow = 'visible';
    body.style.height = 'auto';
    html.style.height = 'auto';
    if (appRoot) {
      this._origAppRootHeight = appRoot.style.height;
      this._origAppRootOverflow = appRoot.style.overflow;
      appRoot.style.height = 'auto';
      appRoot.style.overflow = 'visible';
    }

    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    if (!this.slug) {
      this.loading = false;
      this.notFound = true;
      return;
    }
    this.http.get<IntakePublicResponse>(`intake/${this.slug}`).subscribe({
      next: (resp) => {
        this.intake = resp;
        this.loading = false;
        setTimeout(() => this._attachRevealObserver(), 0);
      },
      error: () => {
        this.loading = false;
        this.notFound = true;
      },
    });
  }

  ngAfterViewInit(): void {
    // Reveal-on-scroll. Any element marked `.reveal` starts hidden + slightly
    // translated (CSS in the SCSS file) and slides into place when it enters
    // the viewport. We poll once after a tick so dynamic content (e.g. the
    // intake fetch) has flushed before the observer attaches.
    setTimeout(() => this._attachRevealObserver(), 60);
  }

  private _attachRevealObserver(): void {
    if (this._revealObserver) {
      this._revealObserver.disconnect();
    }
    if (typeof IntersectionObserver === 'undefined') return;

    const targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;

    this._revealObserver = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    targets.forEach((el) => this._revealObserver!.observe(el));
  }

  ngOnDestroy(): void {
    // Restore the shell's scroll model so the rest of the app keeps its
    // pane-based layout intact.
    document.body.style.overflow = this._origBodyOverflow;
    document.documentElement.style.overflow = this._origHtmlOverflow;
    document.body.style.height = this._origBodyHeight;
    document.documentElement.style.height = this._origHtmlHeight;
    const appRoot = document.querySelector('app-root') as HTMLElement | null;
    if (appRoot) {
      appRoot.style.height = this._origAppRootHeight;
      appRoot.style.overflow = this._origAppRootOverflow;
    }
    this._revealObserver?.disconnect();
  }

  get roleLabel(): string {
    const r = (this.intake?.owner_role || '').toLowerCase();
    if (r === 'cp') return 'Community Partner';
    if (r === 'rvp') return 'Regional Vice President';
    if (r === 'agent' || r === 'adjuster') return 'Adjuster';
    return this.intake?.owner_role || 'Representative';
  }

  /** Public-facing role headline shown to homeowners. Always reads
   *  "UPA Community Partner" so the brand leads, not the internal title. */
  get publicRoleTitle(): string {
    return 'UPA Community Partner';
  }

  /** Internal hierarchy title shown muted underneath the public role —
   *  surfaces structure without making it dominate the homeowner page.
   *  CP → Chapter President, RVP → Regional Vice President, Agent → Field Agent. */
  get internalRoleTitle(): string {
    const r = (this.intake?.owner_role || '').toLowerCase();
    if (r === 'cp') return 'Chapter President';
    if (r === 'rvp') return 'Regional Vice President';
    if (r === 'agent' || r === 'adjuster') return 'Field Agent';
    return this.intake?.owner_role || '';
  }

  // Distinct USPS state codes the slug owner serves, in priority order.
  // Pulled from owner_territories when present; falls back to the legacy
  // single territory_state field for older API responses.
  private get serviceStateCodes(): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of this.intake?.owner_territories || []) {
      const code = (t.state || '').toUpperCase();
      if (code && !seen.has(code)) { seen.add(code); out.push(code); }
    }
    if (out.length === 0) {
      const fallback = (this.intake?.territory_state || '').toUpperCase();
      if (fallback) out.push(fallback);
    }
    return out;
  }

  // "PA, NJ, NY" for SEO copy / hero subhead. Empty when no states known.
  get serviceStateCodeList(): string {
    return this.serviceStateCodes.join(', ');
  }

  // "Pennsylvania, New Jersey, and New York" — used in long-form copy.
  get stateName(): string {
    const codes = this.serviceStateCodes;
    if (codes.length === 0) {
      return this.intake?.territory_label || 'your area';
    }
    const names = codes.map((c) => _STATE_NAMES[c] || c);
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }

  // Short hero pill: "Serving PA, NJ, NY" — falls back to single-state copy.
  get servingHeadline(): string {
    const list = this.serviceStateCodeList;
    return list ? `Serving ${list}` : `Serving ${this.stateName}`;
  }

  get partnerLine(): string {
    const name = this.intake?.owner_name || 'your local representative';
    return `${this.servingHeadline} through ${name}, UPA ${this.roleLabel}`;
  }

  get serviceAreaPills(): string[] {
    // Five canonical pills the page always shows. Per-state pills are no
    // longer mixed in here — the section header "Serving {state}…" already
    // surfaces the territory; pills cover the practice areas only.
    return [
      'Fire damage claims',
      'Water damage claims',
      'Storm damage claims',
      'Property damage documentation',
      'Public advocacy',
    ];
  }

  /** Three trust items shown directly under the hero CTA buttons. */
  readonly heroTrust: readonly string[] = [
    'No fee unless your claim settles',
    'Local advocate — not a call center',
    'We handle the insurance company',
  ];

  /** Three bullets shown inside the hero partner card on the right. */
  readonly partnerCardBullets: readonly string[] = [
    'Documentation, not paperwork',
    'Local — not a call center',
    'No fee unless you win',
  ];

  get heroSubheadline(): string {
    return 'Helping homeowners navigate property insurance claims with clarity, documentation, and advocacy.';
  }

  get partnerInitials(): string {
    const parts = (this.intake?.owner_name || 'UPA').split(' ').filter((p) => p);
    const initials = parts.map((p) => p[0] || '').join('');
    return (initials || 'U').slice(0, 2).toUpperCase();
  }

  /** Smooth-scroll to an in-page section.
   *  We can't use plain `href="#section"` anchors because the SPA runs
   *  under HashLocationStrategy — the router would interpret `#section`
   *  as a route, fail to match, and bounce the user back into the RIN
   *  dashboard. So every in-page nav link calls this instead and skips
   *  the default anchor navigation entirely. */
  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get claimUrl(): string {
    return `/claim/${this.slug}`;
  }
  // Settlement IQ — alternate funnel for homeowners whose claim is
  // already settled. The `rep` query param ties scans to this same
  // landing-page rep so resulting leads route to the same owner.
  // The Settlement IQ destination carries its own brand palette; this
  // landing card stays in the UPA palette.
  get settlementIqUrl(): string {
    return `/settlement-iq/residential?rep=${this.slug}`;
  }
  // Partner Portal (CP / RVP / Agent) — feeds straight into RIN auth.
  get loginUrl(): string {
    return `/#/login`;
  }
  // Homeowner-facing sign-in. Separate from Partner Portal so a client
  // never lands on the RIN dashboard.
  get clientLoginUrl(): string {
    return `/client-login`;
  }
}
