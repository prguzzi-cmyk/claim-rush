import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { PolicyDocument, PolicyDocumentSearch } from 'src/app/models/policy-document.model';
import { PolicyDocumentService } from 'src/app/services/policy-document.service';

@Component({
  standalone: false,
  selector: 'app-policy-vault-list',
  templateUrl: './policy-vault-list.component.html',
  styleUrls: ['./policy-vault-list.component.scss'],
})
export class PolicyVaultListComponent implements OnInit {
  displayedColumns: string[] = [
    'insured_name',
    'claim_number',
    'carrier',
    'policy_number',
    'policy_type',
    'effective_date',
    'expiration_date',
    'property_state',
    'extraction_status',
    'assistant_ready',
    'created_at',
  ];
  dataSource = new MatTableDataSource<PolicyDocument>([]);
  totalRecords = 0;
  pageSize = 25;
  currentPage = 1;

  // Search filters
  searchCarrier = '';
  searchPolicyNumber = '';
  searchInsuredName = '';
  searchPolicyType = '';
  searchState = '';

  policyTypes = ['homeowners', 'fire', 'commercial', 'auto', 'flood', 'umbrella'];

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private policyService: PolicyDocumentService,
    private router: Router,
    private snackBar: MatSnackBar,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit(): void {
    this.loadPolicies();
  }

  loadPolicies(): void {
    this.spinner.show();
    const filters: PolicyDocumentSearch = {};
    if (this.searchCarrier) filters.carrier = this.searchCarrier;
    if (this.searchPolicyNumber) filters.policy_number = this.searchPolicyNumber;
    if (this.searchInsuredName) filters.insured_name = this.searchInsuredName;
    if (this.searchPolicyType) filters.policy_type = this.searchPolicyType;
    if (this.searchState) filters.property_state = this.searchState;

    this.policyService.list(this.currentPage, this.pageSize, filters).subscribe({
      next: (res: any) => {
        this.dataSource.data = res?.items || [];
        this.totalRecords = res?.total || 0;
        this.spinner.hide();
      },
      error: () => {
        this.spinner.hide();
        this.snackBar.open('Failed to load policies', 'Close', { duration: 3000 });
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadPolicies();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadPolicies();
  }

  clearSearch(): void {
    this.searchCarrier = '';
    this.searchPolicyNumber = '';
    this.searchInsuredName = '';
    this.searchPolicyType = '';
    this.searchState = '';
    this.currentPage = 1;
    this.loadPolicies();
  }

  onRowClick(row: PolicyDocument): void {
    this.router.navigate(['/app/policy-vault', row.id]);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.spinner.show();
    this.policyService.upload(file).subscribe({
      next: () => {
        this.snackBar.open('Policy uploaded', 'Close', { duration: 2000 });
        input.value = '';
        this.loadPolicies();
      },
      error: () => {
        this.spinner.hide();
        this.snackBar.open('Upload failed', 'Close', { duration: 3000 });
      },
    });
  }
}
