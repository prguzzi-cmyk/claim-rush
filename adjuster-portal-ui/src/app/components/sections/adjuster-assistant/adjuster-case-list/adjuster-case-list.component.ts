import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { AdjusterCase } from '../../../../models/adjuster-case.model';
import { AdjusterCaseService } from '../../../../services/adjuster-case.service';

const STEP_LABELS: Record<number, string> = {
  0: 'Intake',
  1: 'Policy Analysis',
  2: 'Damage Review',
  3: 'Draft Scope',
  4: 'Draft Estimate',
  5: 'Gap Analysis',
  6: 'PA Review',
  7: 'Complete',
};

@Component({
  standalone: false,
  selector: 'app-adjuster-case-list',
  templateUrl: './adjuster-case-list.component.html',
  styleUrls: ['./adjuster-case-list.component.scss'],
})
export class AdjusterCaseListComponent implements OnInit {
  displayedColumns: string[] = [
    'case_number',
    'intake_insured_name',
    'intake_address',
    'status',
    'current_step',
    'created_at',
  ];
  dataSource = new MatTableDataSource<AdjusterCase>([]);
  totalRecords = 0;
  pageSize = 25;
  currentPage = 1;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private caseService: AdjusterCaseService,
    private router: Router,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    this.loadCases();
  }

  loadCases(): void {
    this.spinner.show();
    this.caseService.list(this.currentPage, this.pageSize).subscribe({
      next: (res: any) => {
        this.dataSource.data = res?.items || [];
        this.totalRecords = res?.total || 0;
        this.spinner.hide();
      },
      error: () => {
        this.spinner.hide();
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadCases();
  }

  onRowClick(row: AdjusterCase): void {
    this.router.navigate(['/app/adjuster-assistant', row.id]);
  }

  onNewCase(): void {
    this.router.navigate(['/app/adjuster-assistant/new']);
  }

  getStepLabel(step: number): string {
    return STEP_LABELS[step] || `Step ${step}`;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'intake': return 'badge-intake';
      case 'policy_analysis': return 'badge-policy';
      case 'damage_review': return 'badge-damage';
      case 'draft_scope': return 'badge-scope';
      case 'draft_estimate': return 'badge-estimate';
      case 'pa_review': return 'badge-review';
      case 'complete': return 'badge-complete';
      default: return '';
    }
  }
}
