import { Permission } from 'src/app/models/permission.model';
import { PermissionService } from './../../../services/permission.service';
import { Component, OnInit, ViewChild } from '@angular/core';
import { DialogService } from 'src/app/services/dialog.service';
import { PermissionDialogComponent } from '../../dialogs/permission-dialog/permission-dialog.component';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { TabService } from 'src/app/services/tab.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-permissions',
    templateUrl: './permissions.component.html',
    styleUrls: ['./permissions.component.scss'],
    standalone: false
})
export class PermissionsComponent implements OnInit {

  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  pageIndex = 1;
  pageSize = 10;
  totalRecords = 0

  permissions: [Permission];
  permission: Permission;
  displayedColumns: string[] = [
    "sn",
    "module",
    "name",
    "operation",
    "created_at",
    "updated_at",
    "edit",
    "delete",
  ];

  constructor(
    private permissionService: PermissionService,
    private dialogService: DialogService,
    private tabService: TabService,
    public userService: UserService,

  ) { }

  ngOnInit(): void {
    this.getPermissions();
    console.log(this.userService.getUserPermissions('permission', 'read'));
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
    this.getPermissions();  
  }

  getPermissions() {
    this.permissionService.getPermissions(this.pageIndex, this.pageSize).subscribe((permissions) => {
      let _permissions = permissions?.items?.sort((a, b) => {
        if (a.module < b.module) {
          return -1;
        }
      });
      this.dataSource = new MatTableDataSource(_permissions);
      this.dataSource.paginator = this.paginator;
      this.permissions = permissions;
      this.totalRecords = permissions.total;
      this.pageSize = permissions.size;
      this.pageIndex = permissions.page;
    });
  }

  openPermissionViewDialog(permission) {
    this.dialogService
      .openDialog(PermissionDialogComponent, { type: "view", permission: permission })
      .subscribe(() => this.getPermissions());
  }

  openPermissionAddDialog() {
    this.dialogService
      .openDialog(PermissionDialogComponent, { type: "add" })
      .subscribe(() => this.getPermissions());
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
}

  openPermissionEditDialog(permission) {
    this.dialogService
      .openDialog(PermissionDialogComponent, { type: "edit", permission: permission })
      .subscribe(() => this.getPermissions());
  }

  openPermissionDeleteDialog(permission) {
    this.dialogService
      .openDialog(PermissionDialogComponent, { type: "delete", permission: permission })
      .subscribe(() => this.getPermissions());
  }

}
