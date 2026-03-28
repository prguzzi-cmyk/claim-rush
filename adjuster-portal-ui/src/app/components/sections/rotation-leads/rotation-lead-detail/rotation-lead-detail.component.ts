import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RotationLeadService } from '../../../../services/rotation-lead.service';
import { UserService } from '../../../../services/user.service';
import {
  RotationLead,
  RotationLeadActivity,
  RotationLeadStatus,
  ContactAttemptRequest,
} from '../../../../models/rotation-lead.model';

@Component({
  selector: 'app-rotation-lead-detail',
  templateUrl: './rotation-lead-detail.component.html',
  styleUrls: ['./rotation-lead-detail.component.scss'],
  standalone: false,
})
export class RotationLeadDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  lead: RotationLead | null = null;
  loading = true;
  leadId = '';

  statuses = Object.values(RotationLeadStatus);

  // Contact attempt form
  contactOutcome = '';
  contactNotes = '';

  // Reassign
  reassignAgentId = '';
  reassignReason = '';

  readonly activityIcons: Record<string, string> = {
    created: 'add_circle',
    assigned: 'person_add',
    contact_attempted: 'phone',
    status_changed: 'swap_horiz',
    reassigned: 'swap_calls',
    escalated: 'priority_high',
    note_added: 'note_add',
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
    private route: ActivatedRoute,
    private router: Router,
    private rotationLeadService: RotationLeadService,
    public userService: UserService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.leadId = this.route.snapshot.paramMap.get('id') || '';
    this.loadLead();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLead(): void {
    this.loading = true;
    this.rotationLeadService.getById(this.leadId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.lead = data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.snackBar.open('Failed to load lead', '', { duration: 3000 });
        },
      });
  }

  updateStatus(newStatus: string): void {
    this.rotationLeadService.update(this.leadId, { lead_status: newStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Status updated', '', { duration: 2000 });
          this.loadLead();
        },
        error: () => this.snackBar.open('Failed to update status', '', { duration: 3000 }),
      });
  }

  recordContact(): void {
    if (!this.contactOutcome) return;

    const data: ContactAttemptRequest = {
      outcome: this.contactOutcome,
      notes: this.contactNotes || undefined,
    };

    this.rotationLeadService.recordContact(this.leadId, data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Contact attempt recorded', '', { duration: 2000 });
          this.contactOutcome = '';
          this.contactNotes = '';
          this.loadLead();
        },
        error: () => this.snackBar.open('Failed to record contact', '', { duration: 3000 }),
      });
  }

  reassignLead(): void {
    this.rotationLeadService.reassign(this.leadId, {
      new_agent_id: this.reassignAgentId || undefined,
      reason: this.reassignReason || undefined,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Lead reassigned', '', { duration: 2000 });
          this.reassignAgentId = '';
          this.reassignReason = '';
          this.loadLead();
        },
        error: () => this.snackBar.open('Failed to reassign', '', { duration: 3000 }),
      });
  }

  goBack(): void {
    this.router.navigate(['/app/rotation-leads']);
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || '#6b7280';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getActivityIcon(type: string): string {
    return this.activityIcons[type] || 'info';
  }

  getAgentName(): string {
    if (this.lead?.assigned_agent) {
      return `${this.lead.assigned_agent.first_name || ''} ${this.lead.assigned_agent.last_name || ''}`.trim();
    }
    return this.lead?.assigned_agent_id || 'Unassigned';
  }

  getPerformerName(activity: RotationLeadActivity): string {
    if (activity.performed_by) {
      return `${activity.performed_by.first_name || ''} ${activity.performed_by.last_name || ''}`.trim();
    }
    return 'System';
  }
}
