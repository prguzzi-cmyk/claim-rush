import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LaunchControlService } from '../../../services/launch-control.service';
import {
  DeploymentStatus,
  EnrollResponse,
  EnrollTerritoryInput,
  LC_READINESS_FILTERS,
  LC_ROLE_FILTERS,
  LaunchControlUser,
  Readiness,
} from '../../../models/launch-control.model';

type RoleFilter = (typeof LC_ROLE_FILTERS)[number];
type ReadinessFilter = (typeof LC_READINESS_FILTERS)[number];
type EnrollRole = 'cp' | 'rvp' | 'agent';
type TerritoryType = 'state' | 'county' | 'zip';

@Component({
  selector: 'app-launch-control',
  templateUrl: './launch-control.component.html',
  styleUrls: ['./launch-control.component.scss'],
  standalone: false,
})
export class LaunchControlComponent implements OnInit {
  readonly roleFilters = LC_ROLE_FILTERS;
  readonly readinessFilters = LC_READINESS_FILTERS;
  readonly roles: EnrollRole[] = ['cp', 'rvp', 'agent'];
  readonly territoryTypes: TerritoryType[] = ['state', 'county', 'zip'];

  rows: LaunchControlUser[] = [];
  loading = false;

  // Set when /v1/launch-control/users returns 401 / 403 so the UI can
  // show a clear "Admin login required" notice instead of an empty list.
  authError: 'unauthenticated' | 'forbidden' | null = null;

  roleFilter: RoleFilter = 'all';
  readinessFilter: ReadinessFilter = 'all';

  deploying: Record<string, boolean> = {};
  deleting: Record<string, boolean> = {};

  // Enrollment form (inline, replaces the legacy dialog).
  form: FormGroup;
  saving = false;
  enrollError: string | null = null;

  // Latest deployment result. Cleared on "Enroll another"; persists otherwise
  // so the operator can re-copy links after refreshing the table.
  result: EnrollResponse | null = null;

  constructor(
    private fb: FormBuilder,
    private svc: LaunchControlService,
    private snack: MatSnackBar,
    private router: Router,
  ) {
    this.form = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['cp' as EnrollRole, Validators.required],
      manager_email: [''],
      territories: this.fb.array([this.buildTerritoryGroup()]),
      password: [''],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  // ──────────────────────────────────────────────────────────────────
  // Data load
  // ──────────────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;
    this.authError = null;
    this.svc.list().subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        // The global ErrorInterceptor wraps HttpErrorResponse into a plain
        // Error("Unauthorized : ...") — no `.status` survives — so we
        // detect auth failures by message pattern AND by the absence of
        // a token in localStorage. Either way the UI shows the
        // "Admin login required" notice instead of a blank table.
        const msg = (err?.message || err?.statusText || '').toString();
        const status = err?.status;  // present when an inner branch passed the raw HttpErrorResponse
        const noToken = !localStorage.getItem('access_token');
        const looksUnauth = status === 401 || /Unauthorized/i.test(msg) || noToken;
        const looksForbidden = status === 403 || /Forbidden/i.test(msg);

        if (looksUnauth) {
          this.authError = 'unauthenticated';
        } else if (looksForbidden) {
          this.authError = 'forbidden';
        } else {
          this.snack.open('Failed to load Launch Control users', 'Dismiss', { duration: 3000 });
        }
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Enrollment form (FormArray-backed territories)
  // ──────────────────────────────────────────────────────────────────

  get territories(): FormArray {
    return this.form.get('territories') as FormArray;
  }

  territoryGroupAt(i: number): FormGroup {
    return this.territories.at(i) as FormGroup;
  }

  private buildTerritoryGroup(): FormGroup {
    return this.fb.group({
      territory_type: ['state' as TerritoryType, Validators.required],
      value: ['', Validators.required],
    });
  }

  addTerritory(): void {
    this.territories.push(this.buildTerritoryGroup());
  }

  removeTerritory(i: number): void {
    if (this.territories.length <= 1) return;
    this.territories.removeAt(i);
  }

  /** Possible upline candidates surfaced in the dropdown. CPs and RVPs are
   *  the realistic upline pool; Agents are excluded so the menu stays
   *  meaningful. Empty until the table loads. */
  get uplineCandidates(): LaunchControlUser[] {
    return this.rows.filter((r) => r.role === 'cp' || r.role === 'rvp');
  }

  enroll(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const cleaned: EnrollTerritoryInput[] = [];

    for (let i = 0; i < this.territories.length; i++) {
      const t = this.territories.at(i).value;
      const ttype = t.territory_type as TerritoryType;
      const raw = (t.value || '').trim();
      if (!raw) {
        this.enrollError = `Territory #${i + 1}: value is required.`;
        return;
      }

      const input: EnrollTerritoryInput = {
        territory_type: ttype, state: null, county: null, zip_code: null,
      };

      if (ttype === 'state') {
        input.state = raw.toUpperCase().slice(0, 2);
      } else if (ttype === 'county') {
        // Accept "PA · Bucks", "PA, Bucks", "PA Bucks", or "Bucks" (no state).
        const parts = raw.split(/[·,]/).map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          input.state = parts[0].toUpperCase().slice(0, 2);
          input.county = parts.slice(1).join(' ');
        } else {
          this.enrollError = `Territory #${i + 1}: enter county as "PA · Bucks" (state then county).`;
          return;
        }
      } else {
        input.zip_code = raw.replace(/\D/g, '').slice(0, 10);
        if (!input.zip_code) {
          this.enrollError = `Territory #${i + 1}: ZIP is required.`;
          return;
        }
      }

      cleaned.push(input);
    }

    this.enrollError = null;
    this.saving = true;
    this.svc
      .enroll({
        full_name: v.full_name.trim(),
        email: v.email.trim(),
        role: v.role,
        manager_email: (v.manager_email || '').trim() || null,
        territories: cleaned,
        password: (v.password || '').trim() || null,
      })
      .subscribe({
        next: (resp) => {
          this.result = resp;
          this.saving = false;
          this.snack.open(`${resp.name} deployed`, 'OK', { duration: 2000 });
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.enrollError = err?.error?.detail || 'Enrollment failed. Please try again.';
        },
      });
  }

