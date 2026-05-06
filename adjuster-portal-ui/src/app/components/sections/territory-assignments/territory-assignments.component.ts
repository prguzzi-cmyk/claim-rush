import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TerritoryAssignmentsService } from '../../../services/territory-assignments.service';
import { LeadRoutingSettingsService } from '../../../services/lead-routing-settings.service';
import {
  ASSIGNABLE_ROLES,
  AssignableRole,
  AssignableUser,
  CoverageGaps,
  HierarchyState,
  TERRITORY_TYPES,
  TerritoryAssignment,
  TerritoryAssignmentCreate,
  TerritoryKpi,
  TerritoryType,
  TestRoutingResponse,
  US_STATES,
} from '../../../models/territory-assignment.model';
import {
  LEAD_SOURCES,
  LeadRoutingSettings,
  LeadRoutingSettingsUpsert,
  ROUTING_MODES,
  RoutingMode,
} from '../../../models/lead-routing-settings.model';

@Component({
  selector: 'app-territory-assignments',
  templateUrl: './territory-assignments.component.html',
  styleUrls: ['./territory-assignments.component.scss'],
  standalone: false,
})
export class TerritoryAssignmentsComponent implements OnInit {
  // Reference data ----------------------------------------------------------
  readonly assignableRoles = ASSIGNABLE_ROLES;
  readonly territoryTypes: TerritoryType[] = TERRITORY_TYPES;
  readonly states = US_STATES;
  readonly leadSources = LEAD_SOURCES;
  readonly routingModes: RoutingMode[] = ROUTING_MODES;

  // Loaded data -------------------------------------------------------------
  kpi: TerritoryKpi | null = null;
  hierarchy: HierarchyState[] = [];
  gaps: CoverageGaps | null = null;
  assignments: TerritoryAssignment[] = [];
  usersByRole: Record<string, AssignableUser[]> = { cp: [], rvp: [], agent: [] };
  routingRows: LeadRoutingSettings[] = [];
  testResult: TestRoutingResponse | null = null;

  // UI state ----------------------------------------------------------------
  loadingHierarchy = false;
  loadingAssignments = false;
  loadingUsersForRole: Record<string, boolean> = { cp: false, rvp: false, agent: false, admin: false };
  saving = false;
  savingRouting = false;
  testing = false;
  expanded: Record<string, boolean> = {};

  // Forms -------------------------------------------------------------------
  assignForm: FormGroup;
  routingForm: FormGroup;
  testForm: FormGroup;

  // Computed county options derived from current hierarchy + selected state
  get countiesForSelectedState(): string[] {
    const state = (this.assignForm?.value?.state || '').toUpperCase();
    if (!state) return [];
    const node = this.hierarchy.find((s) => s.state === state);
    if (!node) return [];
    return node.counties
      .map((c) => c.county)
      .filter((c) => c && c !== '(ZIPs)' && c !== '(unknown)')
      .sort();
  }

  get usersForAssignRole(): AssignableUser[] {
    const role = this.assignForm?.value?.role;
    return role ? (this.usersByRole[role] || []) : [];
  }

  get fallbackUserOptions(): AssignableUser[] {
    return [
      ...(this.usersByRole['admin'] || []),
      ...(this.usersByRole['cp'] || []),
      ...(this.usersByRole['rvp'] || []),
      ...(this.usersByRole['agent'] || []),
    ];
  }

  constructor(
    private svc: TerritoryAssignmentsService,
    private routingSvc: LeadRoutingSettingsService,
    private fb: FormBuilder,
    private snack: MatSnackBar,
  ) {
    this.assignForm = this.fb.group({
      role: ['cp' as AssignableRole, Validators.required],
      user_id: ['', Validators.required],
      territory_type: ['state' as TerritoryType, Validators.required],
      state: [''],
      county: [''],
      zip_code: [''],
      name: [''],
      priority: [100, [Validators.required, Validators.min(0)]],
      is_active: [true],
    });

    this.routingForm = this.fb.group({
      lead_source: ['all', Validators.required],
      routing_mode: ['hybrid' as RoutingMode, Validators.required],
      fallback_owner_id: [''],
      fallback_queue: ['house', Validators.required],
      is_active: [true],
    });

    this.testForm = this.fb.group({
      lead_source: ['fire', Validators.required],
      state: ['PA'],
      county: ['Bucks'],
      zip_code: [''],
    });
  }

