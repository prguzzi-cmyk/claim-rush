import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { AccountService } from 'src/app/services/account.service';

interface Credit {
  amount: number;
  summary: string;
  created_at: Date
}

@Component({
    selector: 'app-account-details-dialog',
    templateUrl: './account-details-dialog.component.html',
    styleUrls: ['./account-details-dialog.component.scss'],
    standalone: false
})
export class AccountDetailsDialogComponent implements OnInit {
  type: string;
  account_id: string

  accountForm = new FormGroup({
    email: new FormControl("", [Validators.required]),
    amount: new FormControl("", [Validators.required]),
    summary: new FormControl("", [Validators.required]),
  });

  credits :Credit[]= [];
  displayedColumns: string[] = [
    "id",
    "amount",
    "summary",
    "created_at",
  ];

  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private accountService: AccountService,
    private dialogRef: MatDialogRef<AccountDetailsDialogComponent>,
    private snackBar: MatSnackBar,
  ) {
    if (!data) {
      return
    }

    this.type = data.type
    if (this.type === 'view') {
      this.account_id = data.account_id
      this.getCreditList(this.account_id)
    }
  }

  getCreditList(account_id: string) {
    this.accountService.getCreditList(account_id, this.pageIndex, this.pageSize).subscribe((resp) => {
      this.credits = resp.items
      this.dataSource = new MatTableDataSource(resp.items);
      this.pageIndex = resp.page;
      this.totalRecords = resp.total;
    })
  }

  ngOnInit(): void {
  }


  changePage(event: PageEvent) {

    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

    this.getCreditList(this.account_id);

  }



  handleAddCredit(): void {
    const data = {
      email: this.accountForm.get('email').value,
      amount: this.accountForm.get('amount').value,
      summary: this.accountForm.get('summary').value
    }
    this.accountService.createCredit(data).subscribe((resp: any) => {
      this.dialogRef.close();

      if (resp.msg === 'Ok') {
        this.snackBar.open('Operation successful', "Close", {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        })
      } else {
        this.snackBar.open(resp.msg, "Close", {
          duration: 10000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
          panelClass: ['snackbar-error']
        })
      }

    })
  }
}
