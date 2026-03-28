import { Component, OnInit, ViewChild } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { UserService } from 'src/app/services/user.service';
import { RoleService } from 'src/app/services/role.service';
import { IntakeConfigService } from 'src/app/services/intake-config.service';

@Component({
  selector: 'app-agent-setup-wizard',
  styleUrls: ['./agent-setup-wizard.component.scss'],
  standalone: false,
  template: `
<div class="wizard-page">
  <div class="wizard-header">
    <mat-icon class="header-icon">person_add</mat-icon>
    <div>
      <h2>Agent Setup Wizard</h2>
      <p class="subtitle">Onboard a new ACI rep in one guided flow</p>
    </div>
  </div>

  <mat-stepper #stepper [linear]="false" class="wizard-stepper">

    <!-- STEP 1 -->
    <mat-step label="Identity">
      <div class="step-content">
        <h3><mat-icon>badge</mat-icon> Basic Identity</h3>
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>First Name</mat-label>
            <input matInput [(ngModel)]="first_name" (ngModelChange)="onNameChange()" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Last Name</mat-label>
            <input matInput [(ngModel)]="last_name" (ngModelChange)="onNameChange()" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Email</mat-label>
            <input matInput type="email" [(ngModel)]="email" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Phone</mat-label>
            <input matInput [(ngModel)]="phone" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Title</mat-label>
            <input matInput [(ngModel)]="title" placeholder="e.g. Public Adjuster" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Chapter / Team</mat-label>
            <input matInput [(ngModel)]="chapter" placeholder="e.g. Florida South" /></mat-form-field>
        </div>
        <div class="step-actions"><span></span>
          <button mat-raised-button color="primary" matStepperNext [disabled]="!first_name || !last_name || !email">Next <mat-icon>arrow_forward</mat-icon></button>
        </div>
      </div>
    </mat-step>

    <!-- STEP 2 -->
    <mat-step label="Role">
      <div class="step-content">
        <h3><mat-icon>account_tree</mat-icon> Role &amp; Hierarchy</h3>
        <div class="form-grid">

          <mat-form-field appearance="outline"><mat-label>Role Type</mat-label>
            <mat-select [(ngModel)]="role_type" (ngModelChange)="onRoleChange()">
              <mat-option *ngFor="let r of roleOptions" [value]="r.value">{{r.label}}</mat-option>
            </mat-select></mat-form-field>

          <!-- CP: auto-assigned to self, show only RVP -->
          <div *ngIf="role_type === 'cp'" class="role-note">
            <mat-icon>info</mat-icon> Chapter President — CP is set to self automatically.
          </div>
          <mat-form-field appearance="outline" *ngIf="role_type === 'cp'"><mat-label>Assigned RVP</mat-label>
            <mat-select [(ngModel)]="assigned_rvp_id">
              <mat-option value="">None</mat-option>
              <mat-option *ngFor="let u of userListRvp" [value]="u.id">{{u.name}}</mat-option>
            </mat-select></mat-form-field>

          <!-- RVP: show CP dropdown only -->
          <mat-form-field appearance="outline" *ngIf="role_type === 'rvp'"><mat-label>Assigned CP</mat-label>
            <mat-select [(ngModel)]="assigned_cp_id">
              <mat-option value="">None</mat-option>
              <mat-option *ngFor="let u of userListCp" [value]="u.id">{{u.name}}</mat-option>
            </mat-select></mat-form-field>
          <mat-form-field appearance="outline" *ngIf="role_type === 'rvp'"><mat-label>Supervisor (optional)</mat-label>
            <mat-select [(ngModel)]="supervisor_id">
              <mat-option value="">None</mat-option>
              <mat-option *ngFor="let u of userListAll" [value]="u.id">{{u.name}}</mat-option>
            </mat-select></mat-form-field>

          <!-- Agent / Sales-Only / Hybrid: show CP + RVP dropdowns -->
          <mat-form-field appearance="outline" *ngIf="role_type === 'agent' || role_type === 'sales-only' || role_type === 'hybrid'"><mat-label>Assigned CP</mat-label>
            <mat-select [(ngModel)]="assigned_cp_id">
              <mat-option value="">None</mat-option>
              <mat-option *ngFor="let u of userListCp" [value]="u.id">{{u.name}}</mat-option>
            </mat-select></mat-form-field>
          <mat-form-field appearance="outline" *ngIf="role_type === 'agent' || role_type === 'sales-only' || role_type === 'hybrid'"><mat-label>Assigned RVP</mat-label>
            <mat-select [(ngModel)]="assigned_rvp_id">
              <mat-option value="">None</mat-option>
              <mat-option *ngFor="let u of userListRvp" [value]="u.id">{{u.name}}</mat-option>
            </mat-select></mat-form-field>
          <mat-form-field appearance="outline" *ngIf="role_type === 'agent' || role_type === 'sales-only' || role_type === 'hybrid'"><mat-label>Supervisor (optional)</mat-label>
            <mat-select [(ngModel)]="supervisor_id">
              <mat-option value="">None</mat-option>
              <mat-option *ngFor="let u of userListAll" [value]="u.id">{{u.name}}</mat-option>
            </mat-select></mat-form-field>

          <!-- Adjuster: show CP dropdown only -->
          <mat-form-field appearance="outline" *ngIf="role_type === 'adjuster'"><mat-label>Assigned CP</mat-label>
            <mat-select [(ngModel)]="assigned_cp_id">
              <mat-option value="">None</mat-option>
              <mat-option *ngFor="let u of userListCp" [value]="u.id">{{u.name}}</mat-option>
            </mat-select></mat-form-field>
          <mat-form-field appearance="outline" *ngIf="role_type === 'adjuster'"><mat-label>Supervisor (optional)</mat-label>
            <mat-select [(ngModel)]="supervisor_id">
              <mat-option value="">None</mat-option>
              <mat-option *ngFor="let u of userListAll" [value]="u.id">{{u.name}}</mat-option>
            </mat-select></mat-form-field>

        </div>
        <div class="step-actions">
          <button mat-button matStepperPrevious>Back</button>
          <button mat-raised-button color="primary" matStepperNext>Next <mat-icon>arrow_forward</mat-icon></button>
        </div>
      </div>
    </mat-step>

    <!-- STEP 3 -->
    <mat-step label="Territory">
      <div class="step-content">
        <h3><mat-icon>map</mat-icon> Territory</h3>
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>State</mat-label>
            <input matInput [(ngModel)]="state" maxlength="2" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>County</mat-label>
            <input matInput [(ngModel)]="county" /></mat-form-field>
          <mat-form-field appearance="outline" class="full-width"><mat-label>ZIP Codes</mat-label>
            <input matInput [(ngModel)]="zip_codes" placeholder="Comma-separated" /></mat-form-field>
        </div>
        <div class="toggle-row">
          <mat-slide-toggle [(ngModel)]="national_access">National Access</mat-slide-toggle>
          <mat-slide-toggle [(ngModel)]="exclusive_territory">Exclusive Territory</mat-slide-toggle>
        </div>
        <div class="step-actions">
          <button mat-button matStepperPrevious>Back</button>
          <button mat-raised-button color="primary" matStepperNext [disabled]="!state && !national_access">Next <mat-icon>arrow_forward</mat-icon></button>
        </div>
      </div>
    </mat-step>

    <!-- STEP 4 -->
    <mat-step label="AI Setup">
      <div class="step-content">
        <h3><mat-icon>smart_toy</mat-icon> AI Setup</h3>
        <div class="toggle-grid">
          <div class="toggle-card"><mat-slide-toggle [(ngModel)]="ai_secretary_enabled"></mat-slide-toggle>
            <div class="toggle-info"><span class="toggle-title">AI Secretary</span><span class="toggle-desc">Auto-answer calls</span></div></div>
          <div class="toggle-card"><mat-slide-toggle [(ngModel)]="ai_voice_enabled"></mat-slide-toggle>
            <div class="toggle-info"><span class="toggle-title">AI Voice Outreach</span><span class="toggle-desc">Outbound calling</span></div></div>
          <div class="toggle-card"><mat-slide-toggle [(ngModel)]="ai_sales_enabled"></mat-slide-toggle>
            <div class="toggle-info"><span class="toggle-title">AI Sales Agent</span><span class="toggle-desc">Lead conversion</span></div></div>
        </div>
        <div class="form-grid" style="margin-top:16px">
          <mat-form-field appearance="outline"><mat-label>Greeting Style</mat-label>
            <mat-select [(ngModel)]="greeting_style">
              <mat-option *ngFor="let g of greetingOptions" [value]="g.value">{{g.label}}</mat-option>
            </mat-select></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Rep Display Name</mat-label>
            <input matInput [(ngModel)]="rep_display_name" /></mat-form-field>
        </div>
        <div class="brand-note"><mat-icon>info</mat-icon> ACI remains the sole brand on all public-facing materials.</div>
        <div class="step-actions">
          <button mat-button matStepperPrevious>Back</button>
          <button mat-raised-button color="primary" matStepperNext>Next <mat-icon>arrow_forward</mat-icon></button>
        </div>
      </div>
    </mat-step>

    <!-- STEP 5 -->
    <mat-step label="Intake">
      <div class="step-content">
        <h3><mat-icon>link</mat-icon> Intake Ownership</h3>
        <div class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Intake Slug</mat-label>
            <input matInput [(ngModel)]="intake_slug" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Source Credit Owner</mat-label>
            <mat-select [(ngModel)]="source_credit_owner">
              <mat-option *ngFor="let o of creditOwnerOptions" [value]="o.value">{{o.label}}</mat-option>
            </mat-select></mat-form-field>
        </div>
        <div class="toggle-row">
          <mat-slide-toggle [(ngModel)]="fallback_home_office">Fallback to Home Office</mat-slide-toggle>
          <mat-slide-toggle [(ngModel)]="rescue_enabled">Rescue Enabled</mat-slide-toggle>
        </div>
        <div class="step-actions">
          <button mat-button matStepperPrevious>Back</button>
          <button mat-raised-button color="primary" matStepperNext [disabled]="!intake_slug">Next <mat-icon>arrow_forward</mat-icon></button>
        </div>
      </div>
    </mat-step>

    <!-- STEP 6 -->
    <mat-step label="Handling">
      <div class="step-content">
        <h3><mat-icon>paid</mat-icon> Compensation &amp; Handling</h3>
        <div class="toggle-grid">
          <div class="toggle-card"><mat-slide-toggle [(ngModel)]="sales_credit"></mat-slide-toggle>
            <div class="toggle-info"><span class="toggle-title">Sales Source Credit</span><span class="toggle-desc">Lead sourcing</span></div></div>
          <div class="toggle-card"><mat-slide-toggle [(ngModel)]="close_credit"></mat-slide-toggle>
            <div class="toggle-info"><span class="toggle-title">Close Credit</span><span class="toggle-desc">Deal closing</span></div></div>
          <div class="toggle-card"><mat-slide-toggle [(ngModel)]="adjuster_credit"></mat-slide-toggle>
            <div class="toggle-info"><span class="toggle-title">Adjuster Credit</span><span class="toggle-desc">Claim adjustment</span></div></div>
          <div class="toggle-card"><mat-slide-toggle [(ngModel)]="hierarchy_payout"></mat-slide-toggle>
            <div class="toggle-info"><span class="toggle-title">Hierarchy Payout</span><span class="toggle-desc">Upline splits</span></div></div>
        </div>
        <div class="form-grid" style="margin-top:16px">
          <mat-form-field appearance="outline"><mat-label>Handling Mode</mat-label>
            <mat-select [(ngModel)]="handling_mode">
              <mat-option *ngFor="let h of handlingOptions" [value]="h.value">{{h.label}}</mat-option>
            </mat-select></mat-form-field>
        </div>
        <div class="step-actions">
          <button mat-button matStepperPrevious>Back</button>
          <button mat-raised-button color="primary" (click)="submitWizard()" [disabled]="saving">
            {{saving ? 'Creating...' : 'Complete Setup'}}
          </button>
        </div>
      </div>
    </mat-step>

    <!-- STEP 7: SUMMARY -->
    <mat-step label="Summary">
      <div class="step-content summary-step">
        <div class="summary-header">
          <mat-icon class="success-icon">check_circle</mat-icon>
          <h3>Setup Complete</h3>
          <p>{{first_name}} {{last_name}} is ready to go.</p>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <h4><mat-icon>badge</mat-icon> Identity</h4>
            <div class="summary-row"><span>Name</span><strong>{{first_name}} {{last_name}}</strong></div>
            <div class="summary-row"><span>Email</span><strong>{{email}}</strong></div>
            <div class="summary-row"><span>Phone</span><strong>{{phone || '-'}}</strong></div>
            <div class="summary-row"><span>Title</span><strong>{{title || '-'}}</strong></div>
            <div class="summary-row"><span>Role</span><strong>{{role_type}}</strong></div>
          </div>
          <div class="summary-card">
            <h4><mat-icon>map</mat-icon> Territory</h4>
            <div class="summary-row"><span>State</span><strong>{{state || '-'}}</strong></div>
            <div class="summary-row"><span>County</span><strong>{{county || '-'}}</strong></div>
            <div class="summary-row"><span>ZIPs</span><strong>{{zip_codes || '-'}}</strong></div>
            <div class="summary-row"><span>National</span><strong>{{national_access ? 'Yes' : 'No'}}</strong></div>
          </div>
          <div class="summary-card">
            <h4><mat-icon>smart_toy</mat-icon> AI Tools</h4>
            <div class="summary-row"><span>Secretary</span><strong>{{ai_secretary_enabled ? 'On' : 'Off'}}</strong></div>
            <div class="summary-row"><span>Voice</span><strong>{{ai_voice_enabled ? 'On' : 'Off'}}</strong></div>
            <div class="summary-row"><span>Sales</span><strong>{{ai_sales_enabled ? 'On' : 'Off'}}</strong></div>
          </div>
          <div class="summary-card">
            <h4><mat-icon>paid</mat-icon> Handling</h4>
            <div class="summary-row"><span>Mode</span><strong>{{handling_mode}}</strong></div>
            <div class="summary-row"><span>Sales</span><strong>{{sales_credit ? 'Yes' : 'No'}}</strong></div>
            <div class="summary-row"><span>Close</span><strong>{{close_credit ? 'Yes' : 'No'}}</strong></div>
            <div class="summary-row"><span>Hierarchy</span><strong>{{hierarchy_payout ? 'Yes' : 'No'}}</strong></div>
          </div>
        </div>

        <!-- Digital Identity -->
        <div class="summary-card di-card">
          <h4><mat-icon>contact_page</mat-icon> Digital Identity</h4>

          <div class="di-fields">
            <div class="di-field"><span class="di-label">Display Name</span><span class="di-value">{{card_display_name || first_name + ' ' + last_name || '-'}}</span></div>
            <div class="di-field"><span class="di-label">Title</span><span class="di-value">{{card_title || title || '-'}}</span></div>
            <div class="di-field"><span class="di-label">Phone</span><span class="di-value">{{card_phone || phone || '-'}}</span></div>
            <div class="di-field"><span class="di-label">Email</span><span class="di-value">{{card_email || email || '-'}}</span></div>
            <div class="di-field"><span class="di-label">Intake URL</span><span class="di-value">{{intakeUrl || '-'}}</span></div>
          </div>

          <div class="di-actions">
            <button mat-stroked-button (click)="onCopyIntake()"><mat-icon>content_copy</mat-icon> Copy Intake Link</button>
            <button mat-stroked-button (click)="onDownloadVcard()"><mat-icon>contact_page</mat-icon> Download Contact</button>
          </div>

          <div class="di-placeholders">
            <div class="di-placeholder"><mat-icon>qr_code_2</mat-icon> QR Code &mdash; coming soon</div>
            <div class="di-placeholder"><mat-icon>add_card</mat-icon> Apple Wallet &mdash; coming soon</div>
          </div>
        </div>

        <!-- Generated Links -->
        <div class="summary-card links-card" *ngIf="generatedPublicUrl">
          <h4><mat-icon>link</mat-icon> Generated Links</h4>
          <div class="link-row">
            <span class="link-label">Public Intake</span><code>{{generatedPublicUrl}}</code>
            <button mat-icon-button (click)="onCopyIntake()" matTooltip="Copy"><mat-icon>content_copy</mat-icon></button>
          </div>
          <div class="link-row" *ngIf="generatedTrackedUrl">
            <span class="link-label">Tracked</span><code>{{generatedTrackedUrl}}</code>
          </div>
        </div>

        <div class="summary-actions">
          <button mat-raised-button color="primary" (click)="goToUsers()"><mat-icon>manage_accounts</mat-icon> Go to Users</button>
          <button mat-stroked-button (click)="startAnother()"><mat-icon>person_add</mat-icon> Onboard Another</button>
        </div>
      </div>
    </mat-step>

  </mat-stepper>
</div>
  `,
})
export class AgentSetupWizardComponent implements OnInit {
  @ViewChild('stepper') stepper: MatStepper | undefined;

