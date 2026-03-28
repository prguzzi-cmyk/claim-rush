import { ClaimService } from 'src/app/services/claim.service';
import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { ClaimPayment } from 'src/app/models/payment-claim.model';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { UserService } from 'src/app/services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DialogService } from 'src/app/services/dialog.service';
import { ClaimLedgerDialogComponent } from 'src/app/components/dialogs/claim-ledger-dialog/claim-ledger-dialog.component';
import { NgxSpinnerService } from 'ngx-spinner';
import { MatSort, Sort } from '@angular/material/sort';
import { Claim } from 'src/app/models/claim.model';

@Component({
    selector: 'app-claim-ledger',
    templateUrl: './claim-ledger.component.html',
    styleUrls: ['./claim-ledger.component.scss'],
    standalone: false
})

export class ClaimLedgerComponent implements OnInit {

  @Output("getClaimPayments") getClaimPayments: EventEmitter<any> = new EventEmitter();

  @Input() claim: Claim;
  claimPayments: ClaimPayment[] = null;

  dataSourcePayments: MatTableDataSource<ClaimPayment>;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  @ViewChild('sort1') sort1: MatSort;
  queryParams: any;
  sortBy: any = 'created_at';
  orderBy: any = 'desc';

  totalRecords: number;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 500, 1000];
  pageIndex = 1;
  selectionLength = 0;

  // Summary data
  aciEstimateTotal = 0;
  carrierEstimateTotal = 0;
  totalPaid = 0;
  remainingRecoverable = 0;

  // Adjuster fee computed from claim fee_type and fee fields
  get adjusterFeeEarned(): number {
    if (!this.claim) return 0;
    const feeType = this.claim.fee_type || 'percentage';
    const feeVal = parseFloat(this.claim.fee as any) || 0;
    if (feeType === 'percentage' && feeVal > 0) {
      return Math.round(this.totalPaid * (feeVal / 100) * 100) / 100;
    }
    return feeVal;
  }

  get recoveryPercent(): number {
    return this.aciEstimateTotal > 0 ? (this.totalPaid / this.aciEstimateTotal) * 100 : 0;
  }

  // Payment type configuration for badges
  readonly paymentTypeConfig: Record<string, { color: string; icon: string }> = {
    'Initial Payment': { color: '#2196f3', icon: 'payments' },
    'Supplement Payment': { color: '#7b1fa2', icon: 'add_circle' },
    'Depreciation Payment': { color: '#e65100', icon: 'trending_down' },
    'Final Settlement': { color: '#4caf50', icon: 'check_circle' },
    'ACV Payment': { color: '#2196f3', icon: 'payments' },
    'RCV Holdback': { color: '#00838f', icon: 'lock' },
    'ALE Payment': { color: '#ff9800', icon: 'home' },
    'Ordinance & Law': { color: '#795548', icon: 'gavel' },
    'Contents Payment': { color: '#9c27b0', icon: 'inventory_2' },
    'Supplemental Payment': { color: '#7b1fa2', icon: 'add_circle' },
  };

  getPaymentTypeColor(type: string): string {
    return this.paymentTypeConfig[type]?.color || '#757575';
  }

  getPaymentTypeIcon(type: string): string {
    return this.paymentTypeConfig[type]?.icon || 'payments';
  }

  displayedColumns: string[] = ['sn', 'payment_date', 'ref_number', 'payment_type', 'amount', 'issued_by', 'payee', 'deposit_status', 'related_coverage', 'edit', 'delete'];

  constructor(
    private claimService: ClaimService,
    public userService: UserService,
    private snackBar: MatSnackBar,
    private dialogService: DialogService,
    private spinner: NgxSpinnerService
  ) { }

  ngOnInit(): void {
      if (this.userService.getUserPermissions('claim_payment', 'read')) {
        if (this.userService.getUserPermissions('claim_payment', 'read') && !this.claim?.is_collaborator) {
          this.getPayments();
          this.loadSummary();
        }
      }
  }

  loadSummary() {
    if (!this.claim?.id) return;
    this.claimService.getClaimPaymentSummary(this.claim.id).subscribe(
      (summary: any) => {
        this.aciEstimateTotal = summary.aci_estimate_total || 0;
        this.carrierEstimateTotal = summary.carrier_estimate_total || 0;
        this.totalPaid = summary.total_paid || 0;
        this.remainingRecoverable = summary.remaining_recoverable || 0;
      },
      (error: any) => {
        console.log('Payment summary not available', error);
      }
    );
  }

  getPayments() {
    this.spinner.show();

    let params = {
      page: this.pageIndex,
      size: this.pageSize,
      sort_by: this.sortBy,
      order_by: this.orderBy,
    };

    this.claimService.getClaimPayments(this.claim?.id, params).subscribe(claimPayments => {
      this.spinner.hide();

      if (claimPayments !== undefined) {
        this.claimPayments = claimPayments.items;
        this.dataSourcePayments = new MatTableDataSource(claimPayments.items);
        this.dataSourcePayments.sort = this.sort1;
        this.totalRecords = claimPayments.total;
        this.pageIndex = claimPayments.page;
        this.pageSize = claimPayments.size;
      }
    });
  }

  sort(sortState: Sort) {
    this.sortBy = sortState.active || 'created_at';
    this.orderBy = sortState.direction || 'asc';
    this.paginator.pageIndex = 0;
    this.getPayments();
  }

  changePage(event: PageEvent) {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
        this.pageIndex = 1;
    }
    this.getPayments();
  }

  openClaimPaymentAddDialog() {
    this.dialogService.openDialog(ClaimLedgerDialogComponent, { type: 'add', claim: this.claim })
      .subscribe(() => {
        this.getPayments();
        this.loadSummary();
        this.getClaimPayments.emit();
      });
  }

  openClaimPaymentEditDialog(claimPayment: ClaimPayment) {
    this.dialogService.openDialog(ClaimLedgerDialogComponent, { type: 'edit', claimPayment: claimPayment })
      .subscribe(() => {
        this.getPayments();
        this.loadSummary();
        this.getClaimPayments.emit();
      });
  }

  openClaimPaymentViewDialog(claimPayment: ClaimPayment) {
    this.dialogService.openDialog(ClaimLedgerDialogComponent, { type: 'view', claimPayment: claimPayment })
      .subscribe(() => this.getPayments());
  }

  openClaimPaymentDeleteDialog(claimPayment: ClaimPayment) {
    this.dialogService.openDialog(ClaimLedgerDialogComponent, { type: 'delete', claimPayment: claimPayment })
      .subscribe(() => {
        this.getPayments();
        this.loadSummary();
        this.getClaimPayments.emit();
      });
  }

}