  resetForAnother(): void {
    this.result = null;
    this.enrollError = null;
    this.form.reset({
      full_name: '', email: '', role: 'cp', manager_email: '', password: '',
    });
    while (this.territories.length > 1) this.territories.removeAt(1);
    this.territoryGroupAt(0).reset({ territory_type: 'state', value: '' });
  }

  // ──────────────────────────────────────────────────────────────────
  // URL derivation — community/client-login URLs aren't on the API, so
  // we compose them from the host of the URLs that are.
  // ──────────────────────────────────────────────────────────────────

  private originOf(...candidates: (string | null | undefined)[]): string {
    for (const c of candidates) {
      if (!c) continue;
      try { return new URL(c).origin; } catch { /* ignore */ }
    }
    return window.location.origin;
  }

  /** Single source of truth for /community/:slug URLs.
   *  Always uses the live frontend origin (where the SPA is served) — never
   *  any backend-stamped URL field, which is bare `http://localhost` in dev
   *  and would 404 / connection-refused. */
  private communityUrlForSlug(slug: string | null | undefined): string | null {
    if (!slug) return null;
    return `${window.location.origin}/community/${slug}`;
  }

  /** /claim/:slug is also an Angular SPA route, served by the dev/prod
   *  frontend host — same reasoning as communityUrlForSlug. The backend
   *  stamps `intake_url` / `client_intake_url` with SERVER_HOST (bare
   *  `http://localhost` in dev = port 80 = ERR_CONNECTION_REFUSED). */
  private intakeUrlForSlug(slug: string | null | undefined): string | null {
    if (!slug) return null;
    return `${window.location.origin}/claim/${slug}`;
  }

  websiteUrlFromResult(r: EnrollResponse): string {
    return this.communityUrlForSlug(r?.intake_slug) || '';
  }

  /** Template-facing helper for the result card's "Intake URL" row. */
  intakeUrlForResult(r: EnrollResponse | null): string | null {
    return this.intakeUrlForSlug(r?.intake_slug);
  }

