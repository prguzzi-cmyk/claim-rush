import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IntakeConfigService, IntakeConfig } from '../../../services/intake-config.service';

@Component({
  selector: 'app-intake-control',
  templateUrl: './intake-control.component.html',
  styleUrls: ['./intake-control.component.scss'],
  standalone: false,
})
export class IntakeControlComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  configs: IntakeConfig[] = [];
  loading = true;

  // Edit state
  editingId: string | null = null;
  draft: Partial<IntakeConfig> = {};

  // Create state
  creating = false;
  newSlug = '';

  constructor(
    private configService: IntakeConfigService,
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
    this.configService.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.configs = data; this.loading = false; },
        error: () => { this.loading = false; this.snackBar.open('Failed to load configs', '', { duration: 3000 }); },
      });
  }

  // ── Create ──

  openCreate(): void {
    this.creating = true;
    this.newSlug = '';
  }

  cancelCreate(): void {
    this.creating = false;
  }

  submitCreate(): void {
    if (!this.newSlug.trim()) return;
    this.configService.create({ slug: this.newSlug.trim(), intake_name: 'ACI Claim Intake' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Intake config created', '', { duration: 2000 });
          this.creating = false;
          this.loadConfigs();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to create', '', { duration: 3000 });
        },
      });
  }

  // ── Edit ──

  startEdit(cfg: IntakeConfig): void {
    this.editingId = cfg.id;
    this.draft = { ...cfg };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.draft = {};
  }

  saveEdit(): void {
    if (!this.editingId) return;
    this.configService.update(this.editingId, this.draft)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.snackBar.open('Config saved', '', { duration: 2000 });
          this.editingId = null;
          this.loadConfigs();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to save', '', { duration: 3000 });
        },
      });
  }

  deleteConfig(id: string): void {
    if (!confirm('Delete this intake configuration?')) return;
    this.configService.delete(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.snackBar.open('Deleted', '', { duration: 2000 }); this.loadConfigs(); },
        error: () => { this.snackBar.open('Failed to delete', '', { duration: 3000 }); },
      });
  }

  // ── Helpers ──

  copyLink(value: string | null): void {
    if (!value) return;
    navigator.clipboard.writeText(value);
    this.snackBar.open('Copied to clipboard', '', { duration: 1500 });
  }

  isEditing(id: string): boolean {
    return this.editingId === id;
  }
}
