import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map, switchMap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import {
  AgentProfileDataService,
  AgentProfileDTO,
} from 'src/app/services/agent-profile-data.service';
import { AddAgentDialogComponent } from './add-agent-dialog/add-agent-dialog.component';

/**
 * Administration → Agents list. Routes to the same AgentProfileDetailComponent
 * that the all-users admin list also routes to. Shows only AGENT / RVP / CP /
 * ADMIN roles (the license-holding side of the user base) — CLIENT, manager,
 * sales-rep, etc. are excluded by filter.
 */
@Component({
  selector: 'app-agents-list',
  templateUrl: './agents-list.component.html',
  styleUrls: ['./agents-list.component.scss'],
  standalone: false,
})
export class AgentsListComponent implements OnInit {
  agents$!: Observable<AgentProfileDTO[]>;
  private refresh$ = new BehaviorSubject<void>(undefined);

  // Client role, sales-rep, manager — intentionally excluded.
  private readonly ALLOWED_ROLES = new Set([
    'AGENT', 'RVP', 'CP', 'ADMIN', 'ADJUSTER',
    // Lowercase pre-existing role copies, just in case:
    'agent', 'rvp', 'cp', 'admin', 'super-admin',
  ]);

  constructor(
    private readonly data: AgentProfileDataService,
    private readonly router: Router,
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.agents$ = this.refresh$.pipe(
      switchMap(() => this.data.list$()),
      map(list => list.filter(a => this.ALLOWED_ROLES.has(a.user_role))),
    );
  }

  openAgent(agent: AgentProfileDTO): void {
    this.router.navigate(['/app/administration/users', agent.user_id]);
  }

  openAddAgent(): void {
    const ref = this.dialog.open(AddAgentDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      panelClass: 'add-agent-dialog-panel',
      autoFocus: false,
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.refresh$.next();
    });
  }

  roleToneClass(role: string): string {
    const upper = (role || '').toUpperCase();
    if (upper === 'AGENT') return 'role-agent';
    if (upper === 'RVP') return 'role-rvp';
    if (upper === 'CP') return 'role-cp';
    if (upper === 'ADMIN' || upper === 'SUPER-ADMIN') return 'role-admin';
    return 'role-other';
  }
}
