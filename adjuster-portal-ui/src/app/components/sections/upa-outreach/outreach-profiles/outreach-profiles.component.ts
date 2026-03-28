import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { finalize } from 'rxjs/operators';
import { TimeoutError } from 'rxjs';
import {
  UpaOutreachService,
  OutreachProfile,
  TEMPLATE_VARIABLE_KEYS,
  wrapVariable,
} from 'src/app/services/upa-outreach.service';

const PREVIEW_SAMPLES: Record<string, string> = {
  first_name: 'John', last_name: 'Smith', address: '123 Main St',
  city: 'Anytown', state: 'PA', incident_type: 'Fire',
  incident_date: '03/15/2026', organization_name: 'UPA',
  agent_name: 'Jane Doe', reply_stop_line: 'Reply STOP to opt out.',
};

@Component({
  selector: 'app-outreach-profiles',
  templateUrl: './outreach-profiles.component.html',
  styleUrls: ['./outreach-profiles.component.scss'],
  standalone: false,
})
export class OutreachProfilesComponent implements OnInit, OnDestroy {
  profiles: OutreachProfile[] = [];
  filteredProfiles: OutreachProfile[] = [];
  displayedColumns = ['sn', 'name', 'channel', 'body_preview', 'is_active', 'created_at', 'actions'];
  dataSource = new MatTableDataSource<OutreachProfile>([]);
  variableKeys = TEMPLATE_VARIABLE_KEYS;

  loading = false;
  isCreating = false;
  isPreviewing = false;
  showForm = false;
  editingId: string | null = null;
  form: Partial<OutreachProfile> = this.emptyForm();
  showPreviewBox = false;
  previewText = '';
  bodyText = '';
  channels = ['sms', 'email'];

  // Filters
  searchText = '';
  filterChannel = '';
  filterStatus = '';

  // Summary counts
  totalCount = 0;
  smsCount = 0;
  emailCount = 0;
  voiceCount = 0;
  activeCount = 0;

  // Debug state
  lastAction = '';
  lastStatusCode: number | null = null;
  lastErrorMessage = '';
  lastUpdatedAt = '';
  statusMessage = '';
  statusType: 'success' | 'error' | '' = '';
  fetchTestResult = '';

