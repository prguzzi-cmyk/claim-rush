import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { RotationLeadService } from '../../../../services/rotation-lead.service';
import { RotationConfig } from '../../../../models/rotation-lead.model';

@Component({
  selector: 'app-rotation-config',
  templateUrl: './rotation-config.component.html',
  styleUrls: ['./rotation-config.component.scss'],
  standalone: false,
})
export class RotationConfigComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  configs: RotationConfig[] = [];
  loading = true;

  // Editing state
  editingId: string | null = null;
  editTimeout = 24;
  editMaxAttempts = 5;
  editAutoReassign = true;
  editUsePerformanceWeighting = false;
  editWeightClosingRate = 0.4;
  editWeightResponseSpeed = 0.3;
  editWeightSatisfaction = 0.3;

  constructor(
    private rotationLeadService: RotationLeadService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadConfigs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadConfigs(): void {
    this.loading = true;
    this.rotationLeadService.listConfigs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.configs = Array.isArray(data) ? data : (data as any)?.items || [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.snackBar.open('Failed to load configs', '', { duration: 3000 });
        },
      });
  }

  createGlobalDefault(): void {
    this.rotationLeadService.createConfig({})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Global default config created', '', { duration: 2000 });
          this.loadConfigs();
        },
        error: () => this.snackBar.open('Failed to create config', '', { duration: 3000 }),
      });
  }

  startEdit(config: RotationConfig): void {
    this.editingId = config.id;
    this.editTimeout = config.contact_timeout_hours;
    this.editMaxAttempts = config.max_contact_attempts;
    this.editAutoReassign = config.auto_reassign_enabled;
    this.editUsePerformanceWeighting = config.use_performance_weighting ?? false;
    this.editWeightClosingRate = config.weight_closing_rate ?? 0.4;
    this.editWeightResponseSpeed = config.weight_response_speed ?? 0.3;
    this.editWeightSatisfaction = config.weight_satisfaction ?? 0.3;
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  getWeightTotal(): number {
    return Math.round(
      (this.editWeightClosingRate + this.editWeightResponseSpeed + this.editWeightSatisfaction) * 100
    ) / 100;
  }

  saveEdit(configId: string): void {
    this.rotationLeadService.updateConfig(configId, {
      contact_timeout_hours: this.editTimeout,
      max_contact_attempts: this.editMaxAttempts,
      auto_reassign_enabled: this.editAutoReassign,
      use_performance_weighting: this.editUsePerformanceWeighting,
      weight_closing_rate: this.editWeightClosingRate,
      weight_response_speed: this.editWeightResponseSpeed,
      weight_satisfaction: this.editWeightSatisfaction,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Config updated', '', { duration: 2000 });
          this.editingId = null;
          this.loadConfigs();
        },
        error: () => this.snackBar.open('Failed to update config', '', { duration: 3000 }),
      });
  }

  formatWeightLabel(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  getTerritoryName(config: RotationConfig): string {
    if (!config.territory_id) return 'Global Default';
    if (config.territory) return config.territory.name || config.territory_id;
    return config.territory_id;
  }
}
