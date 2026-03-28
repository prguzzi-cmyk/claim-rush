import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Permission } from 'src/app/models/permission.model';
import { DialogService } from 'src/app/services/dialog.service';
import { PermissionService } from 'src/app/services/permission.service';
import { PermissionDialogComponent } from '../../dialogs/permission-dialog/permission-dialog.component';
import { ActivatedRoute, Router } from '@angular/router';
import { RolePermissionsDialogComponent } from '../../dialogs/role-permissions-dialog/role-permissions-dialog.component';
import { RoleService } from 'src/app/services/role.service';
import { Role } from 'src/app/models/role.model';
import { NgxSpinnerService } from 'ngx-spinner';
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: 'app-role-permissions',
    templateUrl: './role-permissions.component.html',
    styleUrls: ['./role-permissions.component.scss'],
    standalone: false
})
export class RolePermissionsComponent implements OnInit {

  // Pagination
  dataSource: MatTableDataSource<Permission> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  pageIndex = 0;
  pageSize = 25;
  totalRecords = 0;
  pageSizeOptions = [25, 50, 100, 500];

  permissions: [Permission];
  permission: Permission;
  displayedColumns: string[] = [
    "sn",
    "module",
    "name",
    "operation",
    // "created_at",
    // "updated_at",
    // "edit",
    "delete",
  ];

  role : Role;
  role_id : any;

  constructor(
    private permissionService: PermissionService,
    private dialogService: DialogService,
    private router: Router,
    private route: ActivatedRoute,
    private roleService: RoleService,
    private spinner : NgxSpinnerService,
    private tabService: TabService,
  ) {

    if (this.route.snapshot.paramMap.get("id")) {
      this.role_id = this.route.snapshot.paramMap.get("id");
      this.getRoleById();

    } else {
      this.router.navigate(['/app/dashboard']);
    }
   }

  ngOnInit(): void {
    this.getRolePermissions();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  getRoleById() {
    this.spinner.show();
    this.roleService.getRole(this.role_id)
    .subscribe(roles => {
      this.role = roles;
      this.spinner.hide();
    });
  }

  getRolePermissions() {
    this.spinner.show();
    this.permissionService.getRolePermissions(this.role_id).subscribe((permissions) => {
      permissions = permissions.items.sort((a, b) => {
        if (a.module < b.module) {
          return -1;
        }
      });
      this.dataSource = new MatTableDataSource(permissions);

      this.dataSource.filterPredicate = function (data, filter: string): boolean {
        return data.module.toLowerCase().includes(filter)
          || data.name?.toLowerCase().includes(filter)
          || data?.operation?.toLowerCase().includes(filter)
          || data?.created_by?.first_name?.toLowerCase().includes(filter)
          || data?.created_by?.last_name.toString().includes(filter);
      };
      this.dataSource.paginator = this.paginator;
      this.permissions = permissions;
      this.pageIndex = permissions.page;
      this.pageSize = permissions.size;
      this.totalRecords = permissions.total;
      this.spinner.hide();
    });
  }

  applyFilter(filterValue: string) {
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  openPermissionViewDialog(permission) {
    this.dialogService
      .openDialog(PermissionDialogComponent, { type: "view", permission: permission })
      .subscribe(() => this.getRolePermissions());
  }

  openPermissionAddDialog() {
    this.dialogService
      .openDialog(RolePermissionsDialogComponent, { type: "assign", existingPermissions: this.permissions, role_id: this.role_id })
      .subscribe(() => this.getRolePermissions());
  }

  openPermissionEditDialog(permission) {
    this.dialogService
      .openDialog(PermissionDialogComponent, { type: "edit", permission: permission })
      .subscribe(() => this.getRolePermissions());
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  openPermissionRemoveDialog(permission) {
    this.dialogService
      .openDialog(RolePermissionsDialogComponent, { type: "remove", permission: permission, role_id : this.role_id })
      .subscribe(() => this.getRolePermissions());
  }

}
