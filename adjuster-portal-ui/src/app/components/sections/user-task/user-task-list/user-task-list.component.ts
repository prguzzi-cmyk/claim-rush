import { Component, OnInit } from "@angular/core";
import { Role } from "src/app/models/role.model";
import { User } from "src/app/models/user.model";
import { DialogService } from "src/app/services/dialog.service";
import { RoleService } from "src/app/services/role.service";
import { TasksService } from "src/app/services/tasks.service";
import { UserService } from "src/app/services/user.service";
import { UserTaskService } from "src/app/services/userTask.service";
import { CreateuserTaskComponent } from "../create-user-task/create-user-task.component";
import { take } from "rxjs/operators";
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from "@angular/cdk/drag-drop";
import { UserTask } from "src/app/models/user-task.model";
import { DatePipe } from "@angular/common";
import { MatSnackBar } from "@angular/material/snack-bar";
import { LeadService } from "src/app/services/leads.service";
import { ClientService } from "src/app/services/client.service";
import { ClaimService } from "src/app/services/claim.service";
import { SchedulesService } from "src/app/services/schedules.service";
import { LeadTask } from "src/app/models/tasks-lead.model";
import { ClientTask } from "src/app/models/tasks-client.model";
import { ClaimTask } from "src/app/models/tasks-claim.model";
import { Schedule } from "src/app/models/schedule.model";
import { NgxSpinnerService } from "ngx-spinner";
import { TabService } from 'src/app/services/tab.service';
import { Client } from "src/app/models/client.model";
import { ClientDetailsDialogComponent } from "src/app/components/dialogs/client-details-dialog/client-details-dialog.component";

@Component({
    selector: "app-user-task-list",
    templateUrl: "./user-task-list.component.html",
    styleUrls: ["./user-task-list.component.scss"],
    providers: [DatePipe],
    standalone: false
})
export class UserTaskListComponent implements OnInit {
  constructor(
    private userTaskService: UserTaskService,
    private leadService: LeadService,
    private clientService: ClientService,
    private claimService: ClaimService,
    private scheduleService: SchedulesService,
    private userService: UserService,
    public datepipe: DatePipe,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar,
    private dialogService: DialogService,
    private tabService: TabService,
  ) {}

  selectedDay = 1;
  userTasks = [];
  initialUserData = [];
  displayedColumns: string[] = [
    "title",
    "description",
    "due_date",
    "priority",
    "is_active",
    "edit",
    "delete",
  ];
  user: User;
  role: Role;
  searches: any[] = [
    { id: "all", name: "All Tasks" },
    { id: "lead", name: "Lead Tasks" },
    { id: "client", name: "Client Tasks" },
    { id: "claim", name: "Claim Tasks" },
    { id: "user", name: "User Tasks" },
    { id: "daily", name: "Daily Schedule Tasks" },
  ];

  selectedTask = "all";
  searchChange(eventValue) {
    console.log("eventValue : ", eventValue);
    let data = [];

    if (eventValue == "lead") {
      this.initialUserData.map((d) => {
        if (d.hasOwnProperty("lead_id")) {
          data.push(d);
        }
      });
    } else if (eventValue == "client") {
      this.initialUserData.map((d) => {
        if (d.hasOwnProperty("client_id")) {
          data.push(d);
        }
      });
    } else if (eventValue == "claim") {
      this.initialUserData.map((d) => {
        if (d.hasOwnProperty("claim_id")) {
          data.push(d);
        }
      });
    } else if (eventValue == "all") {
      data = this.initialUserData;
    } else if (eventValue == "user") {
      this.initialUserData.map((d) => {
        if (d.hasOwnProperty("id")) {
          data.push(d);
        }
      });
    } else if (eventValue == "daily") {
      this.initialUserData.map((d) => {
        if (d.hasOwnProperty("schedule_id")) {
          data.push(d);
        }
      });
    }

    this.userTasks = data;
    this.todo = [];
    this.inprogress = [];
    this.onhold = [];
    this.done = [];

    this.userTasks.map((d) => {
      if (d.status == "to-do") {
        this.todo.push(d);
      } else if (d.status == "in-progress") {
        this.inprogress.push(d);
      } else if (d.status == "on-hold") {
        this.onhold.push(d);
      } else if (d.status == "done") {
        this.done.push(d);
      }
    });
  }
  ngOnInit(): void {
    this.spinner.show();
    this.getCurrentUser();
  }

  getCurrentUser() {
    this.userService.currentUser.subscribe((user) => {
      if (user?.role_id != "") {
        this.user = user;
        if (this.user?.id) {
          this.getUserTasks();
        }
      }
    });
  }

  todo = [];
  inprogress = [];
  onhold = [];
  done = [];

  getUserTasks() {
    this.todo = [];
    this.inprogress = [];
    this.onhold = [];
    this.done = [];
    console.log("before user task get call : ", this.user?.id);
    this.userTaskService
      .getUserTask(this.user?.id)
      .pipe(take(1))
      .subscribe(
        (userTasks) => {
          this.initialUserData = userTasks.items;
          this.userTasks = userTasks.items;
          this.userTasks.map((d) => {
            if (d.status == "to-do") {
              this.todo.push(d);
            } else if (d.status == "in-progress") {
              this.inprogress.push(d);
            } else if (d.status == "on-hold") {
              this.onhold.push(d);
            } else if (d.status == "done") {
              this.done.push(d);
            }
          });
          this.spinner.hide();
        },
        (error) => {
          this.spinner.hide();
        }
      );
  }

  drop(event: CdkDragDrop<string[]>, movedTo) {
    let item = event.previousContainer.data[event.previousIndex];
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }

