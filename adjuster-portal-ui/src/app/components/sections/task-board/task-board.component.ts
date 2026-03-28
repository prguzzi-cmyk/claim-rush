import { Component, OnInit } from '@angular/core';
import { Role } from 'src/app/models/role.model';
import { User } from 'src/app/models/user.model';
import { DialogService } from 'src/app/services/dialog.service';
import { RoleService } from 'src/app/services/role.service';
import { TasksService } from 'src/app/services/tasks.service';
import { UserService } from 'src/app/services/user.service';
import { UserTaskService } from 'src/app/services/userTask.service';
import { CreateuserTaskComponent } from '../user-task/create-user-task/create-user-task.component';
import { NgxSpinnerService } from 'ngx-spinner';
import { TabService } from 'src/app/services/tab.service';
import { ClaimService } from 'src/app/services/claim.service';
import { LeadService } from 'src/app/services/leads.service';
import { ClientService } from 'src/app/services/client.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDrawer } from '@angular/material/sidenav';


export interface Task {
  id: any;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  is_active: boolean;
  status: string;
}

@Component({
    selector: 'app-task-board',
    templateUrl: './task-board.component.html',
    styleUrls: ['./task-board.component.scss'],
    standalone: false
})
export class TaskBoardComponent implements OnInit{
  statuses = ['to-do', 'in-progress', 'on-hold', 'done'];

  tasks: Task[] = [];
  user: User;
  role: Role;
  task: Task;

  pageIndex = 1;
  totalPages = 1;
  totalRecords = 0;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100, 500];
  period_type: string;

  constructor(private taskService: TasksService,
    public userService: UserService,
    private userTaskService: UserTaskService,
    private spinner : NgxSpinnerService,
    private tabService: TabService,
    private roleService: RoleService,
    private claimService: ClaimService,
    private leadService: LeadService,
    private clientService: ClientService,
    private snackBar: MatSnackBar,
    private dialogService: DialogService) { }

  ngOnInit(): void {
    this.getCurrentUser();
    this.getTasks();
  }
  
  getTasks() {
    this.spinner.show();
    this.userTaskService.getUserTask(this.user?.id, this.pageIndex, this.pageSize)
      .subscribe((tasks) => {
        this.spinner.hide();
        this.tasks = tasks.items;
        this.pageIndex = tasks.page;
        this.totalPages = tasks.pages;
        this.totalRecords = tasks.total;
        this.pageSize = tasks.size;
      });
  }

  loadMoreTasks(): void {
    this.pageSize = this.pageSize + 10;
    this.getTasks();
  }

  getCurrentUser() {
    this.userService.currentUser.subscribe((user) => {
      if (user?.role_id != '') {
        this.user = user;
      }
    });
  }

  showTask1(task: Task, drawer: MatDrawer) {
    this.task = task;
    drawer.open();
  }

  showTask(task: Task, drawer: MatDrawer) {
    this.dialogService
      .openDialog(CreateuserTaskComponent, { type: "view", userTask: task })
      .subscribe(() => {
        this.getTasks();
      });
  }

  onClientDetail(id: string) {
    this.spinner.show();
    this.clientService.getClient(id).subscribe(
        (client) => {
            this.spinner.hide();
            if (client !== undefined) {
              let id = client.id;
              let name = client?.full_name + '-' + client?.ref_string.slice(-3);
              this.tabService.addItem({id, name, type:"client"});
            }
        },
        (error) => {
            this.spinner.hide();
        }
    );
  }

  onClaimDetail(id: string) {
    this.spinner.show();
    this.claimService.getClaim(id).subscribe(
        (claim) => {
            this.spinner.hide();
            if (claim !== undefined) {
              let id = claim.id;
              let name = claim?.client?.full_name + '-' + claim?.ref_string.slice(-3);
              this.tabService.addItem({id, name, type:"claim"});
            }
        },
        (error) => {
            this.spinner.hide();
        }
    );
  }

  onLeadDetail(id: string) {
    this.spinner.show();
    this.leadService.getLead(id).subscribe(
        (lead) => {
            this.spinner.hide();
            if (lead !== undefined) {
              let id = lead.id;
              let name = lead?.contact?.full_name + '-' + lead?.ref_string.slice(-3);
              this.tabService.addItem({id, name, type:"lead"});
            }
        },
        (error) => {
            this.spinner.hide();
        }
    );
  }

  getTasksByStatus(status: string): Task[] {
    return this.tasks.filter(task => task.status === status);
  }


  getButtonClass(task: Task): string {
    const isHighPriority = task.priority === 'high';
    const isMediumPriority = task.priority === 'meddium';
    const isOverdue = new Date(task.due_date) < new Date();
    const isNotDone = task.status !== 'done';

    if (task.status === 'done') {
      return 'green-button';
    } else if (isHighPriority || isOverdue) {
      return 'warn-button';
    } else if (isMediumPriority || !isOverdue) {
      return 'orange-button';  
    } else {
      return 'primary-button';
    }
  }

  getPriorityClass(task: Task): string {
    const isHighPriority = task.priority === 'high';
    const isMediumPriority = task.priority === 'meddium';
    const isOverdue = new Date(task.due_date) < new Date();
    const isNotDone = task.status !== 'done';

    if (task.status === 'done') {
      return 'green';
    } else if (isHighPriority || isOverdue) {
      return 'red';
    } else if (isMediumPriority || !isOverdue) {
      return 'orange';  
    } else {
      return 'green';
    }
  }

  addUserTask() {
    this.dialogService
      .openDialog(CreateuserTaskComponent, { type: "add" })
      .subscribe(() => {
        this.getTasks();
      });
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  drop(event: any): void {
    if (event.previousContainer === event.container) {
      return;
    }

    const task = event.previousContainer.data[event.previousIndex];
    task.status = event.container.id;

    // Update the task on the server
    this.userTaskService.updateUserTask(task).subscribe(
      updatedTask => {
        event.container.data.push(updatedTask);
        event.previousContainer.data.splice(event.previousIndex, 1);
      },
      error => {
        console.error('Error updating task', error);
      }
    );
  }
}