  saving = false;
  complete = false;

  createdUserId = '';
  generatedPublicUrl = '';
  generatedTrackedUrl = '';
  generatedIntakeSlug = '';

  // User lists for hierarchy dropdowns
  userListAll: { id: string; name: string }[] = [];
  userListCp: { id: string; name: string }[] = [];
  userListRvp: { id: string; name: string }[] = [];
  usersLoading = false;

  // Roles loaded from backend
  rolesMap: { [name: string]: string } = {};  // role name → role id

  // Step 1
  first_name = '';
  last_name = '';
  phone = '';
  email = '';
  title = '';
  chapter = '';

  // Step 2
  role_type = 'agent';
  assigned_cp_id = '';
  assigned_rvp_id = '';
  supervisor_id = '';

  // Step 3
  state = '';
  county = '';
  zip_codes = '';
  national_access = false;
  exclusive_territory = false;

  // Step 4
  ai_secretary_enabled = true;
  ai_voice_enabled = true;
  ai_sales_enabled = true;
  greeting_style = 'professional';
  rep_display_name = '';

  // Step 5
  intake_slug = '';
  source_credit_owner = 'agent';
  fallback_home_office = true;
  rescue_enabled = true;

  // Step 6
  sales_credit = true;
  close_credit = true;
  adjuster_credit = false;
  hierarchy_payout = true;
  handling_mode = 'full-adjuster';

