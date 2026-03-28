import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RotationLeadService } from '../../../../services/rotation-lead.service';
import { RotationLeadMetrics } from '../../../../models/rotation-lead.model';

@Component({
  selector: 'app-rotation-metrics',
  templateUrl: './rotation-metrics.component.html',
  styleUrls: ['./rotation-metrics.component.scss'],
  standalone: false,
})
export class RotationMetricsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  metrics: RotationLeadMetrics | null = null;
  loading = true;

  displayedAgentColumns = ['agent_name', 'leads_assigned', 'leads_contacted', 'leads_signed', 'closing_rate', 'avg_response_hours'];

  constructor(
    private rotationLeadService: RotationLeadService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadMetrics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMetrics(): void {
    this.loading = true;
    this.rotationLeadService.getMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.metrics = data;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.snackBar.open('Failed to load metrics', '', { duration: 3000 });
        },
      });
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
