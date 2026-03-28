import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { create } from 'domain';
import moment from 'moment';
import { NgxSpinnerService } from 'ngx-spinner';
import { AccountDetailsDialogComponent } from 'src/app/components/dialogs/account-details-dialog/account-details-dialog.component';
import { AccountService } from 'src/app/services/account.service';
import { DialogService } from 'src/app/services/dialog.service';
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: 'app-account-list',
    templateUrl: './account-list.component.html',
    styleUrls: ['./account-list.component.scss'],
    standalone: false
})
export class AccountListComponent implements OnInit {

  accounts = [];
  displayedColumns: string[] = [
    "id",
    "user_name",
    "email",
    "account_balance",
    "created_at",
    "updated_at",
    "view"
  ];

  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];

  constructor(
    private tabService: TabService,
    private dialogService: DialogService,
    private accountService: AccountService,
    private spinner: NgxSpinnerService,
  ) { }

  ngOnInit(): void {
    this.getAccounts()
  }
  getAccounts() {
    this.spinner.show();
    this.accountService.getAccountList(this.pageIndex, this.pageSize).subscribe(resp => {
      this.spinner.hide()
      this.dataSource = new MatTableDataSource(resp.items);
      this.accounts = resp.items;
      this.pageIndex = resp.page;
      this.totalRecords = resp.total;
    })
  }


  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  changePage(event: PageEvent) {

    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

  }

  handleAddCredit(): void {
    this.dialogService
      .openDialog(AccountDetailsDialogComponent, { type: "add" })
      .subscribe(() => this.getAccounts());
  }

  handleViewCreditHistory(account_id: string): void {
    this.dialogService
      .openDialog(AccountDetailsDialogComponent, { type: "view", account_id: account_id })
  }
}