  // Digital Identity (displayed in summary)
  card_display_name = '';
  card_title = '';
  card_phone = '';
  card_email = '';
  intakeUrl = '';

  roleOptions = [
    { value: 'cp', label: 'Chapter President (CP)' },
    { value: 'rvp', label: 'Regional VP (RVP)' },
    { value: 'agent', label: 'Agent' },
    { value: 'sales-only', label: 'Sales-Only Agent' },
    { value: 'adjuster', label: 'Adjuster' },
    { value: 'hybrid', label: 'Hybrid (Sales + Adjuster)' },
  ];
  handlingOptions = [
    { value: 'sales-only', label: 'Sales Only' },
    { value: 'full-adjuster', label: 'Full Adjuster' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'home-office', label: 'Home Office Handles Claims' },
  ];
  greetingOptions = [
    { value: 'professional', label: 'Professional' },
    { value: 'friendly', label: 'Friendly & Warm' },
    { value: 'direct', label: 'Direct & Efficient' },
  ];
  creditOwnerOptions = [
    { value: 'agent', label: 'Agent' },
    { value: 'cp', label: 'Chapter President' },
    { value: 'rvp', label: 'RVP' },
    { value: 'home-office', label: 'Home Office' },
  ];

  constructor(
    private userService: UserService,
    private roleService: RoleService,
    private intakeConfigService: IntakeConfigService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
  }

