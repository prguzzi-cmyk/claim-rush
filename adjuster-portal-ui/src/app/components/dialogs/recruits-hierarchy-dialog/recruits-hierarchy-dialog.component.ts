import {Component, Inject, OnInit} from '@angular/core';
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {TeamHierarchy} from "../../../models/team-hierarchy.model";
import {UserService} from "../../../services/user.service";
import {NgxSpinnerService} from "ngx-spinner";
import {User} from "../../../models/user.model";
import {MlmHierarchyService} from "../../../services/mlmhierarchy.service";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {RecruitsAdminComponent} from "../../sections/recruits-admin/recruits-admin.component";


@Component({
    selector: 'app-recruits-hierarchy-dialog',
    templateUrl: './recruits-hierarchy-dialog.component.html',
    styleUrls: ['./recruits-hierarchy-dialog.component.scss'],
    standalone: false
})
export class RecruitsHierarchyDialogComponent implements OnInit {

  type: string = "add";
  uplineUserId: string
  uplineUserName: string
  users: User[];
  user: User;

  currentHierarchy: TeamHierarchy;
  hierarchyFormDisabled: false;
  hierarchyForm = new FormGroup({
    downlineUserId: new FormControl("", [Validators.required]),
    uplineUserId: new FormControl(this.data.uplineUserId, [Validators.required]),
    isActive: new FormControl(true),
  });

  constructor( private userService: UserService,
               private mlmHierarchyService: MlmHierarchyService,
               private spinner: NgxSpinnerService,
               public dialogRef: MatDialogRef<RecruitsAdminComponent>,
               @Inject(MAT_DIALOG_DATA) public data: any,
  ) { }

  ngOnInit(): void {
    this.getUsers();
  }

  saveHierarchy() {
    let mlmHierarchy = new TeamHierarchy();
    mlmHierarchy.recruiter_uid = this.hierarchyForm.controls?.uplineUserId?.value
    mlmHierarchy.node_uid = this.hierarchyForm.controls?.downlineUserId?.value
    this.user = this.users.find(value => value.id === mlmHierarchy.node_uid);
    mlmHierarchy.first_name = this.user.first_name;
    mlmHierarchy.last_name = this.user.last_name;

    this.mlmHierarchyService.saveTeamMember(mlmHierarchy).subscribe((data) => {
      this.dialogRef.close();
    })
  }

  getUsers() {
    this.spinner.show();
    this.userService.getUsers(1, 500).subscribe((users) => {
      this.spinner.hide();
      let items: [User] = users.items;
      let usedUserIds: [String] = this.data.usedUserIds;
      this.users = items.filter(user => {
        const index = usedUserIds.indexOf(user.id);
        return index === -1;
      });
    });
  }
}