  clientLoginUrlFromResult(_r: EnrollResponse): string {
    return `${window.location.origin}/client-login`;
  }

  websiteUrlFor(row: LaunchControlUser): string | null {
    return this.communityUrlForSlug(row?.personal_landing_slug);
  }

  // ──────────────────────────────────────────────────────────────────
  // Deployment-result actions
  // ──────────────────────────────────────────────────────────────────

  openWebsite(): void {
    if (!this.result) return;
    const url = this.communityUrlForSlug(this.result.intake_slug);
    // Diagnostic: surface the URL in DevTools so the operator can confirm
    // the live click is using the frontend origin (never bare localhost).
    console.info('[LC] Open Website →', url);
    if (url) window.open(url, '_blank', 'noopener');
  }

  openIntake(): void {
    const url = this.intakeUrlForSlug(this.result?.intake_slug);
    if (url) window.open(url, '_blank', 'noopener');
  }

  openPartnerPortal(): void {
    if (!this.result?.login_url) return;
    window.open(this.result.login_url, '_blank', 'noopener');
  }

  openClientPortal(): void {
    if (!this.result) return;
    window.open(this.clientLoginUrlFromResult(this.result), '_blank', 'noopener');
  }

  copyLoginInfo(): void {
    if (!this.result) return;
    const r = this.result;
    const passwordLine = r.temporary_password
      ? `Temporary password:  ${r.temporary_password}`
      : `Temporary password:  (not returned — reset password required)`;
    const summary =
      `Name:                ${r.name}\n` +
      `Role:                ${r.role.toUpperCase()}\n` +
      `Login email:         ${r.login_email}\n` +
      `${passwordLine}\n` +
      `Website URL:         ${this.websiteUrlFromResult(r)}\n` +
      `Intake URL:          ${this.intakeUrlForSlug(r.intake_slug) || '(none)'}\n` +
      `Partner Portal URL:  ${r.login_url}\n` +
      `ClaimRush portal:    ${r.portal_url || '(none)'}\n` +
      `Client Portal URL:   ${this.clientLoginUrlFromResult(r)}\n`;
    navigator.clipboard?.writeText(summary).then(
      () => this.snack.open('Login info copied', 'OK', { duration: 2000 }),
      () => this.snack.open('Could not copy', 'Dismiss', { duration: 2500 }),
    );
  }

  resultTerritoryList(r: EnrollResponse): string {
    if (r.territories?.length) return r.territories.map((t) => t.value).join(', ');
    const parts: string[] = [];
    if (r.territory_state) parts.push(r.territory_state);
    if (r.territory_county) parts.push(r.territory_county);
    if (r.territory_zip) parts.push(r.territory_zip);
    return parts.join(' · ') || r.territory_type;
  }

  // ──────────────────────────────────────────────────────────────────
  // Existing-users table
  // ──────────────────────────────────────────────────────────────────

  get filteredRows(): LaunchControlUser[] {
    return this.rows.filter((r) => {
      if (this.roleFilter !== 'all' && r.role !== this.roleFilter) return false;
      if (this.readinessFilter !== 'all' && r.readiness !== this.readinessFilter) return false;
      return true;
    });
  }

  kpi(role: 'cp' | 'rvp' | 'agent'): number {
    return this.rows.filter((r) => r.role === role).length;
  }

  readinessKpi(state: Readiness): number {
    return this.rows.filter((r) => r.readiness === state).length;
  }

  readinessLabel(state: Readiness): string {
    if (state === 'ready') return 'Ready';
    if (state === 'missing_setup') return 'Missing Setup';
    if (state === 'broken') return 'Broken';
    return state;
  }

  readinessClass(state: Readiness): string {
    return `r-${state}`;
  }

  deploymentClass(state: DeploymentStatus): string {
    return `d-${state}`;
  }

  deploymentLabel(state: DeploymentStatus): string {
    if (state === 'broken') return 'Broken';
    if (state === 'not_ready') return 'Not Ready';
    if (state === 'ready') return 'Ready';
    if (state === 'deployed') return 'Deployed';
    return state;
  }

