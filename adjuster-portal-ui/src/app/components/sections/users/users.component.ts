import { Component, OnInit, ViewChild } from "@angular/core";
import { User } from "src/app/models/user.model";
import { UserService } from "src/app/services/user.service";
import { RoleService } from "src/app/services/role.service";
import { DialogService } from "src/app/services/dialog.service";
import { ImpersonationService } from "src/app/services/impersonation.service";
import { UserDetailsDialogComponent } from "../../dialogs/user-details-dialog/user-details-dialog.component";
import { Role } from "src/app/models/role.model";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { NgxSpinnerService } from "ngx-spinner";
import { TabService } from 'src/app/services/tab.service';
import { MatSort } from '@angular/material/sort';
import { Subscription } from "rxjs";
import { ActivatedRoute } from "@angular/router";

@Component({
    selector: "app-users",
    templateUrl: "./users.component.html",
    styleUrls: ["./users.component.scss"],
    standalone: false
})
export class UsersComponent implements OnInit {
  users: [User];
  user: User;
  role: Role;

  roles: [Role];
  queryParams: any;
  displayedColumns: string[] = [
    "sn",
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "phone_number_extension",
    "manager",
    "is_active",
    "is_removed",
    "role_id",
    "created_at",
    "edit",
    "delete",
  ];

  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild('sort1') sort1: MatSort;

  private queryParamsSubscription: Subscription;
  
  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];

  constructor(
    public userService: UserService,
    private roleService: RoleService,
    private dialogService: DialogService,
    private impersonationService: ImpersonationService,
    private spinner: NgxSpinnerService,
    private route: ActivatedRoute,
    private tabService: TabService,
  ) {}

  ngOnInit() {
    this.getUser(); // Current user
    // this.getRoles(); // All roles

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.queryParams = {
          sort_by: params['sort_by'] || 'created_at',
          order_by: params['order_by'] || 'desc',
      };
      this.getUsers();
  });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort1;  // Ensure this line is executed after ViewChild is initialized
  
    this.sort1?.sortChange.subscribe(() => {
      console.log('sortChange event triggered');
      this.paginator.pageIndex = 0;
      this.getUsers();
    });
  }

  getUser() {
    this.spinner.show();
    this.userService.currentUser.subscribe((user) => {
      this.spinner.hide();
      if (user?.role_id != "") {
        this.user = user;
      }
    });
  }

  getUsers() {
    this.spinner.show();

    const sortDirection = this.sort1?.direction || 'desc';
    const sortActive = this.sort1?.active || 'created_at';
    this.queryParams['sort_by'] = sortActive;
    this.queryParams['order_by'] = sortDirection;


    this.userService.getUsers(this.pageIndex, this.pageSize, this.queryParams).subscribe((users) => {
      this.spinner.hide();
      console.log(users.items);
      this.dataSource = new MatTableDataSource(users.items);
      this.users = users.items;

      this.dataSource.sort = this.sort1;
      this.pageIndex = users.page;
      this.pageSize = users.size;
      this.totalRecords = users.total;
      this.spinner.hide();
    });
  }

  getRoles() {
    this.roleService.getRoles().subscribe((roles) => {
      this.roles = roles;
    });
  }

  changePage(event: PageEvent) {
    
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

    this.getUsers();

  }

  // getRoleDisplayName(role_id: string) {
  //   return this.roles?.filter(object => {
  //     return object['id'] == role_id;
  //   })[0]['display_name'];
  // }

  deleteUser(id: string) {
    this.spinner.show();
    this.userService.deleteUser(id).subscribe((response) => {
      this.spinner.hide();
    });
  }

  openUserAddDialog() {
    this.dialogService
      .openDialog(UserDetailsDialogComponent, { type: "add" })
      .subscribe(() => this.getUsers());
  }

  openUserEditDialog(user) {
    this.dialogService
      .openDialog(UserDetailsDialogComponent, { type: "edit", user: user })
      .subscribe(() => this.getUsers());
  }

  openUserDeleteDialog(user) {
    this.dialogService
      .openDialog(UserDetailsDialogComponent, { type: "delete", user: user })
      .subscribe(() => this.getUsers());
  }

  openUserViewDialog(user) {
    this.dialogService
      .openDialog(UserDetailsDialogComponent, { type: "view", user: user })
      .subscribe(() => this.getUsers());
  }

  toggleUserStatus(user) {
    user.disabled = !user.disabled;

    this.userService.updateUserStatus(user.id, user.disabled).subscribe();
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  immpersonateUser(user) {
    this.impersonationService.impersonate(user).subscribe(() => {});
  }
}