  private loadRoles(): void {
    this.roleService.getRoles().subscribe({
      next: (response: any) => {
        const roles = response?.items || response || [];
        if (Array.isArray(roles)) {
          for (const r of roles) {
            if (r.name && r.id) {
              this.rolesMap[r.name.toLowerCase()] = r.id;
            }
          }
        }
      },
      error: () => { /* dropdowns still work, submit will use fallback */ },
    });
  }

  private resolveRoleId(): string | null {
    // Map wizard role_type to backend role name
    const map: { [key: string]: string[] } = {
      'cp': ['chapter-president', 'admin'],
      'rvp': ['rvp', 'admin'],
      'agent': ['agent'],
      'sales-only': ['agent', 'sales-rep'],
      'adjuster': ['agent'],
      'hybrid': ['agent'],
    };
    const candidates = map[this.role_type] || ['agent'];
    for (const name of candidates) {
      if (this.rolesMap[name]) return this.rolesMap[name];
    }
    // Fallback: return the first role we have
    const allIds = Object.values(this.rolesMap);
    return allIds.length > 0 ? allIds[0] : null;
  }

  private loadUsers(): void {
    this.usersLoading = true;
    // Load a small page of users for dropdown population
    this.userService.getUsers(1, 50).subscribe({
      next: (response: any) => {
        this.usersLoading = false;
        const users = response?.items || response || [];
        const toEntry = (u: any) => ({
          id: u.id,
          name: ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.email || u.id,
        });
        const all = (Array.isArray(users) ? users : [])
          .filter((u: any) => u.is_active !== false);
        this.userListAll = all.map(toEntry);
        this.userListCp = this.userListAll;
        this.userListRvp = this.userListAll;
      },
      error: () => {
        this.usersLoading = false;
      },
    });
  }

