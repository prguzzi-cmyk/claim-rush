import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';

import {
  AgentBankingDTO,
  AgentDocumentDTO,
  AgentLicenseCreateRequest,
  AgentLicenseDTO,
  AgentLicenseUpdateRequest,
  AgentProfileDataService,
  AgentProfileDTO,
  AgentProfileUpdateRequest,
} from 'src/app/services/agent-profile-data.service';
import { IssueAdvanceDialogComponent } from '../commissions-admin-view/issue-advance-dialog/issue-advance-dialog.component';
import { IssuePayoutDialogComponent } from '../commissions-admin-view/issue-payout-dialog/issue-payout-dialog.component';

type TabKey = 'identity' | 'contact' | 'role' | 'licenses' | 'banking' | 'compliance' | 'documents' | 'compensation';

/**
 * Agent detail page at /app/administration/users/:id. Seven tabs mapped
 * directly to the Agent Profile data model. Identity and Role & Hierarchy
 * tabs show user-table fields as read-only (edit those in the general
 * Users admin); everything else on agent_profile is editable via PATCH.
 * Banking tab is read-only with a notice — the full edit flow waits for
 * encrypted-at-rest infra. Documents tab lists uploads; upload button is
 * a placeholder until file-upload wiring is audited.
 */
@Component({
  selector: 'app-agent-profile-detail',
  templateUrl: './agent-profile-detail.component.html',
  styleUrls: ['./agent-profile-detail.component.scss'],
  standalone: false,
})
export class AgentProfileDetailComponent implements OnInit {
  activeTab: TabKey = 'identity';
  private readonly allTabs: { key: TabKey; label: string; icon: string; roles?: string[] }[] = [
    { key: 'identity',     label: 'Identity',          icon: 'badge' },
    { key: 'contact',      label: 'Contact',           icon: 'contact_mail' },
    { key: 'role',         label: 'Role & Hierarchy',  icon: 'account_tree' },
    { key: 'compensation', label: 'Compensation',      icon: 'payments', roles: ['ADJUSTER'] },
    { key: 'licenses',     label: 'Licenses',          icon: 'verified_user' },
    { key: 'banking',      label: 'Banking',           icon: 'account_balance' },
    { key: 'compliance',   label: 'Compliance',        icon: 'fact_check' },
    { key: 'documents',    label: 'Documents',         icon: 'folder_open' },
  ];

  get tabs(): { key: TabKey; label: string; icon: string }[] {
    const role = (this.profile?.user_role || '').toUpperCase();
    return this.allTabs.filter(t => !t.roles || t.roles.includes(role));
  }

  readonly compTypes = ['SALARIED', 'HOURLY', 'COMMISSION', 'SALARY_PLUS_BONUS', 'HYBRID'];
  readonly compPercentPresets = [5, 10, 15];

  profile: AgentProfileDTO | null = null;
  loading = true;
  notFound = false;

  // Editable copy for form binding
  editable: AgentProfileUpdateRequest = {};
  dirty = false;
  saving = false;

  // Licenses tab
  private licensesRefresh$ = new BehaviorSubject<void>(undefined);
  licenses$!: Observable<AgentLicenseDTO[]>;
  showLicenseForm = false;
  editingLicenseId: string | null = null;
  licenseForm: AgentLicenseCreateRequest = this.emptyLicense();
  readonly licenseStatuses = ['ACTIVE', 'LAPSED', 'REVOKED', 'SUSPENDED', 'PENDING_RENEWAL'];
  readonly licenseTypes = ['PUBLIC_ADJUSTER', 'INSURANCE', 'LEGAL', 'REAL_ESTATE', 'OTHER'];
  readonly taxClassifications = ['1099', 'W2', 'S_CORP', 'LLC'];
  readonly bgStatuses = ['PENDING', 'PASSED', 'FAILED', 'EXEMPT'];

  // Banking / documents (read-only)
  banking: AgentBankingDTO | null = null;
  bankingLoaded = false;
  documents: AgentDocumentDTO[] = [];
  documentsLoaded = false;

