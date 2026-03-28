import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { FireClaim } from '../../../../models/fire-claim.model';
import { FireClaimService } from '../../../../services/fire-claim.service';

@Component({
  standalone: false,
  selector: 'app-fire-claim-list',
  templateUrl: './fire-claim-list.component.html',
  styleUrls: ['./fire-claim-list.component.scss'],
})
export class FireClaimListComponent implements OnInit {
  displayedColumns: string[] = [
    'loss_date',
    'address',
    'insured_name',
    'status',
    'created_at',
  ];
  dataSource = new MatTableDataSource<FireClaim>([]);
  totalRecords = 0;
  pageSize = 25;
  currentPage = 1;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private fireClaimService: FireClaimService,
    private router: Router,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    this.loadClaims();
  }

  loadClaims(): void {
    this.spinner.show();
    this.fireClaimService.list(this.currentPage, this.pageSize).subscribe({
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
    this.loadClaims();
  }

  onRowClick(row: FireClaim): void {
    this.router.navigate(['/app/fire-claims', row.id]);
  }

  onNewClaim(): void {
    this.router.navigate(['/app/fire-claims/new']);
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'new':
        return 'New';
      case 'intake_complete':
        return 'Intake Complete';
      default:
        return status;
    }
  }
}