  onRoleChange(): void {
    // Reset hierarchy fields when role changes
    this.assigned_cp_id = '';
    this.assigned_rvp_id = '';
    this.supervisor_id = '';

    // Set sensible defaults per role
    if (this.role_type === 'cp') {
      // CP = self, no need for assigned_cp_id
      this.assigned_cp_id = 'self';
    }
    if (this.role_type === 'sales-only') {
      this.handling_mode = 'sales-only';
    }
    if (this.role_type === 'adjuster') {
      this.handling_mode = 'full-adjuster';
      this.adjuster_credit = true;
    }
  }

  onNameChange(): void {
    if (this.first_name && this.last_name) {
      this.intake_slug = (this.first_name + '-' + this.last_name)
        .toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
      this.rep_display_name = this.first_name + ' ' + this.last_name;
    }
  }

  submitWizard(): void {
    if (this.saving) return;
    this.saving = true;

    const resolvedRoleId = this.resolveRoleId();
    if (!resolvedRoleId) {
      this.saving = false;
      this.snackBar.open('No roles available — please create roles first', 'Close', { duration: 5000 });
      return;
    }

    console.log('DEV SUBMIT USER EMAIL:', this.email);

    const userPayload: any = {
      first_name: this.first_name,
      last_name: this.last_name,
      email: this.email,
      password: 'Temp123!',
      role_id: resolvedRoleId,
      operating_mode: 'aci',
      is_active: true,
      national_access: this.national_access,
      is_accepting_leads: true,
      user_meta: {
        phone_number: this.phone,
        state: this.state,
        city: this.county,
        zip_code: (this.zip_codes || '').split(',')[0]?.trim() || '',
      },
    };
    if (this.supervisor_id && this.supervisor_id !== 'self') userPayload.manager_id = this.supervisor_id;

    console.log('[AgentWizard] Creating user with payload:', JSON.stringify(userPayload, null, 2));

    this.userService.addUser(userPayload).subscribe({
      next: (result: any) => {
        console.log('[AgentWizard] User created:', result?.id);
        this.createdUserId = result?.id || '';
        this.doCreateIntakeConfig();
      },
      error: (err: any) => {
        this.saving = false;
        const status = err?.status || 0;
        const body = err?.error;
        const detail = body?.detail;
        const errMsg = err?.message || '';

        console.error('[AgentWizard] User creation failed:', err);

        // 409 from HttpErrorResponse or interceptor-wrapped Error
        if (status === 409 || errMsg.includes('Conflict') || errMsg.includes('409')) {
          this.snackBar.open('User already exists \u2014 this email is already in the system.', 'Close', { duration: 10000 });
          return;
        }

        let msg = '';
        if (Array.isArray(detail)) {
          msg = detail.map((d: any) => (d.loc || []).join(' > ') + ': ' + d.msg).join(' | ');
        } else if (typeof detail === 'string') {
          msg = detail;
        } else if (errMsg) {
          msg = errMsg;
        } else {
          msg = 'User creation failed (HTTP ' + status + ')';
        }
        this.snackBar.open(msg, 'Close', { duration: 10000 });
      },
    });
  }

