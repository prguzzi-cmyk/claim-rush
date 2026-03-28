import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RotationLeadService } from '../../../../services/rotation-lead.service';
import { UserService } from '../../../../services/user.service';
import {
  RotationLead,
  RotationLeadCreate,
  RotationLeadStatus,
} from '../../../../models/rotation-lead.model';

@Component({
  selector: 'app-rotation-lead-list',
  templateUrl: './rotation-lead-list.component.html',
  styleUrls: ['./rotation-lead-list.component.scss'],
  standalone: false,
})
export class RotationLeadListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  leads: RotationLead[] = [];
  loading = true;
  dataSource: MatTableDataSource<RotationLead>;

  displayedColumns: string[] = [
    'lead_source', 'owner_name', 'phone', 'property_address',
    'incident_type', 'lead_status', 'assigned_agent', 'assignment_date',
    'contact_attempt_count', 'outcome', 'actions',
  ];

  @ViewChild(MatPaginator) paginator: MatPaginator;

  // Filters
  statusFilter = '';
  incidentTypeFilter = '';

  statuses = Object.values(RotationLeadStatus);

  // Create dialog
  showCreateForm = false;
  newLead: RotationLeadCreate = {
    lead_source: '',
    property_address: '',
    property_city: '',
    property_state: '',
    property_zip: '',
    owner_name: '',
    phone: '',
    incident_type: '',
  };

  readonly statusColors: Record<string, string> = {
    new_lead: '#3b82f6',
    assigned: '#8b5cf6',
    attempted_contact: '#f59e0b',
    no_answer: '#ef4444',
    left_message: '#f97316',
    call_back_later: '#eab308',
    not_interested: '#6b7280',
    interested: '#10b981',
    signed_client: '#22c55e',
    invalid_lead: '#ef4444',
  };

  constructor(
    private rotationLeadService: RotationLeadService,
    public userService: UserService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadLeads();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLeads(): void {
    this.loading = true;
    const filters: any = {};
    if (this.statusFilter) filters.status = this.statusFilter;
    if (this.incidentTypeFilter) filters.incident_type = this.incidentTypeFilter;

    this.rotationLeadService.list(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.leads = Array.isArray(data) ? data : (data as any)?.items || [];
          this.dataSource = new MatTableDataSource(this.leads);
          this.dataSource.paginator = this.paginator;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.snackBar.open('Failed to load rotation leads', '', { duration: 3000 });
        },
      });
  }

  applyFilter(): void {
    this.loadLeads();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.incidentTypeFilter = '';
    this.loadLeads();
  }

  openDetail(lead: RotationLead): void {
    this.router.navigate(['/app/rotation-leads', lead.id]);
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
  }

  createLead(): void {
    this.rotationLeadService.create(this.newLead)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lead) => {
          this.snackBar.open('Lead created and auto-assigned', '', { duration: 3000 });
          this.showCreateForm = false;
          this.newLead = {
            lead_source: '', property_address: '', property_city: '',
            property_state: '', property_zip: '', owner_name: '',
            phone: '', incident_type: '',
          };
          this.loadLeads();
        },
        error: () => {
          this.snackBar.open('Failed to create lead', '', { duration: 3000 });
        },
      });
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || '#6b7280';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getAgentName(lead: RotationLead): string {
    if (lead.assigned_agent) {
      return `${lead.assigned_agent.first_name || ''} ${lead.assigned_agent.last_name || ''}`.trim();
    }
    return lead.assigned_agent_id ? 'Agent' : 'Unassigned';
  }
}
