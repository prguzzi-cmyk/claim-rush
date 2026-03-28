import { filter } from "rxjs/operators";
import { Permission } from "src/app/models/permission.model";
import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { NgxSpinnerService } from "ngx-spinner";
import { Policy } from "src/app/models/policy.model";
import { User } from "src/app/models/user.model";
import { PermissionService } from "src/app/services/permission.service";
import { UserService } from "src/app/services/user.service";

@Component({
    selector: "app-policies-dialog",
    templateUrl: "./policies-dialog.component.html",
    styleUrls: ["./policies-dialog.component.scss"],
    standalone: false
})
export class PoliciesDialogComponent implements OnInit {
  type: any;
  policy: any;
  policy_id: any;
  users: [User];
  modules: [any];
  permissions: Permission[] = [];
  formDisabled: boolean = false;

  policyForm = new FormGroup({
    user_id: new FormControl("", [Validators.required]),
    module: new FormControl(""),
    permissionsPermit: new FormControl([]),
    permissionsDeny: new FormControl([]),
  });

  constructor(
    private permissionService: PermissionService,
    private userService: UserService,
    private dialogRef: MatDialogRef<PoliciesDialogComponent>,
    private snackBar: MatSnackBar,
    private spinner: NgxSpinnerService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      if (data.policy) {
        this.policy = data.policy;
      }

      this.type = data.type;

      if (this.type == "view" || this.type == "delete" || this.type == "edit") {
        this.policy_id = this.policy.id;
        if (this.type != "delete") {
          this.getUsers();
          this.getSystemModules();
          this.getPermissions();

          if (this.type == "edit") {
            this.policyForm.controls["user_id"].setValue(this.policy.user_id);
            this.policyForm.controls["module"].setValue("all");

            let permissionsDenedArray = [];
            this.policy.permissions
              .filter((row) => row.effect === "deny")
              .forEach((element) => {
                permissionsDenedArray.push(element.permission_id);
              });
            this.policyForm.controls["permissionsDeny"].setValue(
              permissionsDenedArray
            );

            let permissionsPermittedArray = [];
            this.policy.permissions
              .filter((row) => row.effect === "permit")
              .forEach((element) => {
                permissionsPermittedArray.push(element.permission_id);
              });
            this.policyForm.controls["permissionsPermit"].setValue(
              permissionsPermittedArray
            );
          }
        }
      } else {
        this.getUsers();
        this.getSystemModules();
        this.getPermissions();

        if (data.policy) {
          this.policy = data.policy;

          console.log(this.policy);

          this.policyForm.controls["user_id"].setValue(this.policy.user_id);
          this.policy_id = this.policy.id;
        }
      }
    }
  }

  getUsers() {
    this.spinner.show();
    this.userService.getUsers(1,1000).subscribe((users) => {
      this.users = users.items;
    });
  }

  ngOnInit(): void {}

  getPermissions() {
    this.spinner.show();
    this.permissionService.getPermissions(1, 1000).subscribe((permissions) => {
      permissions = permissions.items.sort((a, b) => {
        if (a.module < b.module) {
          return -1;
        }
      });

      if (
        this.policyForm.get("module").value == "all" ||
        this.policyForm.get("module").value == ""
      ) {
        this.permissions = permissions;
      } else {
        this.permissions = permissions.filter(
          (row) => row.module === this.policyForm.get("module").value
        );
      }

      this.spinner.hide();
    });
  }

  getPermissionById(id: string) {
    if (this.permissions.length > 0) {
      return this.permissions.filter((row) => row.id === id)[0].name;
    } else {
      return null;
    }
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
    });
  }

  deletePolicy() {
    this.spinner.show();
    this.permissionService.deletePolicy(this.policy_id).subscribe(() => {
      this.formDisabled = false;
      this.dialogRef.close();
      this.spinner.show();

      this.snackBar.open("Policy has been deleted.", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    });
  }

  addPolicy() {
    this.formDisabled = true;
    this.spinner.show();

    let policy = new Policy();

    let permissions: any;
    permissions = this.policyForm.controls["permissionsPermit"].value;

    permissions.forEach((permission_id) => {
      policy.permissions.push({
        permission_id: permission_id,
        effect: "permit",
      });
    });

    let permissionsDeny: any;
    permissionsDeny = this.policyForm.controls["permissionsDeny"].value;

    permissionsDeny.forEach((permission_id) => {
      policy.permissions.push({ permission_id: permission_id, effect: "deny" });
    });

    console.log(policy);

    this.permissionService
      .addPolicies(this.policyForm.controls["user_id"].value, policy)
      .subscribe(() => {
        this.formDisabled = false;
        this.dialogRef.close();
        this.spinner.show();

        this.snackBar.open("Policy added", "Close", {
          duration: 5000,
          horizontalPosition: "end",
          verticalPosition: "bottom",
        });
      });
  }
}