  private doCreateIntakeConfig(): void {
    // Convert empty strings to null for UUID fields — backend rejects ""
    const cpId = (this.assigned_cp_id && this.assigned_cp_id !== 'self' && this.assigned_cp_id !== '')
      ? this.assigned_cp_id
      : (this.role_type === 'cp' && this.createdUserId ? this.createdUserId : null);
    const rvpId = this.assigned_rvp_id || null;
    const agentId = this.createdUserId || null;

    const payload: any = {
      intake_name: 'ACI Intake - ' + this.first_name + ' ' + this.last_name,
      slug: this.intake_slug,
      is_active: true,
    };
    // Only include optional fields if they have real values
    if (this.chapter) payload.campaign_tag = this.chapter;
    if (this.rep_display_name) payload.rep_name = this.rep_display_name;
    if (this.title) payload.rep_title = this.title;
    if (this.phone) payload.rep_phone = this.phone;
    if (this.email) payload.rep_email = this.email;
    payload.ai_secretary_enabled = this.ai_secretary_enabled;
    if (cpId) payload.assigned_cp_id = cpId;
    if (rvpId) payload.assigned_rvp_id = rvpId;
    if (agentId) payload.assigned_agent_id = agentId;
    if (agentId) payload.default_assignee_id = agentId;
    payload.fallback_home_office = this.fallback_home_office;
    payload.rescue_enabled = this.rescue_enabled;
    payload.territory_enforcement = this.exclusive_territory;

    console.log('DEV INTAKE CONFIG PAYLOAD:', JSON.stringify(payload));

    this.intakeConfigService.create(payload).subscribe({
      next: (cfg: any) => {
        // If backend returned error dict instead of raising, handle gracefully
        if (cfg?.error) {
          console.error('[AgentWizard] Intake config backend error:', cfg.error);
          this.saving = false;
          this.complete = true;
          this.intakeUrl = '/intake/' + this.intake_slug;
          this.card_display_name = this.first_name + ' ' + this.last_name;
          this.card_title = this.title;
          this.card_phone = this.phone;
          this.card_email = this.email;
          this.snackBar.open('Intake config creation failed. Check server logs.', 'Close', { duration: 8000 });
          setTimeout(() => { if (this.stepper) this.stepper.next(); }, 150);
          return;
        }
        console.log('[AgentWizard] Intake config created:', cfg?.id, cfg?.slug);
        this.generatedPublicUrl = cfg.public_url || '';
        this.generatedTrackedUrl = cfg.tracked_outreach_url || '';
        this.generatedIntakeSlug = cfg.slug || '';
        this.intakeUrl = cfg.public_url || '/intake/' + this.intake_slug;
        this.card_display_name = this.first_name + ' ' + this.last_name;
        this.card_title = this.title;
        this.card_phone = this.phone;
        this.card_email = this.email;
        this.saving = false;
        this.complete = true;
        this.snackBar.open('Agent created', '', { duration: 3000 });
        setTimeout(() => { if (this.stepper) this.stepper.next(); }, 150);
      },
      error: (err: any) => {
        console.error('[AgentWizard] Intake config error — status:', err?.status, 'detail:', err?.error?.detail);

        this.saving = false;
        this.complete = true;
        this.intakeUrl = '/intake/' + this.intake_slug;
        this.card_display_name = this.first_name + ' ' + this.last_name;
        this.card_title = this.title;
        this.card_phone = this.phone;
        this.card_email = this.email;

        const detail = err?.error?.detail;
        const msg = (typeof detail === 'string' && detail.length < 120)
          ? detail
          : 'Intake config creation failed. Check server logs.';
        this.snackBar.open(msg, 'Close', { duration: 8000 });
        setTimeout(() => { if (this.stepper) this.stepper.next(); }, 150);
      },
    });
  }