  ngOnInit(): void {
    this.refreshAll();
    // Re-fetch the user list whenever the Owner Role dropdown changes so the
    // Owner User dropdown is never stale, and clear any prior selection so
    // the form doesn't carry over a user from a different role.
    this.assignForm.get('role')!.valueChanges.subscribe((role: AssignableRole) => {
      this.assignForm.patchValue({ user_id: '' }, { emitEvent: false });
      if (role) this.loadUsersForRole(role);
    });
  }

  // Bulk loaders ------------------------------------------------------------

  refreshAll(): void {
    this.loadKpi();
    this.loadHierarchy();
    this.loadGaps();
    this.loadAssignments();
    this.loadRouting();
    this.loadUsers();
  }

  private loadKpi(): void {
    this.svc.kpi().subscribe({
      next: (k) => (this.kpi = k),
      error: () => this.snack.open('Failed to load KPI', 'Dismiss', { duration: 3000 }),
    });
  }

  private loadHierarchy(): void {
    this.loadingHierarchy = true;
    this.svc.hierarchy().subscribe({
      next: (h) => {
        this.hierarchy = h;
        this.loadingHierarchy = false;
      },
      error: () => {
        this.loadingHierarchy = false;
        this.snack.open('Failed to load hierarchy', 'Dismiss', { duration: 3000 });
      },
    });
  }

  private loadGaps(): void {
    this.svc.coverageGaps().subscribe({
      next: (g) => (this.gaps = g),
      error: () => {},
    });
  }

  private loadAssignments(): void {
    this.loadingAssignments = true;
    this.svc.list().subscribe({
      next: (rows) => {
        this.assignments = rows;
        this.loadingAssignments = false;
      },
      error: () => {
        this.loadingAssignments = false;
        this.snack.open('Failed to load assignments', 'Dismiss', { duration: 3000 });
      },
    });
  }

  private loadRouting(): void {
    this.routingSvc.list().subscribe({
      next: (rows) => {
        this.routingRows = rows.sort((a, b) => a.lead_source.localeCompare(b.lead_source));
      },
      error: () => {},
    });
  }

  private loadUsers(): void {
    for (const role of ['cp', 'rvp', 'agent', 'admin']) {
      this.loadUsersForRole(role);
    }
  }

  private loadUsersForRole(role: string): void {
    this.loadingUsersForRole[role] = true;
    this.svc.listUsers(role).subscribe({
      next: (us) => {
        this.usersByRole[role] = us;
        this.loadingUsersForRole[role] = false;
      },
      error: () => {
        this.usersByRole[role] = [];
        this.loadingUsersForRole[role] = false;
      },
    });
  }

  // Used by the template's empty-state line.
  isLoadingUsersForSelectedRole(): boolean {
    const role = this.assignForm?.value?.role;
    return !!role && !!this.loadingUsersForRole[role];
  }

  // Hierarchy tree helpers --------------------------------------------------

  toggle(key: string): void {
    this.expanded[key] = !this.expanded[key];
  }

  isOpen(key: string): boolean {
    return !!this.expanded[key];
  }

  ownerLabel(owners: { display_name: string; role: string | null }[]): string {
    if (!owners.length) return 'Unassigned';
    return owners.map((o) => o.display_name).join(', ');
  }

  ownerRoles(owners: { role: string | null }[]): string[] {
    return owners.map((o) => (o.role || 'user').toUpperCase());
  }

  // Assign form -----------------------------------------------------------

  onTerritoryTypeChange(): void {
    // Clear fields irrelevant to the chosen type so the form sends a clean body.
    const t: TerritoryType = this.assignForm.value.territory_type;
    if (t !== 'state' && t !== 'county') this.assignForm.patchValue({ state: '' });
    if (t !== 'county') this.assignForm.patchValue({ county: '' });
    if (t !== 'zip') this.assignForm.patchValue({ zip_code: '' });
    if (t !== 'custom') this.assignForm.patchValue({ name: '' });
  }

  saveAssignment(): void {
    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      return;
    }
    const v = this.assignForm.value;
    const body: TerritoryAssignmentCreate = {
      user_id: v.user_id,
      territory_type: v.territory_type,
      state: (v.state || '').trim().toUpperCase() || null,
      county: (v.county || '').trim() || null,
      zip_code: (v.zip_code || '').trim() || null,
      name: (v.name || '').trim() || null,
      priority: Number(v.priority) || 100,
      is_active: !!v.is_active,
    };

