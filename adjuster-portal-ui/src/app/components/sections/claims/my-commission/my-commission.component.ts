import {Component, OnInit, ViewChild} from '@angular/core';
import {UserService} from "../../../../services/user.service";
import {FormBuilder, FormControl} from "@angular/forms";
import {NgxSpinnerService} from "ngx-spinner";
import {MatSnackBar} from "@angular/material/snack-bar";
import {TabService} from "../../../../services/tab.service";
import {MatTableDataSource} from "@angular/material/table";
import {MatPaginator, PageEvent} from "@angular/material/paginator";
import {Commission} from "../../../../models/commission.model";
import {User} from "../../../../models/user.model";
import {SelectionModel} from "@angular/cdk/collections";
import {MatSort} from "@angular/material/sort";
import {CommissionService} from "../../../../services/commission.service";

@Component({
    selector: 'app-my-commission',
    templateUrl: './my-commission.component.html',
    styleUrls: ['./my-commission.component.scss'],
    standalone: false
})
export class MyCommissionComponent implements OnInit {

  searchFormGroup = this._formBuilder.group({
    commissionOwnerId: new FormControl('', []),
    status: new FormControl(0, []),
  });

  commissions: any = [];

  displayedColumnsCommissions: string[] = [
    'select',
    'claim_id',
    'claim_ref_string',
    'payment_id',
    'payment_ref_string',
    'check_amount',
    'contingency_fee_percentage',
    'commission_type',
    'fee_percentage',
    'fee_amount',
    'status',
    'created_at'
  ];

  dataSourceCommissions: MatTableDataSource<Commission>;
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  selection = new SelectionModel<Commission>(true, []);
  @ViewChild(MatSort) sort: MatSort;

  queryParams: any = {};
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100, 500];
  totalRecords = 0;

  private user: User;

  constructor(
      public userService: UserService,
      private _formBuilder: FormBuilder,
      private commissionService: CommissionService,
      private spinner: NgxSpinnerService,
      private snackBar: MatSnackBar,
      private tabService: TabService,
  ) { }

  ngOnInit(): void {
    this.spinner.show();
    this.getUser();
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }


  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    this.isAllSelected()
        ? this.selection.clear()
        : this.dataSourceCommissions.data.forEach((row) =>
            this.selection.select(row)
        );
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSourceCommissions.data.length;
    return numSelected === numRows;
  }

  getUser() {
    this.userService.currentUser.subscribe((user) => {
      if (user) {
        this.user = user;
        this.search(1, this.pageSize);
      }
    });
  }

  doSearch() {
    this.spinner.show();
    this.search(1, this.pageSize)
  }

  search(page: number, size: number) {
    if (page == 1 ) {
      this.paginator.pageIndex = 0;
    }

    this.spinner.show();
    this.commissions = [];

    this.searchFormGroup.markAllAsTouched();

    if (this.searchFormGroup.valid) {
      this.selection.clear();

      let status = this.searchFormGroup.get('status').value;
      this.queryParams['commissionOwnerId'] = this.user.id;
      this.queryParams['status'] = status;

      this.commissionService.getCommissions(this.user.id, status, page, size).subscribe(
          (commissions) => {
            this.spinner.hide();
            this.commissions = commissions;
            if (commissions !== undefined) {
              // filter deleted claims
              this.dataSourceCommissions = new MatTableDataSource(
                  commissions?.items
              );

              this.totalRecords = commissions?.total_items;
              this.pageIndex = commissions?.page_num;
              this.pageSize = commissions?.page_size;
            }
          },
          (error) => {
            this.spinner.hide();
            this.snackBar.open(
                'Error: ' +
                error?.message  ,
                'Close',
                {
                  duration: 10000,
                  horizontalPosition: 'end',
                  verticalPosition: 'bottom',
                  panelClass: ['snackbar-error'],
                }
            );
          }
      );
    }
  }

  translate2Percentage(commission: Commission) : string {
    if (commission && commission.fee_percentage) {
      return Number(commission.fee_percentage) * 100 + '%';
    } else {
      return "";
    }
  }

  translateCommissionType(commission: Commission) {
    if (1== commission.commission_type) {
      return "SOURCE";
    } else if (0== commission.commission_type) {
      return "SIGN";
    } else if (2== commission.commission_type) {
      return "ADJUST"
    } else if (3== commission.commission_type) {
      return  this.getOwnerTitleName(commission) + " OVERRIDES";
    } else {
      return "";
    }
  }

  private getOwnerTitleName(commission: Commission) {
    if (commission.owner_title_id === 1) {
      return "UPA ORG";
    } else if (commission.owner_title_id === 2) {
      return "SSA";
    } else if (commission.owner_title_id === 3) {
      return "DM";
    } else if (commission.owner_title_id === 4) {
      return "SDM";
    } else if (commission.owner_title_id === 5) {
      return "DVM";
    } else if (commission.owner_title_id === 6) {
      return "RVP";
    } else if (commission.owner_title_id === 7) {
      return "EVP"
    } else if (commission.owner_title_id === 8) {
      return "CP";
    }
    return commission.owner_title_id;
  }

  translateStatus(commission: Commission) {
    if (commission.status === 0) {
      return "NEW";
    } else if (commission.status === 1) {
      return "CONFIRMED";
    } else if (commission.status === 2) {
      return "ARCHIVED";
    } else {
      return "";
    }
  }

  translateContingencyFeeRate(commission: Commission) : string {
    if (commission && commission.contingency_fee_percentage) {
      return Number(commission.contingency_fee_percentage) * 100 + '%';
    } else {
      return "";
    }
  }

  changePage(event: PageEvent) {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

    this.search(this.pageIndex, this.pageSize);
  }
}