  onCopyIntake(): void {
    if (!this.intakeUrl) return;
    navigator.clipboard.writeText(this.intakeUrl);
    this.snackBar.open('Copied', '', { duration: 1500 });
  }

  onDownloadVcard(): void {
    try {
      const vcf = [
        'BEGIN:VCARD', 'VERSION:3.0',
        'FN:' + (this.card_display_name || this.first_name + ' ' + this.last_name),
        'N:' + this.last_name + ';' + this.first_name + ';;;',
        'ORG:ACI Adjustment Group',
        this.card_title ? 'TITLE:' + this.card_title : '',
        this.card_phone ? 'TEL;TYPE=WORK,VOICE:' + this.card_phone : '',
        this.card_email ? 'EMAIL;TYPE=WORK:' + this.card_email : '',
        this.intakeUrl ? 'URL:' + this.intakeUrl : '',
        this.intakeUrl ? 'NOTE:File a claim at ' + this.intakeUrl : '',
        'END:VCARD',
      ].filter(Boolean).join('\r\n');
      const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (this.first_name || 'agent') + '-' + (this.last_name || 'aci') + '.vcf';
      a.click();
      URL.revokeObjectURL(url);
      this.snackBar.open('Contact card downloaded', '', { duration: 2000 });
    } catch {
      this.snackBar.open('Download failed', '', { duration: 3000 });
    }
  }