    // let item = event.container.data[0];
    // let item = event.previousContainer.data[event.previousIndex];
    // console.log('item: ', event.container.data[0]);
    console.log("movedTo : ", movedTo);
    console.log("calling update service : ", event);

    if (movedTo == "todo") {
      item["status"] = "to-do";
    } else if (movedTo == "inprogress") {
      item["status"] = "in-progress";
    } else if (movedTo == "onhold") {
      item["status"] = "on-hold";
    } else if (movedTo == "done") {
      item["status"] = "done";
    }

    console.log(" item : ", item);
    if (item.hasOwnProperty("lead_id")) {
      this.spinner.show();
      this.updateLeadTask(item);
    } else if (item.hasOwnProperty("client_id")) {
      this.spinner.hide();
      this.updateClientTask(item);
    } else if (item.hasOwnProperty("claim_id")) {
      this.spinner.hide();
      this.updateClaimTask(item);
    } else if (item.hasOwnProperty("schedule_id")) {
      // this.updateScheduleTask(item);
    } else {
      this.spinner.hide();
      this.updateUserTask(item);
    }
  }

  updateLeadTask(item) {
    let leadTask = new LeadTask();
    leadTask.id = item.id;
    leadTask.title = item.title;
    leadTask.description = item.description;
    leadTask.due_date = item.due_date;
    leadTask.priority = item.priority;
    leadTask.is_active = item.is_active;
    leadTask.task_type = item.task_type;
    leadTask.status = item.status;
    leadTask.can_be_removed = item.can_be_removed;
    this.leadService.updateLeadTask(leadTask).subscribe(() => {
      this.snackBar.open("leadTask updated", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
      // this.getUserTasks();
      this.spinner.hide();
    });
  }

  updateClientTask(item) {
    let clientTask = new ClientTask();
    clientTask.id = item.id;
    clientTask.title = item.title;
    clientTask.description = item.description;
    clientTask.due_date = item.due_date;
    clientTask.priority = item.priority;
    clientTask.is_active = item.is_active;
    clientTask.status = item.status;
    clientTask.can_be_removed = item.can_be_removed;
    this.clientService.updateClientTask(clientTask).subscribe(() => {
      this.snackBar.open("Client Task updated", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
      // this.getUserTasks();
      this.spinner.hide();
    });
  }

  updateClaimTask(item) {
    let claimTask = new ClaimTask();
    claimTask.id = item.id;
    claimTask.title = item.title;
    claimTask.description = item.description;
    claimTask.due_date = item.due_date;
    claimTask.priority = item.priority;
    claimTask.is_active = item.is_active;
    claimTask.status = item.status;
    claimTask.can_be_removed = item.can_be_removed;
    this.claimService.updateClaimTask(claimTask).subscribe(() => {
      this.snackBar.open("userTask updated", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
      // this.getUserTasks();
      this.spinner.hide();
    });
  }

  updateScheduleTask(item) {
    // let userTask = new Schedule();
    // // let dueDate = this.datepipe.transform(item.due_date'].value, 'yyyy-MM-dd')
    // userTask.title = item.title;
    // userTask.description = item.description;
    // userTask.due_date = item.due_date;
    // userTask.priority = item.priority;
    // userTask.is_active = item.is_active;
    // userTask.status = item.status;
    // userTask.can_be_removed = item.can_be_removed;
    // this.userTaskService.updateUserTask(userTask, item.id)
    //   .subscribe(() => {
    //     this.snackBar.open('userTask updated', 'Close', {
    //       duration: 5000,
    //       horizontalPosition: 'end',
    //       verticalPosition: 'bottom',
    //     });
    //     this.getUserTasks();
    //   });
  }

  updateUserTask(item) {
    let userTask = new UserTask();
    userTask.title = item.title;
    userTask.description = item.description;
    userTask.due_date = item.due_date;
    userTask.priority = item.priority;
    userTask.is_active = item.is_active;
    userTask.status = item.status;
    userTask.can_be_removed = item.can_be_removed;
    this.userTaskService.updateUserTask(userTask).subscribe(() => {
      this.snackBar.open("userTask updated", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
      // this.getUserTasks();
      this.spinner.hide();
    });
  }

  addUserTask() {
    this.dialogService
      .openDialog(CreateuserTaskComponent, { type: "add" })
      .subscribe(() => {
        // this.getUserTasks();
      });
  }

  editUserTask(userTask) {
    this.dialogService
      .openDialog(CreateuserTaskComponent, { type: "edit", userTask: userTask })
      .subscribe(() => {
        // this.getUserTasks();
      });
  }

  openUserTaskDeleteDialog(userTask) {
    this.dialogService
      .openDialog(CreateuserTaskComponent, {
        type: "delete",
        userTask: userTask,
      })
      .subscribe(() => {
        // this.getUserTasks();
      });
  }

  openUserTaskViewDialog(userTask) {
    console.log("element on click of view user-task : ", userTask);
    this.dialogService
      .openDialog(CreateuserTaskComponent, { type: "view", userTask: userTask })
      .subscribe(() => {
        // this.getUserTasks();
      });
  }
  
  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  getPriorityLabel(item) {}

  getTaskType(item) {
    // console.log("get task type : ", item);

    if (item.hasOwnProperty("lead_id")) {
      return "Lead";
    } else if (item.hasOwnProperty("client_id")) {
      return "Client";
    } else if (item.hasOwnProperty("claim_id")) {
      return "Claim";
    } else if (item.hasOwnProperty("daily")) {
      return "Daily Schedule";
    } else {
      return "User";
    }
  }
}
