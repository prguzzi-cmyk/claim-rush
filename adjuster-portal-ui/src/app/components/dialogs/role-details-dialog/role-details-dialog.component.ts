import { Component, Inject, OnInit } from '@angular/core';
import { Role } from 'src/app/models/role.model';
import { UserService } from 'src/app/services/user.service';
import { RoleService } from 'src/app/services/role.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
    selector: 'app-role-details-dialog',
    templateUrl: './role-details-dialog.component.html',
    styleUrls: ['./role-details-dialog.component.scss'],
    standalone: false
})
export class RoleDetailsDialogComponent implements OnInit {

  roleFormDisabled : boolean = false;
  type: string = 'add';
  role: Role;
  visible: boolean = false;

  roleForm = new FormGroup({
    roleName: new FormControl('', [
      Validators.required
    ]),
    displayName: new FormControl('', [
      Validators.required
    ]),
    // canBeRemoved: new FormControl(true),
  });

  constructor(
    private roleService: RoleService,
    private userService: UserService,
    private dialogRef: MatDialogRef<RoleDetailsDialogComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.type = data.type;

      if (data.role) {
        this.role = data.role;

        this.roleForm.controls['roleName'].setValue(this.role.name);
        this.roleForm.controls['displayName'].setValue(this.role.display_name);
        // this.roleForm.controls['canBeRemoved'].setValue(this.role.can_be_removed);
      }
    }

  }

  ngOnInit(): void {

  }

  addRole() {
    this.roleFormDisabled = true;

    let role = new Role;
    role.name = this.roleForm.controls['roleName'].value;
    role.display_name = this.roleForm.controls['displayName'].value;
    // role.can_be_removed = this.roleForm.controls['canBeRemoved'].value;

    this.roleService.addRole(role)
      .subscribe(() => {
        this.roleFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Role added', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  saveRole() {
    this.roleFormDisabled = true;

    let role = this.role;
    role.name = this.roleForm.controls['roleName'].value;
    role.display_name = this.roleForm.controls['displayName'].value;
    // role.can_be_removed = this.roleForm.controls['canBeRemoved'].value;f

    this.roleService.updateRole(role)
      .subscribe(() => {
        this.roleFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Role has been saved', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }


  deleteRole(id: string) {
    this.roleService.deleteRole(id)
      .subscribe(() => {
        this.roleFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Role has been deleted.', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

}
