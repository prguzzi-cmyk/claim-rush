import { Component, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CallTypeConfigService } from 'src/app/services/call-type-config.service';

interface CallTypeConfig {
  id: string;
  code: string;
  description: string;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-call-type-configs',
  templateUrl: './call-type-configs.component.html',
  styleUrls: ['./call-type-configs.component.scss'],
  standalone: false,
})
export class CallTypeConfigsComponent implements OnInit {
  dataSource: MatTableDataSource<CallTypeConfig> = new MatTableDataSource([]);
  configs: CallTypeConfig[] = [];
  isLoading = false;

  displayedColumns: string[] = ['sort_order', 'code', 'description', 'is_enabled'];

  constructor(
    private callTypeConfigService: CallTypeConfigService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadConfigs();
  }

  loadConfigs(): void {
    this.isLoading = true;
    this.callTypeConfigService.getCallTypeConfigs(1, 50).subscribe({
      next: (res) => {
        this.configs = res.items || [];
        this.dataSource = new MatTableDataSource(this.configs);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  onToggle(config: CallTypeConfig): void {
    const newValue = !config.is_enabled;
    this.callTypeConfigService
      .updateCallTypeConfig(config.id, { is_enabled: newValue })
      .subscribe({
        next: (updated) => {
          config.is_enabled = updated.is_enabled;
          const action = newValue ? 'enabled' : 'disabled';
          this.snackBar.open(
            `${config.code} (${config.description}) ${action}`,
            'OK',
            { duration: 3000 }
          );
        },
        error: () => {
          this.snackBar.open('Failed to update call type config', 'Close', {
            duration: 4000,
          });
        },
      });
  }

  getCallTypeBadgeClass(code: string): string {
    const fireTypes = [
      'SF', 'CF', 'RF', 'WSF', 'WCF', 'WRF',
      'FF', 'VEG', 'WVEG', 'VF', 'AF', 'CHIM', 'ELF',
      'GF', 'MF', 'OF', 'PF', 'TF', 'WF', 'FIRE', 'FULL', 'IF',
    ];
    if (fireTypes.includes(code)) return 'badge-fire';
    if (code === 'ME' || code === 'EMS' || code === 'CPR' || code === 'IFT' || code === 'MCI') return 'badge-medical';
    if (['FA', 'BA', 'AED', 'MA', 'SD', 'TRBL', 'WFA', 'CMA'].includes(code)) return 'badge-alarm';
    if (code === 'SAT') return 'badge-satellite';
    if (code === '911') return 'badge-dispatch';
    return 'badge-default';
  }
}
