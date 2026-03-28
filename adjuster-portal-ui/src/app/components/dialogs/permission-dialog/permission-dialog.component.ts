import { Permission } from './../../../models/permission.model';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PermissionService } from './../../../services/permission.service';
import { Component, Inject, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
    selector: 'app-permission-dialog',
    templateUrl: './permission-dialog.component.html',
    styleUrls: ['./permission-dialog.component.scss'],
    standalone: false
})
export class PermissionDialogComponent implements OnInit {

  formDisabled : boolean = false;
  type: string = 'add';
  permission: Permission;
  permission_id: string;
  visible: boolean = false;
  modules: [any];

  operations: string[] = ['create', 'read', 'update','bulk-update','bulk-delete', 'remove', 'read_removed', 'restore'];

  permissionForm = new FormGroup({
    module: new FormControl('', [
      Validators.required
    ]),
    operation: new FormControl('', [
      Validators.required
    ]),
  });

  constructor(
    private permissionService: PermissionService,
    private dialogRef: MatDialogRef<PermissionDialogComponent>,
    private snackBar: MatSnackBar,
    private spinner : NgxSpinnerService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.type = data.type;

      if (data.permission) {
        this.permission = data.permission;

        console.log(this.permission);

        this.permissionForm.controls['module'].setValue(this.permission.module);
        this.permissionForm.controls['operation'].setValue(this.permission.operation);
        this.permission_id = this.permission.id;
      }
    }
   }

  ngOnInit(): void {
    this.getSystemModules();
  }

  getSystemModules() {
    this.spinner.show();
    this.permissionService.getSystemModules().subscribe((modules) => {
      modules = modules.sort((a, b) => {
        if (a.module < b.module) {
          return -1;
        }
      });
      this.modules = modules;
      this.spinner.hide();
    });
  }

  addPermission() {
    this.formDisabled = true;

    let permission = new Permission;
    permission.module = this.permissionForm.controls['module'].value;
    permission.operation = this.permissionForm.controls['operation'].value;

    this.permissionService.addPermission(permission)
      .subscribe(() => {
        this.formDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Permission added', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  updatePermission() {
    this.formDisabled = true;

    let permission = new Permission;
    permission.module = this.permissionForm.controls['module'].value;
    permission.operation = this.permissionForm.controls['operation'].value;
    permission.id = this.permission_id;

    this.permissionService.updatePermission(permission)
      .subscribe(() => {
        this.formDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Permission updated', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  deletePermission(id : string) {
    this.formDisabled = true;

    this.permissionService.deletePermission(id)
    .subscribe(() => {
      this.formDisabled = false;
      this.dialogRef.close();

      this.snackBar.open('Permission deleted', 'Close', {
        duration: 5000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    });

  }




}