    this.saving = true;
    this.svc.create(body).subscribe({
      next: () => {
        this.saving = false;
        this.snack.open('Assignment saved', 'OK', { duration: 2500 });
        this.assignForm.patchValue({ user_id: '' });
        this.loadAssignments();
        this.loadHierarchy();
        this.loadKpi();
        this.loadGaps();
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.detail || 'Failed to save assignment';
        this.snack.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }

  // Existing assignments table actions --------------------------------------

  toggleActive(row: TerritoryAssignment): void {
    this.svc.update(row.id, { is_active: !row.is_active }).subscribe({
      next: (updated) => {
        const idx = this.assignments.findIndex((r) => r.id === updated.id);
        if (idx >= 0) this.assignments[idx] = updated;
        this.loadKpi();
        this.loadGaps();
      },
      error: (err) => this.snack.open(err?.error?.detail || 'Update failed', 'Dismiss', { duration: 3500 }),
    });
  }

  changePriority(row: TerritoryAssignment, value: string): void {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0 || next === row.priority) return;
    this.svc.update(row.id, { priority: next }).subscribe({
      next: (updated) => {
        const idx = this.assignments.findIndex((r) => r.id === updated.id);
        if (idx >= 0) this.assignments[idx] = updated;
      },
      error: (err) => this.snack.open(err?.error?.detail || 'Update failed', 'Dismiss', { duration: 3500 }),
    });
  }

  removeAssignment(row: TerritoryAssignment): void {
    if (!confirm(`Remove ${row.user_email || row.user_id} from ${row.territory_name}?`)) return;
    this.svc.remove(row.id).subscribe({
      next: () => {
        this.assignments = this.assignments.filter((r) => r.id !== row.id);
        this.loadHierarchy();
        this.loadKpi();
        this.loadGaps();
        this.snack.open('Removed', 'OK', { duration: 2000 });
      },
      error: (err) => this.snack.open(err?.error?.detail || 'Failed to remove', 'Dismiss', { duration: 3500 }),
    });
  }

  // Lead Deployment panel ---------------------------------------------------

  editRouting(row: LeadRoutingSettings): void {
    this.routingForm.patchValue({
      lead_source: row.lead_source,
      routing_mode: row.routing_mode,
      fallback_owner_id: row.fallback_owner_id ?? '',
      fallback_queue: row.fallback_queue,
      is_active: row.is_active,
    });
  }

  saveRouting(): void {
    if (this.routingForm.invalid) {
      this.routingForm.markAllAsTouched();
      return;
    }
    const v = this.routingForm.value;
    const leadSource: string = (v.lead_source || '').trim();
    const body: LeadRoutingSettingsUpsert = {
      lead_source: leadSource,
      routing_mode: v.routing_mode,
      fallback_owner_id: v.fallback_owner_id || null,
      fallback_queue: v.fallback_queue || 'house',
      is_active: !!v.is_active,
    };
    this.savingRouting = true;
    this.routingSvc.upsert(leadSource, body).subscribe({
      next: () => {
        this.savingRouting = false;
        this.snack.open(`Saved routing for '${leadSource}'`, 'OK', { duration: 2500 });
        this.loadRouting();
      },
      error: (err) => {
        this.savingRouting = false;
        this.snack.open(err?.error?.detail || 'Failed to save routing', 'Dismiss', { duration: 4000 });
      },
    });
  }

  // Test routing preview ----------------------------------------------------

  runTest(): void {
    if (this.testForm.invalid) {
      this.testForm.markAllAsTouched();
      return;
    }
    const v = this.testForm.value;
    this.testing = true;
    this.svc
      .testRouting({
        lead_source: v.lead_source,
        state: (v.state || '').trim().toUpperCase() || null,
        county: (v.county || '').trim() || null,
        zip_code: (v.zip_code || '').trim() || null,
      })
      .subscribe({
        next: (res) => {
          this.testResult = res;
          this.testing = false;
        },
        error: (err) => {
          this.testing = false;
          this.snack.open(err?.error?.detail || 'Test failed', 'Dismiss', { duration: 3500 });
        },
      });
  }

  // Display helpers ---------------------------------------------------------

  badgeClass(role: string | null | undefined): string {
    const r = (role || '').toLowerCase();
    if (r === 'cp' || r === 'super-admin' || r === 'admin') return 'badge-primary';
    if (r === 'rvp') return 'badge-secondary';
    if (r === 'agent' || r === 'adjuster') return 'badge-tertiary';
    return 'badge-muted';
  }
}
