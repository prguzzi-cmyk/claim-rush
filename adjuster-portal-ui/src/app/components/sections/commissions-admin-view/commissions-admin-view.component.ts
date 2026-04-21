import { Component, OnInit } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import {
  AdminOverviewView,
  User,
} from 'src/app/models/commission-engine.model';
import { CommissionEngineService } from 'src/app/services/commission-engine.service';
import { CommissionStatementDialogComponent } from '../agent-dashboard/earnings-tab/commission-statement-dialog/commission-statement-dialog.component';

/**
 * Admin / RIN House view.
 * Reuses EarningsTabComponent to drill into any writing agent.
 * Same engine, admin-level visibility (all users, house share roll-up).
 */
@Component({
  selector: 'app-commissions-admin-view',
  templateUrl: './commissions-admin-view.component.html',
  styleUrls: ['./commissions-admin-view.component.scss'],
  standalone: false,
})
export class CommissionsAdminViewComponent implements OnInit {
  overview$!: Observable<AdminOverviewView>;
  selectedUser$!: Observable<User | undefined>;

  selectedUserId: string | null = null;

  constructor(
    private readonly engine: CommissionEngineService,
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.overview$ = this.engine.getAdminOverview().pipe(shareReplay(1));
    // Drill-down derives the selected User from the overview rows — the admin
    // overview already returns user_id / user_name / org_role per row, which
    // is all the drill header needs.
    this.refreshSelected();
  }

  private refreshSelected(): void {
    this.selectedUser$ = this.overview$.pipe(
      map(o => {
        const row = o.rows.find(r => r.user_id === this.selectedUserId);
        if (!row) return undefined;
        return {
          id: row.user_id,
          name: row.user_name,
          org_role: row.org_role,
          avatar_initials: row.user_name
            .split(' ')
            .map(s => s[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase(),
        } as User;
      }),
    );
  }

  selectUser(userId: string): void {
    this.selectedUserId = userId;
    this.refreshSelected();
  }

  clearSelection(): void {
    this.selectedUserId = null;
    this.refreshSelected();
  }

  openStatementFor(userId: string, userName: string, event: MouseEvent): void {
    event.stopPropagation();
    this.dialog.open(CommissionStatementDialogComponent, {
      width: '1080px',
      maxWidth: '98vw',
      maxHeight: '94vh',
      panelClass: 'statement-dialog-panel',
      data: { userId, userDisplayName: userName },
      autoFocus: false,
    });
  }
}