  // Danger zone — typed-confirm delete
  showDeleteConfirm = false;
  deleteConfirmInput = '';
  deleting = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly data: AgentProfileDataService,
    private readonly snack: MatSnackBar,
    private readonly dialog: MatDialog,
  ) {}

  openIssueAdvance(): void {
    if (!this.profile) return;
    this.dialog.open(IssueAdvanceDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'issue-advance-dialog-panel',
      data: { agentId: this.profile.user_id },
      autoFocus: false,
    });
  }

  openIssuePayout(): void {
    if (!this.profile) return;
    this.dialog.open(IssuePayoutDialogComponent, {
      width: '720px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'issue-payout-dialog-panel',
      data: { agentId: this.profile.user_id },
      autoFocus: false,
    });
  }

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!userId) {
      this.notFound = true;
      this.loading = false;
      return;
    }
    this.data.getByUserId$(userId).subscribe({
      next: p => {
        this.profile = p;
        this.resetEditable();
        this.loading = false;
        this.licenses$ = this.licensesRefresh$.pipe(
          switchMap(() => this.data.listLicenses$(p.id)),
        );
        // Lazy-hydrate banking + docs on first tab activation (see setTab).
      },
      error: _err => {
        this.notFound = true;
        this.loading = false;
      },
    });
  }

  setTab(tab: TabKey): void {
    this.activeTab = tab;
    if (tab === 'banking' && !this.bankingLoaded && this.profile) {
      this.data.getBanking$(this.profile.id).subscribe({
        next: b => { this.banking = b; this.bankingLoaded = true; },
        error: () => { this.banking = null; this.bankingLoaded = true; },
      });
    }
    if (tab === 'documents' && !this.documentsLoaded && this.profile) {
      this.data.listDocuments$(this.profile.id).subscribe({
        next: d => { this.documents = d; this.documentsLoaded = true; },
        error: () => { this.documents = []; this.documentsLoaded = true; },
      });
    }
  }

  backToList(): void { this.router.navigate(['/app/administration/agents']); }

  markDirty(): void { this.dirty = true; }

  resetEditable(): void {
    if (!this.profile) return;
    this.editable = {
      ssn_or_itin_last4: this.profile.ssn_or_itin_last4,
      tax_classification: this.profile.tax_classification,
      w9_signed_at: this.profile.w9_signed_at,
      employment_start_date: this.profile.employment_start_date,
      employment_end_date: this.profile.employment_end_date,
      termination_reason: this.profile.termination_reason,
      background_check_status: this.profile.background_check_status,
      background_check_completed_at: this.profile.background_check_completed_at,
      drug_test_passed_at: this.profile.drug_test_passed_at,
      non_compete_signed_at: this.profile.non_compete_signed_at,
      emergency_contact_name: this.profile.emergency_contact_name,
      emergency_contact_phone: this.profile.emergency_contact_phone,
      beneficiary_name: this.profile.beneficiary_name,
      beneficiary_relationship: this.profile.beneficiary_relationship,
      commission_tier_override: this.profile.commission_tier_override,
      adjuster_comp_type: this.profile.adjuster_comp_type,
      adjuster_comp_percent: this.profile.adjuster_comp_percent,
      adjuster_annual_salary: this.profile.adjuster_annual_salary,
      adjuster_hourly_rate: this.profile.adjuster_hourly_rate,
      adjuster_comp_effective_date: this.profile.adjuster_comp_effective_date,
      notes: this.profile.notes,
    };
    this.dirty = false;
  }

  showSalaryFields(): boolean {
    const t = this.editable.adjuster_comp_type;
    return t === 'SALARIED' || t === 'SALARY_PLUS_BONUS';
  }

  showHourlyFields(): boolean {
    const t = this.editable.adjuster_comp_type;
    return t === 'HOURLY' || t === 'HYBRID';
  }

  showPercentFields(): boolean {
    const t = this.editable.adjuster_comp_type;
    return t === 'COMMISSION' || t === 'SALARY_PLUS_BONUS' || t === 'HYBRID';
  }

  setPercentPreset(p: number): void {
    this.editable.adjuster_comp_percent = p;
    this.markDirty();
  }

  saveProfile(): void {
    if (!this.profile) return;
    this.saving = true;
    this.data.update$(this.profile.id, this.editable).subscribe({
      next: p => {
        this.profile = p;
        this.resetEditable();
        this.saving = false;
        this.snack.open('Profile updated', 'Dismiss', { duration: 2500 });
      },
      error: err => {
        this.saving = false;
        this.snack.open(`Failed to update: ${err?.error?.detail || err?.message || err}`, 'OK', { duration: 5000 });
      },
    });
  }

  // ─── Licenses ──────────────────────────────────────────────────────────

  openNewLicenseForm(): void {
    this.licenseForm = this.emptyLicense();
    this.editingLicenseId = null;
    this.showLicenseForm = true;
  }

  editLicense(lic: AgentLicenseDTO): void {
    this.licenseForm = {
      state: lic.state,
      license_type: lic.license_type,
      license_number: lic.license_number,
      issued_on: lic.issued_on,
      expires_on: lic.expires_on,
      status: lic.status,
      notes: lic.notes,
    };
    this.editingLicenseId = lic.id;
    this.showLicenseForm = true;
  }

  cancelLicenseForm(): void {
    this.showLicenseForm = false;
    this.editingLicenseId = null;
  }

  submitLicense(): void {
    if (!this.profile) return;
    if (this.editingLicenseId) {
      const payload: AgentLicenseUpdateRequest = { ...this.licenseForm };
      this.data.updateLicense$(this.profile.id, this.editingLicenseId, payload).subscribe({
        next: _ => {
          this.snack.open('License updated', 'Dismiss', { duration: 2500 });
          this.showLicenseForm = false;
          this.editingLicenseId = null;
          this.licensesRefresh$.next();
        },
        error: err => this.snack.open(`Failed: ${err?.error?.detail || err?.message}`, 'OK', { duration: 5000 }),
      });
    } else {
      this.data.createLicense$(this.profile.id, this.licenseForm).subscribe({
        next: _ => {
          this.snack.open('License added', 'Dismiss', { duration: 2500 });
          this.showLicenseForm = false;
          this.licensesRefresh$.next();
        },
        error: err => this.snack.open(`Failed: ${err?.error?.detail || err?.message}`, 'OK', { duration: 5000 }),
      });
    }
  }

  deleteLicense(lic: AgentLicenseDTO): void {
    if (!this.profile) return;
    if (!confirm(`Remove license ${lic.state} ${lic.license_number}? This cannot be undone.`)) return;
    this.data.deleteLicense$(this.profile.id, lic.id).subscribe({
      next: () => {
        this.snack.open('License removed', 'Dismiss', { duration: 2500 });
        this.licensesRefresh$.next();
      },
      error: err => this.snack.open(`Failed: ${err?.error?.detail || err?.message}`, 'OK', { duration: 5000 }),
    });
  }

  // ─── Danger zone ───────────────────────────────────────────────────────

  openDeleteConfirm(): void {
    this.deleteConfirmInput = '';
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.deleteConfirmInput = '';
  }

  canConfirmDelete(): boolean {
    return !!this.profile && this.deleteConfirmInput.trim() === this.profile.agent_number;
  }

  confirmDelete(): void {
    if (!this.profile || !this.canConfirmDelete()) return;
    this.deleting = true;
    this.data.delete$(this.profile.id).subscribe({
      next: () => {
        this.deleting = false;
        this.snack.open(`Agent ${this.profile!.agent_number} deleted`, 'Dismiss', { duration: 3000 });
        this.router.navigate(['/app/administration/agents']);
      },
      error: err => {
        this.deleting = false;
        this.snack.open(`Failed to delete: ${err?.error?.detail || err?.message || err}`, 'OK', { duration: 5000 });
      },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private emptyLicense(): AgentLicenseCreateRequest {
    return {
      state: '',
      license_type: 'PUBLIC_ADJUSTER',
      license_number: '',
      issued_on: null,
      expires_on: null,
      status: 'ACTIVE',
      notes: null,
    };
  }

  uploadComingSoon(): void {
    this.snack.open('File upload wiring pending — coming soon.', 'OK', { duration: 3500 });
  }

  avatarInitials(): string {
    if (!this.profile) return '?';
    return this.profile.user_name
      .split(' ')
      .map(s => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  roleToneClass(): string {
    const role = (this.profile?.user_role || '').toUpperCase();
    if (role === 'AGENT') return 'role-agent';
    if (role === 'RVP') return 'role-rvp';
    if (role === 'CP') return 'role-cp';
    if (role === 'ADMIN' || role === 'SUPER-ADMIN') return 'role-admin';
    return 'role-other';
  }

  licenseStatusTone(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'lic-active';
      case 'PENDING_RENEWAL': return 'lic-pending';
      case 'LAPSED': return 'lic-lapsed';
      case 'SUSPENDED':
      case 'REVOKED': return 'lic-revoked';
      default: return 'lic-other';
    }
  }
}
