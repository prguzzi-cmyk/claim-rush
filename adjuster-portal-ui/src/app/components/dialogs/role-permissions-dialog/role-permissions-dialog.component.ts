import {
    Component,
    ElementRef,
    Inject,
    OnInit,
    ViewChild,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { Permission } from 'src/app/models/permission.model';
import { PermissionService } from 'src/app/services/permission.service';
import { UserService } from 'src/app/services/user.service';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatChipInputEvent } from '@angular/material/chips';
import { Observable, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Component({
    selector: 'app-role-permissions-dialog',
    templateUrl: './role-permissions-dialog.component.html',
    styleUrls: ['./role-permissions-dialog.component.scss'],
    standalone: false
})
export class RolePermissionsDialogComponent implements OnInit {
    @ViewChild('permissionInput') permissionInput: ElementRef<HTMLInputElement>;

    permissions: Permission[] = [];
    existingRolePermissions: Permission[] = [];
    formDisabled: boolean = false;
    type: any;
    role_id: any;
    permission_id: any;

    selectedPermissions: any[] = [];
    separatorKeysCodes: number[] = [ENTER, COMMA];
    selectable = true;
    removable = true;

    permissionCtrl = new FormControl();
    filteredPermissions: Observable<any[]>;

    rolePermissionForm = new FormGroup({
        permissions: new FormControl([], [Validators.required]),
    });

    constructor(
        private permissionService: PermissionService,
        private userService: UserService,
        private dialogRef: MatDialogRef<RolePermissionsDialogComponent>,
        private snackBar: MatSnackBar,
        private spinner: NgxSpinnerService,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.type = data?.type;
        this.role_id = data?.role_id;
        this.permission_id = data?.role_id;

        if (this.type == 'assign') {
            this.existingRolePermissions = data.existingPermissions;
            this.getPermissions();
        } else if (this.type == 'remove') {
            this.permission_id = data?.permission?.id;
        }

        this.filteredPermissions = this.permissionCtrl.valueChanges.pipe(
            startWith(''),
            map((permission: string | null) =>
                permission ? this._filter(permission) : this.permissions.slice()
            )
        );
    }

    ngOnInit(): void {}

    displayPermission(permission: any): string {
        return permission ? permission.name : '';
    }

    isSelected(permission: any): boolean {
        return this.selectedPermissions.includes(permission);
    }

    remove(permission: any): void {
        const index = this.selectedPermissions.indexOf(permission);

        if (index >= 0) {
            this.selectedPermissions.splice(index, 1);
        }
    }

    toggleSelection(permission: any): void {
        if (this.isSelected(permission)) {
            this.selectedPermissions = this.selectedPermissions.filter(
                (p) => p.id !== permission.id
            );
        } else {
            this.selectedPermissions.push(permission);
        }
        this.rolePermissionForm
            .get('permissions')
            .setValue(this.selectedPermissions);
    }

    private _filter(value: string): any[] {
        const filterValue = value.toLowerCase();

        return this.permissions.filter((permission) =>
            permission.name.toLowerCase().includes(filterValue)
        );
    }

    assignRolePermissions() {
        this.formDisabled = true;
        this.spinner.show();

        let data = {
            permissions: this.selectedPermissions.map(
                (permission) => permission.id
            ),
        };

        this.existingRolePermissions.forEach((permission) => {
            data.permissions.push(permission.id);
        });

        this.permissionService
            .addRolePermissions(this.role_id, data)
            .subscribe(() => {
                this.formDisabled = false;
                this.dialogRef.close();
                this.spinner.show();

                this.snackBar.open('Permissions added to role', 'Close', {
                    duration: 5000,
                    horizontalPosition: 'end',
                    verticalPosition: 'bottom',
                });
            },
            (error) => {
                this.spinner.hide();
                console.log(error);
            }
            );
    }

    getPermissions() {
        this.spinner.show();
        this.permissionService.getPermissions().subscribe((permissions) => {
            permissions = permissions.items.sort((a, b) => {
                if (a.module < b.module) {
                    return -1;
                }
            });

            permissions = permissions.filter(
                (obj1) =>
                    !this.existingRolePermissions.find(
                        (obj2) => obj1.id === obj2.id && obj1.name === obj2.name
                    )
            );

            this.permissions = permissions;

            this.spinner.hide();
        });
    }

    removePermission() {
        this.spinner.show();

        let data = {
            permissions: [this.permission_id],
        };

        console.log(data);

        this.permissionService
            .detachRolePermission(this.role_id, data)
            .subscribe(() => {
                this.spinner.hide();
                this.dialogRef.close();
            });
    }
}
