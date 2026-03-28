import {Component, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormControl} from "@angular/forms";
import {MatTableDataSource} from "@angular/material/table";
import {Commission} from "../../../models/commission.model";
import {MatPaginator, PageEvent} from "@angular/material/paginator";
import {SelectionModel} from "@angular/cdk/collections";
import {MatSort} from "@angular/material/sort";
import {User} from "../../../models/user.model";
import {UserService} from "../../../services/user.service";
import {CommissionService} from "../../../services/commission.service";
import {NgxSpinnerService} from "ngx-spinner";
import {MatSnackBar} from "@angular/material/snack-bar";
import {TabService} from "../../../services/tab.service";
import {CommissionReadjustDialogComponent} from "./commission-readjust-dialog/commission-readjust-dialog.component";
import {DialogService} from "../../../services/dialog.service";
import {forkJoin} from "rxjs";
import {map} from "rxjs/operators";

@Component({
    selector: 'app-commission-admin',
    templateUrl: './commission-admin.component.html',
    styleUrls: ['./commission-admin.component.scss'],
    standalone: false
})
export class CommissionAdminComponent implements OnInit {

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
    'owner_id',
    'status',
    'created_at',
    'readjust'
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


  users: [User];
  private user: User;

  constructor(
      public userService: UserService,
      private _formBuilder: FormBuilder,
      private commissionService: CommissionService,
      private spinner: NgxSpinnerService,
      private snackBar: MatSnackBar,
      private dialogService: DialogService,
      private tabService: TabService,
  ) { }

  ngOnInit(): void {
    forkJoin({
      currentUser: this.userService.getUser(),
      allUsers: this.userService.getUsers(1, 500)
    }).pipe(
        map(({ currentUser, allUsers }) => {
          return {currentUser, allUsers};
        })
    ).subscribe(
        combinedResult => {
          this.users =  combinedResult.allUsers.items;
          this.user= combinedResult.currentUser;
          this.doSearch();
        },
        error => {
          console.error('Error occurred:', error);
        }
    );

  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  tryReadjustCommission(commission: Commission) {
      this.dialogService.openDialog(CommissionReadjustDialogComponent, {
      width: "650px",
      targetCommission: commission
    })
  .subscribe(() => {
      this.search(this.pageIndex, this.pageSize);
      this.selection.clear();
    });
  }


  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    this.isAllSelected()
        ? this.selection.clear()
        : this.dataSourceCommissions.data.forEach((row) =>
            this.selection.select(row)
        );
  }

  compareUserObjects(u1: User, u2: User) {
    return u1 && u2 && u1.id == u2.id;
  }
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSourceCommissions.data.length;
    return numSelected === numRows;
  }

  // getUser() {
  //   this.userService.currentUser.subscribe((user) => {
  //     if (user) {
  //       this.user = user;
  //     }
  //   });
  // }

  isConfirmButtonVisible() {
    if (this.user?.role?.name === 'super-admin' || this.user?.role?.name === 'admin') {
      return true;
    } else {
      return false;
    }
  }


  isConfirmButtonDisabled() {
    const selected = this.selection.selected;
    if (selected.length > 0) {
      const status = selected.map(value => value.status);
      if (status.length && status[0] > 0) {
        return true;
      }

      const ownerIds = selected.map(value => value.owner_id);
      const uniqueSet: Set<string> = new Set(ownerIds);
      if (uniqueSet.size === 1) {
        return false;
      } else {
        return true;
      }
    } else {
      return true;
    }
  }

  confirmCommissions() {
    const ownerIds = this.selection.selected.map(value => value.owner_id);
    const uniqueSet: Set<string> = new Set(ownerIds);
    if (uniqueSet.size > 1) {
      return;
    }
    const userConfirmed = confirm('Are you sure you want to confirm the selected commissions?');
    if (userConfirmed) {
      const ownerId = uniqueSet.values().next().value;
      this.commissionService.confirmCommission({
        "owner_uid" : ownerId,
        "old_status" : 0,
        "new_status": 1
      }).subscribe((data) => {
        this.search(this.pageIndex, this.pageSize);
        this.spinner.hide();
        console.log('confirmCommission done...')
      });
    }
  }

  search(page: number, size: number) {
    if (page == 1 ) {
      this.paginator.pageIndex = 0;
    }

    this.spinner.show();
    this.commissions = [];

    this.searchFormGroup.markAllAsTouched();
    // if (this.searchFormGroup.valid) {
    let owner_id = this.searchFormGroup.get('commissionOwnerId').value.trim();
    let status = this.searchFormGroup.get('status').value;

    this.queryParams['commissionOwnerId'] = owner_id;
    this.queryParams['status'] = status;
    console.log(this.queryParams);

    this.selection.clear();
    this.commissionService.getCommissions(owner_id, status, page, size).subscribe(
        (commissions) => {
          console.log(commissions);
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
    // }
  }

  doSearch() {
    this.spinner.show();
    this.search(1, this.pageSize)
  }

  translateOwnerInfo(commission: Commission) {
    const currentUser = this.users?.filter((value: User) => value.id === commission.owner_id);
    if (currentUser && currentUser.length> 0) {
      return currentUser[0].first_name + " " + currentUser[0].last_name;
    } else {
      return commission.owner_id;
    }
  }

  translateContingencyFeeRate(commission: Commission) : string {
    if (commission && commission.contingency_fee_percentage) {
      return Number(commission.contingency_fee_percentage).toFixed(2) + '%';
    } else {
      return "";
    }
  }

  translateFeePercentage(commission: Commission) : string {
    if (commission && commission.fee_percentage) {
      const number = 100 * Number(commission.fee_percentage);
      return number.toFixed(2) + '%'; ;
    } else {
      return "";
    }
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

  changePage(event: PageEvent) {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

    this.search(this.pageIndex, this.pageSize);
  }

  generateRealTimeCommissions() {
    this.spinner.show();
    this.commissionService.generateCommission().subscribe(
        response => {
          this.spinner.hide();
          const result: Commission[] = (<Commission[]>response);
          if (result.length > 0) {
            this.doSearch()
          }
          this.snackBar.open(result.length + ' Commissions generated successfully!', 'Close', { duration: 3000 });
        },
        error => {
          this.snackBar.open('Failed to generate commissions. Please try again.', 'Close', { duration: 3000 });
        }
    );
  }

  onClaimDetail(id: string, name: string) {
    this.tabService.addItem({id, name, type:"claim"});
  }
}
