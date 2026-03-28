import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { DialogService } from 'src/app/services/dialog.service';
import { PermissionService } from 'src/app/services/permission.service';
import { PoliciesDialogComponent } from '../../dialogs/policies-dialog/policies-dialog.component';
import { User } from 'src/app/models/user.model';
import { UserService } from 'src/app/services/user.service';
import { NgxSpinner, NgxSpinnerService } from 'ngx-spinner';
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: 'app-policies',
    templateUrl: './policies.component.html',
    styleUrls: ['./policies.component.scss'],
    standalone: false
})
export class PoliciesComponent implements OnInit {

  pageIndex = 1;
  pageSize = 10;
  totalRecords = 0

  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  
  user: User;

  policies: [any];
  policy: any;
  displayedColumns: string[] = [
    "sn",
    "first_name",
    "last_name",
    "created_at",
    "updated_at",
    "edit",
    "delete",
  ];

  constructor(
    private permissionService: PermissionService,
    private dialogService: DialogService,
    private userService: UserService,
    private spinner: NgxSpinnerService,
    private tabService: TabService,
  ) { }

  ngOnInit(): void {
    this.getUser();

  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  onPageChange(event) {
    this.pageIndex = event.pageIndex;

    if (this.pageIndex == 0) {
        this.pageIndex = 1;
    }
    
    this.pageSize = event.pageSize;
    this.getPolicies();  
  }

  getPolicies() {
    this.spinner.show();
    this.permissionService.getPolicies(this.pageIndex, this.pageSize).subscribe((policies) => {
      let _policies = policies.items.sort((a, b) => {
        if (a.module < b.module) {
          return -1;
        }
      });
      this.dataSource = new MatTableDataSource(_policies);
      this.dataSource.paginator = this.paginator;
      this.policies = policies;
      this.totalRecords = policies.total;
      this.pageSize = policies.size;
      this.pageIndex = policies.page;
      this.spinner.hide();
    });
  }

  openPolicyViewDialog(policy) {
    this.dialogService
      .openDialog(PoliciesDialogComponent, { type: "view", policy: policy })
      .subscribe(() => this.getPolicies());
  }

  openPolicyEditDialog(policy) {
    this.dialogService
      .openDialog(PoliciesDialogComponent, { type: "edit", policy: policy })
      .subscribe(() => this.getPolicies());
  }

  openPolicyAddDialog() {
    this.dialogService
      .openDialog(PoliciesDialogComponent, { type: "add" })
      .subscribe(() => this.getPolicies());
  }

  openPermissionEditDialog(policy) {
    this.dialogService
      .openDialog(PoliciesDialogComponent, { type: "edit", policy: policy })
      .subscribe(() => this.getPolicies());
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  openPolicyDeleteDialog(policy) {
    this.dialogService
      .openDialog(PoliciesDialogComponent, { type: "delete", policy: policy })
      .subscribe(() => this.getPolicies());
  }


  getUser(){
    this.spinner.show();
    this.userService.currentUser.subscribe((user) => {
      if(user) {
        this.user = user;
        this.getPolicies();
      }
      this.spinner.hide();
    });
  }



}