  private spinnerTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private upaOutreach: UpaOutreachService,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.lastAction = ''; this.lastStatusCode = null; this.lastErrorMessage = '';
    this.lastUpdatedAt = ''; this.statusMessage = ''; this.statusType = '';
    this.fetchTestResult = ''; this.loading = false; this.profiles = [];
    this.stamp('init');
    this.loadProfiles();
  }

  ngOnDestroy() { this.clearSpinnerTimeout(); }

  // ── Debug / status ──────────────────────────────────────────────

  private stamp(action: string) { this.lastAction = action; this.lastUpdatedAt = new Date().toLocaleTimeString(); }

  private done(action: string, status: number) {
    this.lastStatusCode = status; this.lastErrorMessage = '';
    this.loading = false; this.isCreating = false;
    this.spinner.hide(); this.clearSpinnerTimeout(); this.stamp(action);
  }

  private fail(action: string, err: any) {
    this.lastErrorMessage = this.extractError(err);
    this.loading = false; this.isCreating = false;
    this.spinner.hide(); this.clearSpinnerTimeout(); this.stamp(action);
  }

  private showSpinner() {
    this.spinner.show(); this.clearSpinnerTimeout();
    this.spinnerTimeout = setTimeout(() => {
      if (this.loading) { this.lastErrorMessage = 'Spinner timeout (3s)'; this.stamp(this.lastAction + ':timeout'); }
      this.loading = false; this.isCreating = false; this.spinner.hide();
    }, 3000);
  }

  private clearSpinnerTimeout() { if (this.spinnerTimeout) { clearTimeout(this.spinnerTimeout); this.spinnerTimeout = null; } }

  private showStatus(message: string, type: 'success' | 'error') {
    this.statusMessage = message; this.statusType = type;
    this.lastUpdatedAt = new Date().toLocaleTimeString();
    this.snackBar.open(message, 'OK', { duration: 5000 });
  }

  clearStatus() { this.statusMessage = ''; this.statusType = ''; this.lastErrorMessage = ''; }

  private extractError(err: any): string {
    if (err instanceof TimeoutError) { this.lastStatusCode = 0; return 'Timeout (10s) — backend unreachable'; }
    if (err instanceof HttpErrorResponse) {
      this.lastStatusCode = err.status; const b = err.error;
      if (typeof b === 'string') return `HTTP ${err.status}: ${b}`;
      if (b?.detail) return `HTTP ${err.status}: ${b.detail}`;
      return `HTTP ${err.status}: ${err.statusText || 'Unknown'}`;
    }
    this.lastStatusCode = 0; return String(err?.message || err || 'Unknown error');
  }

  // ── Data ────────────────────────────────────────────────────────

  private setProfiles(data: any) {
    this.profiles = Array.isArray(data) ? data : [];
    this.computeSummary();
    this.applyFilters();
  }

  private computeSummary() {
    this.totalCount = this.profiles.length;
    this.smsCount = this.profiles.filter(p => p.channel === 'sms').length;
    this.emailCount = this.profiles.filter(p => p.channel === 'email').length;
    this.voiceCount = this.profiles.filter(p => p.channel === 'voice').length;
    this.activeCount = this.profiles.filter(p => p.is_active).length;
  }

  applyFilters() {
    let result = [...this.profiles];
    if (this.searchText.trim()) {
      const q = this.searchText.toLowerCase();
      result = result.filter(p => (p.name || '').toLowerCase().includes(q) || (p.body || '').toLowerCase().includes(q));
    }
    if (this.filterChannel) {
      result = result.filter(p => p.channel === this.filterChannel);
    }
    if (this.filterStatus === 'active') { result = result.filter(p => p.is_active); }
    if (this.filterStatus === 'inactive') { result = result.filter(p => !p.is_active); }
    this.filteredProfiles = result;
    this.dataSource = new MatTableDataSource(result);
  }

  clearFilters() { this.searchText = ''; this.filterChannel = ''; this.filterStatus = ''; this.applyFilters(); }

  // ── Helpers ─────────────────────────────────────────────────────

  truncateBody(body: string | null | undefined, max = 80): string {
    if (!body) return '-';
    return body.length > max ? body.substring(0, max) + '...' : body;
  }

  channelLabel(ch: string | null | undefined): string {
    if (!ch) return '-';
    switch (ch.toLowerCase()) { case 'sms': return 'SMS'; case 'email': return 'Email'; case 'voice': return 'Voice'; default: return ch.toUpperCase(); }
  }

  // ── Fetch diagnostic ───────────────────────────────────────────

  async testBackendFetch() {
    this.stamp('fetchTest:start'); this.fetchTestResult = 'fetching...';
    this.lastStatusCode = null; this.lastErrorMessage = '';
    const token = localStorage.getItem('access_token') || '';
    try {
      const resp = await fetch('/v1/upa-outreach/profiles', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const text = await resp.text();
      this.lastStatusCode = resp.status;
      this.fetchTestResult = `HTTP ${resp.status}: ${text.substring(0, 300)}`;
      if (resp.ok) { try { this.setProfiles(JSON.parse(text)); this.showStatus(`Fetch OK: ${this.profiles.length} profile(s)`, 'success'); } catch {} }
      else { this.lastErrorMessage = `HTTP ${resp.status}`; this.showStatus(`Fetch failed: HTTP ${resp.status}`, 'error'); }
      this.stamp('fetchTest:done');
    } catch (e: any) {
      this.lastStatusCode = 0; this.lastErrorMessage = e.message || 'Network error';
      this.fetchTestResult = `ERROR: ${e.message}`; this.showStatus('Fetch: ' + e.message, 'error'); this.stamp('fetchTest:error');
    }
    this.loading = false;
  }

  // ── Load ────────────────────────────────────────────────────────

  loadProfiles() {
    this.stamp('loadProfiles:start'); this.lastStatusCode = null; this.lastErrorMessage = '';
    this.loading = true; this.showSpinner();
    this.upaOutreach.getProfilesFull().pipe(
      finalize(() => { this.loading = false; this.spinner.hide(); this.clearSpinnerTimeout(); }),
    ).subscribe({
      next: (res: HttpResponse<OutreachProfile[]>) => {
        this.setProfiles(res.body || []); this.done('loadProfiles:done', res.status);
      },
      error: (err: any) => {
        this.setProfiles([]); this.fail('loadProfiles:error', err);
        this.showStatus('Load failed: ' + this.lastErrorMessage, 'error');
      },
    });
  }

  debugReload() { this.clearStatus(); this.loadProfiles(); }

  // ── Form ────────────────────────────────────────────────────────

  emptyForm(): Partial<OutreachProfile> { return { name: '', channel: 'sms', subject: '', body: '', is_active: true }; }

  openCreateForm() {
    this.showForm = true; this.editingId = null;
    this.form = this.emptyForm(); this.bodyText = '';
    this.showPreviewBox = false; this.previewText = ''; this.clearStatus();
  }

  openEditForm(profile: OutreachProfile) {
    this.showForm = true; this.editingId = profile.id;
    this.form = { ...profile }; this.bodyText = profile.body || '';
    this.showPreviewBox = false; this.previewText = ''; this.clearStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelForm() { this.showForm = false; this.editingId = null; this.showPreviewBox = false; this.previewText = ''; this.bodyText = ''; }

  insertVariable(key: string) { this.bodyText = (this.bodyText || '') + wrapVariable(key); }

  // ── Preview ─────────────────────────────────────────────────────

  previewTemplate(): void {
    this.isPreviewing = true;
    const body = this.bodyText || '';
    this.previewText = !body.trim() ? '(Empty body)' : this.renderLocally(body);
    this.showPreviewBox = true; this.isPreviewing = false;
  }

  private renderLocally(t: string): string {
    return t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) =>
      PREVIEW_SAMPLES[k] !== undefined ? PREVIEW_SAMPLES[k] : ('{' + '{' + k + '}' + '}'));
  }

  // ── Toggle active ───────────────────────────────────────────────

  toggleActive(profile: OutreachProfile) {
    const updated = { ...profile, is_active: !profile.is_active };
    this.upaOutreach.updateProfileFull(profile.id, { is_active: updated.is_active }).subscribe({
      next: () => {
        profile.is_active = updated.is_active;
        this.computeSummary();
        this.showStatus(`"${profile.name}" ${updated.is_active ? 'activated' : 'deactivated'}.`, 'success');
      },
      error: () => this.showStatus('Toggle failed.', 'error'),
    });
  }

  // ── Duplicate ───────────────────────────────────────────────────

  duplicateProfile(profile: OutreachProfile) {
    this.form = { ...profile, name: (profile.name || '') + ' (Copy)' };
    this.bodyText = profile.body || '';
    this.editingId = null;
    this.showForm = true;
    this.showPreviewBox = false;
    this.previewText = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Save ────────────────────────────────────────────────────────

  saveProfile() {
    this.form.body = this.bodyText;
    this.isCreating = true; this.clearStatus(); this.showSpinner();
    const isUpdate = !!this.editingId; const name = this.form.name || 'Profile';
    this.stamp(isUpdate ? 'update:start' : 'create:start');
    this.lastStatusCode = null; this.lastErrorMessage = '';

    const obs = this.editingId
      ? this.upaOutreach.updateProfileFull(this.editingId, this.form)
      : this.upaOutreach.createProfileFull(this.form);

    obs.pipe(finalize(() => { this.isCreating = false; this.spinner.hide(); this.clearSpinnerTimeout(); }))
      .subscribe({
        next: (res: HttpResponse<OutreachProfile>) => {
          this.showForm = false; this.editingId = null;
          this.done(isUpdate ? 'update:done' : 'create:done', res.status);
          this.showStatus(isUpdate ? `"${name}" updated.` : `"${name}" created.`, 'success');
          this.loadProfiles();
        },
        error: (err: any) => {
          this.fail(isUpdate ? 'update:error' : 'create:error', err);
          this.showStatus('Save failed: ' + this.lastErrorMessage, 'error');
        },
      });
  }

  // ── Delete ──────────────────────────────────────────────────────

  deleteProfile(id: string) {
    const p = this.profiles.find(x => x.id === id); const name = p?.name || 'Profile';
    if (!confirm(`Delete "${name}"?`)) return;
    this.stamp('delete:start'); this.lastStatusCode = null; this.lastErrorMessage = '';
    this.upaOutreach.deleteProfile(id).pipe(
      finalize(() => { this.spinner.hide(); this.clearSpinnerTimeout(); }),
    ).subscribe({
      next: () => { this.done('delete:done', 200); this.showStatus(`"${name}" deleted.`, 'success'); this.loadProfiles(); },
      error: (err: any) => { this.fail('delete:error', err); this.showStatus('Delete failed: ' + this.lastErrorMessage, 'error'); },
    });
  }

  // ── Seed ────────────────────────────────────────────────────────

  seedDefaults() {
    this.stamp('seed:start'); this.lastStatusCode = null; this.lastErrorMessage = '';
    this.clearStatus(); this.loading = true; this.showSpinner();
    this.upaOutreach.seedDefaultsFull().pipe(
      finalize(() => { this.loading = false; this.spinner.hide(); this.clearSpinnerTimeout(); }),
    ).subscribe({
      next: (res: HttpResponse<any>) => {
        const body = res.body;
        const seededCount = body?.seeded?.length || 0; const total = body?.total || 0;
        const allProfiles = body?.all_profiles;
        if (Array.isArray(allProfiles) && allProfiles.length > 0) {
          this.setProfiles(allProfiles); this.done('seed:done', res.status);
          this.showStatus(seededCount > 0 ? `${seededCount} created. ${total} total.` : `All exist. ${total} total.`, 'success');
        } else {
          this.done('seed:done', res.status);
          this.showStatus(seededCount > 0 ? `${seededCount} created.` : 'Seed OK, 0 new.', seededCount > 0 ? 'success' : 'error');
          this.loadProfiles();
        }
      },
      error: (err: any) => { this.fail('seed:error', err); this.showStatus('Seed failed: ' + this.lastErrorMessage, 'error'); },
    });
  }
}
