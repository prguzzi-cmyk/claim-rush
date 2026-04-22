import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, forkJoin, map } from 'rxjs';

import {
  AgentProfileDTO,
  AgentProfileDataService,
  RoleOption,
} from 'src/app/services/agent-profile-data.service';

interface ManagerOption {
  id: string;
  label: string;   // "Carla Mendes (RVP-0001)"
  role: string;
}

/**
 * Admin-facing "+ Add Agent" dialog. Creates a User and its agent_profile
 * satellite in one backend transaction (POST /v1/agents/with-user).
 *
 * Manager dropdown filters by the selected role:
 *   AGENT selected   → show RVPs + CPs
 *   RVP selected     → show CPs
 *   CP / ADMIN / ADJUSTER → no manager (dropdown hidden)
 */
@Component({
  selector: 'app-add-agent-dialog',
  templateUrl: './add-agent-dialog.component.html',
  styleUrls: ['./add-agent-dialog.component.scss'],
  standalone: false,
})
export class AddAgentDialogComponent implements OnInit {
  form = {
    first_name: '',
    last_name: '',
    email: '',
    role_id: '',
    manager_id: null as string | null,
    employment_start_date: null as string | null,
  };

  roles: RoleOption[] = [];
  allAgents: AgentProfileDTO[] = [];
  saving = false;
  loading = true;
  errorText: string | null = null;

  constructor(
    private readonly data: AgentProfileDataService,
    private readonly dialogRef: MatDialogRef<AddAgentDialogComponent, AgentProfileDTO | null>,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    forkJoin({
      roles: this.data.listCommissionRoles$(),
      agents: this.data.list$(),
    }).subscribe({
      next: ({ roles, agents }) => {
        // Stable order: AGENT, RVP, CP, ADMIN, ADJUSTER
        const order = ['AGENT', 'RVP', 'CP', 'ADMIN', 'ADJUSTER'];
        this.roles = [...roles].sort(
          (a, b) => order.indexOf(a.name) - order.indexOf(b.name),
        );
        this.allAgents = agents;
        this.loading = false;
      },
      error: err => {
        this.errorText = err?.error?.detail || err?.message || String(err);
        this.loading = false;
      },
    });
  }

  selectedRoleName(): string {
    const r = this.roles.find(r => r.id === this.form.role_id);
    return r ? r.name : '';
  }

  showManagerPicker(): boolean {
    const name = this.selectedRoleName();
    return name === 'AGENT' || name === 'RVP';
  }

  managerOptions(): ManagerOption[] {
    const roleName = this.selectedRoleName();
    let allowed: string[] = [];
    if (roleName === 'AGENT') allowed = ['RVP', 'CP'];
    else if (roleName === 'RVP') allowed = ['CP'];
    else return [];

    return this.allAgents
      .filter(a => allowed.includes(a.user_role))
      .map(a => ({
        id: a.user_id,
        label: `${a.user_name} (${a.agent_number})`,
        role: a.user_role,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  canSubmit(): boolean {
    return (
      !this.saving &&
      !!this.form.first_name.trim() &&
      !!this.form.last_name.trim() &&
      !!this.form.email.trim() &&
      !!this.form.role_id
    );
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.saving = true;
    this.errorText = null;
    this.data.createWithUser$({
      first_name: this.form.first_name.trim(),
      last_name: this.form.last_name.trim(),
      email: this.form.email.trim(),
      role_id: this.form.role_id,
      manager_id: this.showManagerPicker() ? this.form.manager_id || null : null,
      employment_start_date: this.form.employment_start_date || null,
    }).subscribe({
      next: profile => {
        this.saving = false;
        this.snack.open(
          `${profile.user_name} created — ${profile.agent_number}`,
          'Dismiss',
          { duration: 4000 },
        );
        this.dialogRef.close(profile);
      },
      error: err => {
        this.saving = false;
        this.errorText = err?.error?.detail || err?.message || String(err);
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
