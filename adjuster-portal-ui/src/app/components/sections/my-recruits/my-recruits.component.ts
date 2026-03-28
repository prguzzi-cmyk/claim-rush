import {Component, OnInit} from '@angular/core';
import {UserService} from "../../../services/user.service";
import {MlmHierarchyService} from "../../../services/mlmhierarchy.service";
import {NgxSpinnerService} from "ngx-spinner";
import {TabService} from "../../../services/tab.service";
import {User} from "../../../models/user.model";
import {NgOrgChartNodeModel} from "../../ng-organization-chart/ng-org-chart-node-model";
import {TeamHierarchyNode} from "../recruits-admin/recruits-admin.component";
import {forkJoin} from "rxjs";
import {map, tap} from "rxjs/operators";
import {
  TeamMgrOverrideGraphComponentComponent
} from "../recruits-admin/team-mgr-override-graph-component/team-mgr-override-graph-component.component";
import {MatDialog} from "@angular/material/dialog";
import {MatSnackBar} from "@angular/material/snack-bar";
import {TitleChangeService} from "../../../services/title-change.service";

@Component({
    selector: 'app-my-recruits',
    templateUrl: './my-recruits.component.html',
    styleUrls: ['./my-recruits.component.scss'],
    standalone: false
})
export class MyRecruitsComponent implements OnInit {

  nonTeamMemberObjs: any[] = [];
  user: User;
  users: [User];
  myTeamDataSource ?: NgOrgChartNodeModel[];

  constructor(private userService: UserService,
              private titleChangeService: TitleChangeService,
              private mlmHierarchyService: MlmHierarchyService,
              private spinner: NgxSpinnerService,
              private snackBar: MatSnackBar,
              private dialog: MatDialog,
              private tabService: TabService) { }

  ngOnInit(): void {
    this.spinner.show();
    forkJoin({
      currentUser: this.userService.getUser(),
      allUsers: this.userService.getUsers(1, 500)
    }).pipe(
        map(({ currentUser, allUsers }) => {
          return {currentUser, allUsers};
            })
        ).subscribe(
            combinedResult => {
              this.users =  combinedResult.allUsers.items;
              this.user= combinedResult.currentUser;
              this.getNonTeamMembers(combinedResult.currentUser.id);
              this.searchMyRecruits(combinedResult.currentUser.id);
            },
            error => {
              console.error('Error occurred:', error);
            }
        );
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  private searchMyRecruits(userId: string) {
    this.mlmHierarchyService.getMyRecruits(userId).subscribe((data) => {
      this.spinner.hide();
      if (data) {
        this.myTeamDataSource = this.convertToTreeNode(([data]));
      } else {
        this.showNoTeamMsg();
      }
    })
  }

  private convertToTreeNode(data: TeamHierarchyNode[]): NgOrgChartNodeModel[] {
    if (data.length ===0) {
      return [];
    }

    return data.map(item => {

      let userFullName = "";
      let targetUser: User[] = this.users?.filter((user)=> user.id === item.user_id);
      if (targetUser?.length>0 ) {
        userFullName = `${targetUser[0].first_name} ${targetUser[0].last_name}`;
      } else {
        userFullName = "Unknown";
        console.log("user object with " + item.user_id + " ...... not found")
      }

      const node: NgOrgChartNodeModel = {
        id: String(item.id),
        data: {...item, name: userFullName},
        children: item.children ? this.convertToTreeNode(item.children) : []
      };
      return node;
    });
  }


  private showNoTeamMsg() {
    this.snackBar.open('No recruits data found!', 'Close', { duration: 3000 });
  }

  viewManagerOverrides($event: MouseEvent) {
    this.dialog.open(TeamMgrOverrideGraphComponentComponent, {
      width: '80%'
    });
  }

  viewNonTeamMembersNotes($event: MouseEvent) {

  }

  private getNonTeamMembers(recruiter_id: string) {
    this.titleChangeService.getNonTeamMembers(recruiter_id).subscribe(value => {
        this.nonTeamMemberObjs = value;
    });
  }

  getUserFullName(item: string) {
    const targetUser = this.users.filter((user: User) =>  user.id===item);
    if (targetUser.length > 0) {
      return targetUser[0].first_name + " " + targetUser[0].last_name;
    } else {
      return "";
    }
  }
}