  goToUsers(): void {
    this.router.navigate(['/app/administration/users']);
  }

  startAnother(): void {
    this.complete = false;
    this.saving = false;
    this.createdUserId = '';
    this.generatedPublicUrl = '';
    this.generatedTrackedUrl = '';
    this.generatedIntakeSlug = '';
    this.first_name = ''; this.last_name = ''; this.phone = ''; this.email = '';
    this.title = ''; this.chapter = '';
    this.role_type = 'agent'; this.assigned_cp_id = ''; this.assigned_rvp_id = ''; this.supervisor_id = '';
    this.state = ''; this.county = ''; this.zip_codes = '';
    this.national_access = false; this.exclusive_territory = false;
    this.ai_secretary_enabled = true; this.ai_voice_enabled = true; this.ai_sales_enabled = true;
    this.greeting_style = 'professional'; this.rep_display_name = '';
    this.intake_slug = ''; this.source_credit_owner = 'agent';
    this.fallback_home_office = true; this.rescue_enabled = true;
    this.sales_credit = true; this.close_credit = true; this.adjuster_credit = false;
    this.hierarchy_payout = true; this.handling_mode = 'full-adjuster';
    this.card_display_name = ''; this.card_title = ''; this.card_phone = '';
    this.card_email = ''; this.intakeUrl = '';
    if (this.stepper) this.stepper.reset();
  }
}
