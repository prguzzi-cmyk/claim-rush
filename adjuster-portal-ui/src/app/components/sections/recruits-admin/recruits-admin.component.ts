import { Component, OnInit } from '@angular/core';
import {UserService} from "../../../services/user.service";
import {DialogService} from "../../../services/dialog.service";
import {NgxSpinnerService} from "ngx-spinner";
import {TabService} from "../../../services/tab.service";

import {User} from "../../../models/user.model";
import {RecruitsHierarchyDialogComponent} from "../../dialogs/recruits-hierarchy-dialog/recruits-hierarchy-dialog.component";
import {MlmHierarchyService} from "../../../services/mlmhierarchy.service";
import {FormBuilder, FormControl, Validators} from "@angular/forms";

import {NgOrgChartNodeModel} from "../../ng-organization-chart/ng-org-chart-node-model";
import {MatDialog} from "@angular/material/dialog";
import {
  TeamMgrOverrideGraphComponentComponent
} from "./team-mgr-override-graph-component/team-mgr-override-graph-component.component";
import {TitleChangeService} from "../../../services/title-change.service";

export interface TeamHierarchyNode {
  id: bigint;
  parent_id?: bigint;
  path:string;
  full_name: string;
  user_id:string;
  children?: TeamHierarchyNode[];
}

@Component({
    selector: 'app-recruits-admin',
    templateUrl: './recruits-admin.component.html',
    styleUrls: ['./recruits-admin.component.scss'],
    standalone: false
})
export class RecruitsAdminComponent implements OnInit {
  scale: number = 1;
  scaleFactor: number = 0.07;
  minScale: number = 0.5;
  maxScale: number = 2;

  isDragging: boolean = false;
  translateX: number = 0;
  translateY: number = 0;
  startX: number = 0;
  startY: number = 0;

  searchFormGroup = this._formBuilder.group({
    search: new FormControl("", [Validators.required]),
  });

  users: [User];
  usedUserIds: String[];
  user: User;
  orgChartDataSource ?: NgOrgChartNodeModel[];

  constructor(private userService: UserService,
              private _formBuilder: FormBuilder,
              private mlmHierarchyService: MlmHierarchyService,
              private titleChangeService: TitleChangeService,
              private dialogService: DialogService,
              private dialog: MatDialog,
              private spinner: NgxSpinnerService,
              private tabService: TabService) {
  }

