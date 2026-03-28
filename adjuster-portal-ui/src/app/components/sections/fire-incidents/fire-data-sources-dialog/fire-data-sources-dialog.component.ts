import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FireDataSourceConfig } from 'src/app/models/fire-incident.model';
import { FireIncidentService } from 'src/app/services/fire-incident.service';

@Component({
  selector: 'app-fire-data-sources-dialog',
  templateUrl: './fire-data-sources-dialog.component.html',
  styleUrls: ['./fire-data-sources-dialog.component.scss'],
  standalone: false,
})
export class FireDataSourcesDialogComponent implements OnInit {
  configs: FireDataSourceConfig[] = [];
  isPolling: { [id: string]: boolean } = {};
  isLoading = false;

  constructor(
    private dialogRef: MatDialogRef<FireDataSourcesDialogComponent>,
    private fireIncidentService: FireIncidentService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadConfigs();
  }

  loadConfigs(): void {
    this.isLoading = true;
    this.fireIncidentService.getDataSourceConfigs().subscribe({
      next: (res) => {
        this.configs = res.items || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load data source configs.', 'Close', { duration: 3000 });
      },
    });
  }

  toggleActive(config: FireDataSourceConfig): void {
    this.fireIncidentService
      .updateDataSourceConfig(config.id, { is_active: !config.is_active })
      .subscribe({
        next: (updated) => {
          const idx = this.configs.findIndex((c) => c.id === updated.id);
          if (idx !== -1) this.configs[idx] = updated;
          this.configs = [...this.configs];
        },
        error: () => {
          this.snackBar.open('Failed to update data source.', 'Close', { duration: 3000 });
        },
      });
  }

  pollNow(config: FireDataSourceConfig): void {
    this.isPolling[config.id] = true;
    this.fireIncidentService.pollDataSource(config.id).subscribe({
      next: (res) => {
        this.isPolling[config.id] = false;
        this.snackBar.open(res?.msg || 'Poll complete.', 'OK', { duration: 4000 });
        this.loadConfigs();
      },
      error: () => {
        this.isPolling[config.id] = false;
        this.snackBar.open('Poll failed.', 'Close', { duration: 4000 });
      },
    });
  }

  deleteConfig(config: FireDataSourceConfig): void {
    if (!confirm(`Delete data source "${config.name}"?`)) return;
    this.fireIncidentService.deleteDataSourceConfig(config.id).subscribe({
      next: () => {
        this.configs = this.configs.filter((c) => c.id !== config.id);
        this.snackBar.open('Data source deleted.', 'OK', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete data source.', 'Close', { duration: 3000 });
      },
    });
  }

  getSourceTypeLabel(type: string): string {
    switch (type) {
      case 'socrata': return 'Socrata (911)';
      case 'nifc': return 'NIFC Wildland';
      case 'firms': return 'NASA FIRMS';
      default: return type;
    }
  }

  getSourceTypeClass(type: string): string {
    switch (type) {
      case 'socrata': return 'type-socrata';
      case 'nifc': return 'type-nifc';
      case 'firms': return 'type-firms';
      default: return '';
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
