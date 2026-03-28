import { Component, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClaimReport } from 'src/app/models/client-portal.model';

@Component({
  selector: 'app-cp-reports',
  templateUrl: './cp-reports.component.html',
  styleUrls: ['./cp-reports.component.scss'],
  standalone: false,
})
export class CpReportsComponent {
  @Input() reports: ClaimReport[] = [];
  activeFilter: string | null = null;

  reportTypes: { value: string; label: string; icon: string }[] = [
    { value: 'claim_report', label: 'Claim Report', icon: 'description' },
    { value: 'supplement_report', label: 'Supplement Report', icon: 'add_circle' },
    { value: 'inspection_report', label: 'Inspection Report', icon: 'search' },
    { value: 'estimate_report', label: 'Estimate Report', icon: 'calculate' },
  ];

  constructor(private snackBar: MatSnackBar) {}

  get filteredReports(): ClaimReport[] {
    if (!this.activeFilter) return this.reports;
    return this.reports.filter(r => r.type === this.activeFilter);
  }

  toggleFilter(type: string): void {
    this.activeFilter = this.activeFilter === type ? null : type;
  }

  getTypeLabel(type: string): string {
    return this.reportTypes.find(t => t.value === type)?.label || type;
  }

  getTypeIcon(type: string): string {
    return this.reportTypes.find(t => t.value === type)?.icon || 'description';
  }

  downloadReport(report: ClaimReport): void {
    this.snackBar.open(`Downloading "${report.name}"...`, 'OK', { duration: 2500 });
  }
}
