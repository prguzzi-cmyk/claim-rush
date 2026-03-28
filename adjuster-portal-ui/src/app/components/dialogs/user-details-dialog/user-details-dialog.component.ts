import { Component, OnInit, Inject, ViewChild } from "@angular/core";
import { FormGroup, Validators, FormControl } from "@angular/forms";
import { RoleService } from "src/app/services/role.service";
import { Role } from "src/app/models/role.model";
import { UserService } from "src/app/services/user.service";
import { User } from "src/app/models/user.model";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { Permission } from "src/app/models/permission.model";
import { PermissionService } from "src/app/services/permission.service";
import { TerritoryService } from "src/app/services/territory.service";
import { Territory, UserTerritoryInfo } from "src/app/models/territory.model";
import { TerritoryAssignDialogComponent } from "src/app/components/dialogs/territory-assign-dialog/territory-assign-dialog.component";
import { MatDialog } from "@angular/material/dialog";
import { Observable } from "rxjs";
import { map, startWith } from "rxjs/operators";

@Component({
    selector: "app-user-details-dialog",
    templateUrl: "./user-details-dialog.component.html",
    styleUrls: ["./user-details-dialog.component.scss"],
    standalone: false
})
export class UserDetailsDialogComponent implements OnInit {

   // Pagination
   dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
   dataSourcePolicies: MatTableDataSource<any[]> = new MatTableDataSource([]);
   @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
   @ViewChild(MatPaginator, { static: false }) paginatorPolicies: MatPaginator;
  managerControl = new FormControl();

   pageIndex = 0;
   pageSize = 100;
   pageSizeOptions = [5, 10, 25, 50, 100];
   totalPermissions = 0;

   permissions: [Permission];
   permission: Permission;

   policies : [any];

   displayedColumns: string[] = [
     "sn",
     "module",
    //  "name",
     "operation",
    //  "created_at",
    //  "updated_at",
    //  "edit",
    //  "delete",
   ];

   displayedColumnsPolicies: string[] = [
    "sn",
    "user",
    "created_at",
    "created_by",
  ];

  // Territories
  userTerritories: Territory[] = [];
  nationalAccess: boolean = false;
  territoriesLoading: boolean = false;
  displayedColumnsTerritories: string[] = [
    "sn",
    "name",
    "territory_type",
    "state",
    "remove",
  ];

  userFormDisabled = false;
  type: string = "add";
  user: User;
  visible: boolean = false;

  agent: User;
  agents: any[];
  filteredAgents!: Observable<any[]>;

  roles = [Role];
  mlmParentUsers: any[];
  role_id: string;
  updateProfile: boolean = false;

  userForm = new FormGroup({
    firstName: new FormControl("", [Validators.required]),
    lastName: new FormControl("", [Validators.required]),
    phoneNumber: new FormControl(""),
    phoneNumberExtension: new FormControl(""),
    address: new FormControl(""),
    city: new FormControl(""),
    state: new FormControl(""),
    zipCode: new FormControl(""),
    role: new FormControl(""),
    parentId: new FormControl(""),
    userEmail: new FormControl("", [Validators.required, Validators.email]),
    userPassword: new FormControl("", [
      Validators.required,
      Validators.minLength(6),
    ]),
    isActive: new FormControl(true),
    manager: new FormControl(""),
    operatingMode: new FormControl("neutral"),

  });

  constructor(
    private roleService: RoleService,
    private userService: UserService,
    private dialogRef: MatDialogRef<UserDetailsDialogComponent>,
    private snackBar: MatSnackBar,
    private permissionService: PermissionService,
    private territoryService: TerritoryService,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (this.userService.getUserPermissions('user', 'read')) {
      
      this.userService.getUsers(1, 500)
      .subscribe((agents) => {
        console.log(data.user);
        this.agents = agents?.items;


        if (data) {
          this.type = data.type;
    
          if (data.user) {
            this.user = data.user;
            this.userForm.controls["firstName"].setValue(this.user.first_name);
            this.userForm.controls["lastName"].setValue(this.user.last_name);
            this.userForm.controls["userEmail"].setValue(this.user.email);
            this.userForm.controls["isActive"].setValue(this.user?.is_active);
            this.userForm.controls["phoneNumber"].setValue(
              this.user.user_meta?.phone_number
            );
            this.userForm.controls["phoneNumberExtension"].setValue(
              this.user.user_meta?.phone_number_extension
            );
            this.userForm.controls["address"].setValue(
              this.user.user_meta?.address
            );
            this.userForm.controls["city"].setValue(this.user.user_meta?.city);
            this.userForm.controls["state"].setValue(this.user.user_meta?.state);
            this.userForm.controls["zipCode"].setValue(
              this.user.user_meta?.zip_code
            );
            this.userForm.controls["role"].setValue(this.user?.role?.id);
            this.userForm.controls["manager"].setValue(this.user?.manager_id);
            this.userForm.controls["operatingMode"].setValue(this.user?.operating_mode || 'neutral');
            const matchingAgent = this.agents.find(agent => agent.id === this.user?.manager_id);
            this.managerControl.setValue(matchingAgent);
          }
        }
    
        if (this.type == "edit") {
          if (data.profile) {
            this.updateProfile = data.profile;
          }
          const passwordControl = this.userForm.get("userPassword");
          passwordControl.clearValidators();
          passwordControl.setValidators([Validators.minLength(6)]);
        }
    
        if (this.type == "view") {
          const passwordControl = this.userForm.get("userPassword");
          passwordControl.clearValidators();
          passwordControl.setValidators([Validators.minLength(8)]);
          this.getUserPolicies();
          this.getPermissions();
          this.getUserTerritories();
        }



      });


    }

  }

