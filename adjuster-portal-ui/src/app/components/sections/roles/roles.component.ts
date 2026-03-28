import { UserService } from 'src/app/services/user.service';
import { Component, OnInit } from '@angular/core';
import { RoleService } from 'src/app/services/role.service';
import { Role } from 'src/app/models/role.model';
import { RoleDetailsDialogComponent } from 'src/app/components/dialogs/role-details-dialog/role-details-dialog.component';
import { DialogService } from 'src/app/services/dialog.service';
import { User } from 'src/app/models/user.model';
import { Router } from '@angular/router';
import { TabService } from 'src/app/services/tab.service';
import { error } from 'console';
import { NgxSpinnerService } from 'ngx-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder } from '@angular/forms';

@Component({
    selector: 'app-roles',
    templateUrl: './roles.component.html',
    styleUrls: ['./roles.component.scss'],
    standalone: false
})
export class RolesComponent implements OnInit {
    roles: [Role];
    user: User;
    role: Role;
    searchFormGroup: any;
    displayedColumns: string[] = [
        'sn',
        'name',
        'display_name',
        'permissions',
        'created_at',
        'updated_at',
        'edit',
        'delete',
    ];

    constructor(
        private roleService: RoleService,
        private dialogService: DialogService,
        public userService: UserService,
        private router: Router,
        private tabService: TabService,
        private spinner: NgxSpinnerService,
        private snackBar: MatSnackBar,
        private formBuilder: FormBuilder
    ) {}

    ngOnInit() {
        if (this.userService.getUserPermissions('role', 'read')) {
            this.getCurrentUser();
            this.getRoles();
        } else {
            // this.router.navigate(["/agent-dashboard"]);
        }

        this.searchFormGroup = this.formBuilder.group({
            search_string: null,
        });

        this.searchFormGroup
            .get('search_string')
            .valueChanges.subscribe((value) => {
                if (value === '') {
                }
            });
    }

    getCurrentUser() {
        this.userService.currentUser.subscribe((user) => {
            this.user = user;
        });
    }

    getRoles() {
        this.roleService.getRoles().subscribe(
            (roles) => {
                this.roles = roles.items;
            },
            (error) => {
                this.spinner.hide();
            }
        );
    }

    clearSearch() {
        this.getRoles();
    }

    search(page: number = 1, pageSize: number = 1000) {
      console.log(this.searchFormGroup.valid);
      this.spinner.show();


      if (this.searchFormGroup.valid) {

          let search_string = this.searchFormGroup.get('search_string').value.trim();


          this.roleService.searchRoles(page, pageSize, search_string).subscribe(
              response => {
                  if (response !== undefined) {
                      this.roles = response.items;
                      this.spinner.hide();
                  }
              },
              (error) => {
                  this.spinner.hide();
              }
          );
      }
  }

    openRoleAddDialog() {
        this.dialogService
            .openDialog(RoleDetailsDialogComponent, { type: 'add' })
            .subscribe(() => this.getRoles());
    }

    openRoleViewDialog(role: Role) {
        this.dialogService
            .openDialog(RoleDetailsDialogComponent, {
                type: 'view',
                role: role,
            })
            .subscribe(() => this.getRoles());
    }

    openRoleEditDialog(role) {
        this.dialogService
            .openDialog(RoleDetailsDialogComponent, {
                type: 'edit',
                role: role,
            })
            .subscribe(() => this.getRoles());
    }

    openRoleDeleteDialog(role) {
        this.dialogService
            .openDialog(RoleDetailsDialogComponent, {
                type: 'delete',
                role: role,
            })
            .subscribe(() => this.getRoles());
    }

    onNavigate(side: string) {
        this.tabService.setSideTitle(side);
    }

    openPermissionsDialog(role) {
        this.router.navigate(['/app/administration/role-permissions/' + role.id]);
    }
}