  ngOnInit(): void {
    this.getCurrentUser();
    this.getUsers();

    let comp = this;
    setTimeout(function () {
      comp.searchByUserId(comp.getSearchUserId());
    }, 1500);
    this.usedUserIds = [];
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  getCurrentUser() {
    this.spinner.show();
    this.userService.currentUser.subscribe((user) => {
      this.spinner.hide();
      if (user?.role_id != "") {
        this.user = user;
        if (user?.role?.name === 'super-admin' || user?.role?.name === 'admin') {
          this.users?.push(this.generateDummyRootNode());
        }
      }
    });
  }

  addNewItem(node: NgOrgChartNodeModel) {
    if (node) {
      this.dialogService.openDialog(RecruitsHierarchyDialogComponent,
              { type: "add", uplineUserId: node.data?.user_id, uplineUserName: node.data?.name, usedUserIds: this.usedUserIds})
          .subscribe(() => {
            this.getUsers();
            this.searchByUserId(this.getSearchUserId());
          });
    }
  }

  evaluateNodeTitle(node: NgOrgChartNodeModel) {
    if (node) {
      if (confirm("Do you want to evaluate the title for " + node?.data?.name + " in team hierarchy?")) {
        this.spinner.show();
        this.titleChangeService.tryChangeAgentTitle(node.data?.user_id, 0).subscribe((data) => {
          this.spinner.hide();
          if (!data) {
            this.spinner.show();
            this.titleChangeService.tryChangeAgentTitle(node.data?.user_id, 1).subscribe((data) => {
              this.spinner.hide();
              if (data) {
                console.log("Current agent will be demoted");
                console.log(data);
              } else {
                console.log("Current agent will not be demoted or promoted");
              }
            })
          } else {
            console.log("Current agent will be promoted");
            console.log(data);
          }
        });
      }
    }
  }

  isOrgChartEditable() {
    return this.user?.role.name === 'super-admin' || this.user?.role.name === 'admin';
  }

  deleteItem(node: any) {
    if (node) {
      if (confirm("Do you want to delete " + node?.data?.name + " from existing hierarchy?")) {
        this.spinner.show();
        this.mlmHierarchyService.deleteNodeFromOrg(node.data?.user_id).subscribe((data) => {
          this.spinner.hide();
          let index = this.usedUserIds.indexOf(node.data?.user_id);
          if (index>-1) {
            this.usedUserIds.splice(index, 1);
          }
          this.searchByUserId(this.getSearchUserId());

        });
      }
    }
  }

  getUsers() {
    this.spinner.show();
    this.userService.getUsers(1, 500).subscribe((users) => {
      this.spinner.hide();
      this.users = users.items;
    });
  }

  viewManagerOverrides() {
    this.dialog.open(TeamMgrOverrideGraphComponentComponent, {
      width: '80%'
    });
  }

  private generateDummyRootNode() {
    return {
      id :'root',
      first_name : 'Root',
      last_name : 'Node'
    } as User;
  }

  search() {
    let searchUserId = this.searchFormGroup.controls.search?.value;
    if (searchUserId) {
      this.searchByUserId(searchUserId);
    }
  }

  compareCategoryObjects(u1: User, u2: User) {
    return u1 && u2 && u1.id == u2.id;
  }

  resetSearch() {
    let searchUserId = this.getSearchUserId();
    this.searchFormGroup.get("search").setValue('');
    this.searchByUserId(searchUserId);
  }

  private getSearchUserId() {
    let roleName = this.user?.role?.name;
    let result: string;
    if (roleName === 'super-admin' || roleName === 'admin') {
      result = 'root';
    } else {
      result = this.user? this.user.id: 'root';
    }
    return result;
  }

  private convertToTreeNode(data: TeamHierarchyNode[]): NgOrgChartNodeModel[] {
    if (data.length ===0) {
      return [];
    }

    return data.map(item => {
      if (!this.usedUserIds.includes(item.user_id)) {
        this.usedUserIds.push(item.user_id);
      }

      let userFullName = "";
      if (item.user_id !== 'root') {
        let targetUser: User[] = this.users?.filter((user)=> user.id === item.user_id);
        userFullName = item.full_name;
      } else {
        userFullName = 'UPA Org';
      }


      const node: NgOrgChartNodeModel = {
        id: String(item.id),
        data: {...item, name: userFullName},
        children: item.children ? this.convertToTreeNode(item.children) : []
      };
      return node;
    });
  }

  private searchByUserId(userId: string) {
      userId = this.getSearchUserId();
      this.spinner.show();
      this.mlmHierarchyService.getHierarchyByUserId(userId).subscribe((data) => {
        if (data) {
          this.spinner.hide();
          this.orgChartDataSource = this.convertToTreeNode(([data]));
        } else {
          this.resetSearch();
        }
      })
  }

  clickNode($event: NgOrgChartNodeModel) {
    console.log("node clicked...")
  }

  // Handle mouse down (start dragging)
  onMouseDown(event: MouseEvent) {
      this.isDragging = true;
      this.startX = event.clientX - this.translateX;
      this.startY = event.clientY - this.translateY;
  }

  // Handle mouse move (dragging)
  onMouseMove(event: MouseEvent) {
    if (this.isDragging) {
      this.translateX = event.clientX - this.startX;
      this.translateY = event.clientY - this.startY;
    }
  }

  // Handle mouse up (end dragging)
  onMouseUp() {
    this.isDragging = false;
  }

  // Handle mouse wheel (zoom in/out)
  onMouseWheel(event: WheelEvent) {
    event.preventDefault();  // Prevent default scrolling behavior

    if (event.deltaY > 0) {
      this.scale = Math.max(this.minScale, this.scale - this.scaleFactor); // Zoom out
    } else {
      this.scale = Math.min(this.maxScale, this.scale + this.scaleFactor); // Zoom in
    }
  }

  // Combine translation and scaling into a single transform string
  get transform() {
    return `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
  }

  syncOrgChartFromCRM() {
    this.spinner.show();
    this.mlmHierarchyService.syncOrgChartFromCRM().subscribe((data) => {
      this.spinner.hide();
      if (data) {
        this.searchByUserId(this.getSearchUserId())
      }
    });
  }
}