  territorySummary(row: LaunchControlUser): string {
    if (!row.territories.length) return '—';
    if (row.territories.length === 1) return row.territories[0].name;
    const head = row.territories.slice(0, 2).map((t) => t.name).join(', ');
    const extra = row.territories.length - 2;
    return extra > 0 ? `${head} +${extra}` : head;
  }

  canOpenPortal(row: LaunchControlUser): boolean {
    return row.deployment_status === 'deployed' && !!row.portal_url;
  }

  openWebsiteFor(row: LaunchControlUser): void {
    const url = this.communityUrlForSlug(row.personal_landing_slug);
    console.info('[LC] Open Website (table) →', url);
    if (!url) {
      this.snack.open('No public website yet — user has no intake slug.', 'Dismiss', { duration: 3000 });
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  openPortalFor(row: LaunchControlUser): void {
    if (!this.canOpenPortal(row)) {
      this.snack.open('Deploy the user before opening the portal.', 'Dismiss', { duration: 3000 });
      return;
    }
    this.router.navigate(['/app/portal', row.user_id]);
  }

  /** Open the row's intake URL in a new tab. The slug is the source of
   *  truth — composing from window.location.origin guarantees the URL
   *  resolves on the same host the operator is using right now. */
  openIntakeFor(row: LaunchControlUser): void {
    const url = this.intakeUrlForSlug(row.personal_landing_slug);
    if (!url) {
      this.snack.open('No intake URL — user has no slug yet.', 'Dismiss', { duration: 2500 });
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  /** Open the partner portal login (the row.login_url is the absolute
   *  /login URL stamped at deploy time). */
  openPartnerPortalFor(row: LaunchControlUser): void {
    if (!row.login_url) return;
    window.open(row.login_url, '_blank', 'noopener');
  }

  /** Copy the row's credentials + URLs to clipboard. The temporary
   *  password is only available at enrollment-time on the EnrollResponse
   *  — once the row is in the active roster it's no longer in memory or
   *  the API, so the clipboard line says so plainly. */
  copyLoginInfoForRow(row: LaunchControlUser): void {
    const websiteUrl = this.communityUrlForSlug(row.personal_landing_slug) || '(none)';
    const intakeUrl  = this.intakeUrlForSlug(row.personal_landing_slug)    || '(none)';
    const summary =
      `Name:                ${row.name}\n` +
      `Role:                ${row.role.toUpperCase()}\n` +
      `Login email:         ${row.email}\n` +
      `Temporary password:  (only available at enrollment — request a reset)\n` +
      `Website URL:         ${websiteUrl}\n` +
      `Intake URL:          ${intakeUrl}\n` +
      `Partner Portal URL:  ${row.login_url || '(none)'}\n` +
      `ClaimRush portal:    ${row.portal_url || '(not yet deployed)'}\n`;
    navigator.clipboard?.writeText(summary).then(
      () => this.snack.open(`Login info copied for ${row.name}`, 'OK', { duration: 2000 }),
      () => this.snack.open('Could not copy', 'Dismiss', { duration: 2500 }),
    );
  }

  /** Soft-deactivate (effectively "delete from Launch Control") with a
   *  confirm dialog. Backend keeps leads/claims intact — only flips
   *  is_active=false so the user drops from the active roster. */
  deleteUser(row: LaunchControlUser): void {
    if (this.deleting[row.user_id]) return;
    const ok = window.confirm(
      `Delete ${row.name} from Launch Control?\n\n` +
      `This will deactivate the user and remove them from the active roster.\n` +
      `Their leads, claims, and territory history are preserved.\n\n` +
      `This action can be reversed by re-enrolling the same email.`,
    );
    if (!ok) return;

    this.deleting[row.user_id] = true;
    this.svc.deactivate(row.user_id).subscribe({
      next: () => {
        this.deleting[row.user_id] = false;
        this.rows = this.rows.filter((r) => r.user_id !== row.user_id);
        this.snack.open(`${row.name} removed from Launch Control`, 'OK', { duration: 2500 });
      },
      error: (err) => {
        this.deleting[row.user_id] = false;
        const detail = err?.error?.detail || 'Could not delete user.';
        this.snack.open(detail, 'Dismiss', { duration: 4000 });
      },
    });
  }
}