  ngOnInit() {

    if (!this.updateProfile) {
      this.getRoles();
    }

    this.initMLMParentUsers();
    this.filteredAgents = this.managerControl.valueChanges.pipe(
      startWith(''),
      map(value => { 
        if (value == '') {
          this.userForm.get('manager')?.setValue(null);
        }
        return this._filterAgents(value);
      })
    );

  }

  initMLMParentUsers() {
    this.userService.getUsers(1, 500)
        .subscribe((upaUsers) => {
          this.mlmParentUsers = upaUsers.items;
        });
  }


  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSourcePolicies.paginator = this.paginatorPolicies;
  }

  getRoles() {
    this.roleService.getRoles().subscribe((roles) => {
      this.roles = roles.items;
    });
  }



  getPermissions() {
    this.permissionService.getUserPermissions(this.user.id).subscribe((permissions) => {
      
      let perms = permissions.items.sort((a, b) => {
        if (a.module < b.module) {
          return -1;
        }
      });
      this.dataSource = new MatTableDataSource(perms);
      this.dataSource.paginator = this.paginator;
      this.permissions = perms;
      this.totalPermissions = permissions.total;
    });
  }

  getUser() {
    this.userService.getUserById(this.user.id).subscribe((user) => {
      this.user = user;
    });
  }

  generatePassword() {
    this.userForm.controls["userPassword"].setValue(
      Math.random().toString(36).slice(-8)
    );
  }

  addUser() {
    this.userFormDisabled = true;

    let user = new User();
    user.first_name = this.userForm.controls["firstName"].value;
    user.last_name = this.userForm.controls["lastName"].value;
    user.email = this.userForm.controls["userEmail"].value;
    user.password = this.userForm.controls["userPassword"].value;
    user.is_active = this.userForm.controls["isActive"].value;
    user.role_id = this.userForm.controls["role"].value;
    
    if (this.userForm.controls["parentId"].value) {
      user.parent_id = this.userForm.controls["parentId"].value;
    }
    
    user.manager_id = this.userForm.controls["manager"].value;
    user.operating_mode = (this.userForm.controls["operatingMode"].value || 'neutral') as 'neutral' | 'aci' | 'upa';

    user.user_meta = {
      phone_number: this.userForm.controls["phoneNumber"].value,
      phone_number_extension: this.userForm.controls["phoneNumberExtension"].value,
      address: this.userForm.controls["address"].value,
      city: this.userForm.controls["city"].value,
      state: this.userForm.controls["state"].value,
      zip_code: this.userForm.controls["zipCode"].value,
    };

    this.userService.addUser(user).subscribe(() => {
      this.userFormDisabled = false;
      this.dialogRef.close();

      this.snackBar.open("User added", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    },
    (err) => {
      this.userFormDisabled = false;
      console.log(err);
    });
  }

  saveUser() {
    this.userFormDisabled = true;

    let user = new User();
    user.id = this.user.id;
    user.first_name = this.userForm.controls["firstName"].value;
    user.last_name = this.userForm.controls["lastName"].value;
    user.email = this.userForm.controls["userEmail"].value;
    user.role_id = this.userForm.controls["role"].value;
    user.is_active = this.userForm.controls["isActive"].value;
    user.operating_mode = (this.userForm.controls["operatingMode"].value || 'neutral') as 'neutral' | 'aci' | 'upa';

    // Only send password when the admin actually typed a new one
    const pw = this.userForm.controls["userPassword"].value;
    if (pw) {
      user.password = pw;
    }

    if (this.userForm.controls["parentId"].value) {
      user.parent_id = this.userForm.controls["parentId"].value;
    }

    user.manager_id = this.userForm.controls["manager"].value;

    user.user_meta = {
      phone_number: this.userForm.controls["phoneNumber"].value,
      phone_number_extension: this.userForm.controls["phoneNumberExtension"].value,
      address: this.userForm.controls["address"].value,
      city: this.userForm.controls["city"].value,
      state: this.userForm.controls["state"].value,
      zip_code: this.userForm.controls["zipCode"].value,
    };

    this.userService.updateUser(user).subscribe({
      next: () => {
        this.userFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open("User has been saved", "Close", {
          duration: 5000,
          horizontalPosition: "end",
          verticalPosition: "bottom",
        });
      },
      error: (err) => {
        this.userFormDisabled = false;
        const detail = err?.error?.detail || err?.message || 'Save failed';
        console.error('saveUser error:', err?.status, detail);
        this.snackBar.open(detail, "Close", {
          duration: 8000,
          horizontalPosition: "end",
          verticalPosition: "bottom",
        });
      }
    });
  }

  updateUserProfile() {
      this.userFormDisabled = true;

      let user = this.user;
      user.first_name = this.userForm.controls["firstName"].value;
      user.last_name = this.userForm.controls["lastName"].value;
      user.email = this.userForm.controls["userEmail"].value;

      user.operating_mode = (this.userForm.controls["operatingMode"].value || 'neutral') as 'neutral' | 'aci' | 'upa';

      user.user_meta = {
        phone_number: this.userForm.controls["phoneNumber"].value,
        phone_number_extension: this.userForm.controls["phoneNumberExtension"].value,
        address: this.userForm.controls["address"].value,
        city: this.userForm.controls["city"].value,
        state: this.userForm.controls["state"].value,
        zip_code: this.userForm.controls["zipCode"].value,
      };

      this.userService.updateUserProfile(user).subscribe(() => {
        this.userFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open("Profile has been saved", "Close", {
          duration: 5000,
          horizontalPosition: "end",
          verticalPosition: "bottom",
        });
      });
    }

  deleteUser(id: string) {
    this.userService.deleteUser(id).subscribe(() => {
      this.userFormDisabled = false;
      this.dialogRef.close();

      this.snackBar.open("User has been deleted.", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    });
  }

  getUserPolicies() {
    this.permissionService.getPolicies().subscribe((policies) => {
      policies = policies.items.sort((a, b) => {
        if (a.module < b.module) {
          return -1;
        }
      });
      this.dataSourcePolicies = new MatTableDataSource(policies);
      this.dataSourcePolicies.paginator = this.paginatorPolicies;
      this.policies = policies;
    });
  }

  changeMLMParent(user_id: string) {
    this.userForm.controls["parentId"].setValue(user_id);
  }

  changeRole(role_id: string) {
    this.userForm.controls["role"].setValue(role_id);
  }

  onLeadSourceSelected(event: any) {
    const selectedAgent = event.option.value;
    this.userForm.get('manager')?.setValue(selectedAgent.id);
  }

  private _filterAgents(value: string): any[] {
    const filterValue = (typeof value === 'string') ? value.toLowerCase() : '';

    // If the input is empty, return an empty array to avoid displaying all agents.
    if (!filterValue) {
      return [];
    }

    return this.agents.filter(agent => 
      agent.first_name.toLowerCase().startsWith(filterValue) || agent.first_name.startsWith(filterValue) || 
      agent.last_name.toLowerCase().startsWith(filterValue)
    );
  }

  displayAgent(agent: any): string {
    return agent ? `${agent.first_name} ${agent.last_name}` : '';
  }

  // ─── Territory methods ───

  getUserTerritories() {
    this.territoriesLoading = true;
    this.territoryService.getUserTerritories(this.user.id).subscribe(
      (info: UserTerritoryInfo) => {
        this.userTerritories = info.territories;
        this.nationalAccess = info.national_access;
        this.territoriesLoading = false;
      },
      () => {
        this.territoriesLoading = false;
      }
    );
  }

  openAssignTerritoriesDialog() {
    const dialogRef = this.dialog.open(TerritoryAssignDialogComponent, {
      width: '500px',
      data: {
        userId: this.user.id,
        assignedTerritoryIds: this.userTerritories.map((t) => t.id),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.getUserTerritories();
      }
    });
  }

  removeTerritory(territory: Territory) {
    this.territoryService
      .removeTerritories(this.user.id, [territory.id])
      .subscribe(() => {
        this.getUserTerritories();
        this.snackBar.open('Territory removed', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  toggleNationalAccess() {
    this.nationalAccess = !this.nationalAccess;
    this.territoryService
      .setNationalAccess(this.user.id, this.nationalAccess)
      .subscribe(
        () => {
          this.snackBar.open(
            this.nationalAccess ? 'National access granted' : 'National access revoked',
            'Close',
            {
              duration: 5000,
              horizontalPosition: 'end',
              verticalPosition: 'bottom',
            }
          );
        },
        () => {
          this.nationalAccess = !this.nationalAccess;
        }
      );
  }

}
