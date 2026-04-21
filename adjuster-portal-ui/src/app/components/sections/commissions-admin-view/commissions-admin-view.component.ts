import { Component, OnInit } from '@angular/core';
import { Observable, combineLatest, map, shareReplay } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import {
  AdminOverviewView,
  User,
} from 'src/app/models/commission-engine.model';
import { CommissionEngineMockService } from 'src/app/services/commission-engine-mock.service';
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
  users$!: Observable<User[]>;
  selectedUser$!: Observable<User | undefined>;

  selectedUserId: string | null = null;

  constructor(
    private readonly engine: CommissionEngineService,
    private readonly data: CommissionEngineMockService,
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.overview$ = this.engine.getAdminOverview().pipe(shareReplay(1));
    this.users$ = this.data.getUsers();
    this.selectedUser$ = combineLatest([this.users$]).pipe(
      map(([users]) => users.find(u => u.id === this.selectedUserId)),
    );
  }

  selectUser(userId: string): void {
    this.selectedUserId = userId;
    this.selectedUser$ = this.users$.pipe(map(us => us.find(u => u.id === userId)));
  }

  clearSelection(): void {
    this.selectedUserId = null;
    this.selectedUser$ = this.users$.pipe(map(() => undefined));
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
