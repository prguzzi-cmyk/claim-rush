import { Component, OnInit } from '@angular/core';
import { Role } from 'src/app/models/role.model';
import { User } from 'src/app/models/user.model';
import { DialogService } from 'src/app/services/dialog.service';
import { RoleService } from 'src/app/services/role.service';
import { TasksService } from 'src/app/services/tasks.service';
import { UserService } from 'src/app/services/user.service';
import { CreateTaskComponent } from '../create-task/create-task.component';
import { PageEvent } from '@angular/material/paginator';

@Component({
    selector: 'app-task-list',
    templateUrl: './task-list.component.html',
    styleUrls: ['./task-list.component.scss'],
    standalone: false
})
export class TaskListComponent implements OnInit {

  pageIndex = 1;
  totalRecords = 0;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100, 500];

  constructor(private taskService: TasksService,
    private userService: UserService,
    private roleService: RoleService,
    private dialogService: DialogService) { }

  days = [
    { text: 1, active: true },
    { text: 2, active: false },
    { text: 3, active: false },
    { text: 4, active: false },
    { text: 5, active: false },
    { text: 6, active: false },
    { text: 7, active: false },
    { text: 8, active: false },
    { text: 9, active: false },
    { text: 10, active: false },
    { text: 11, active: false },
    { text: 12, active: false },
    { text: 13, active: false },
    { text: 14, active: false },
    { text: 15, active: false },
    { text: 16, active: false },
    { text: 17, active: false },
    { text: 18, active: false },
    { text: 19, active: false },
    { text: 20, active: false },
    { text: 21, active: false },
  ];
  selectedDay = 1;
  tasks = [];
  displayedColumns: string[] = ['sn', 'title', 'estimated_duration', 'is_active', 'can_be_removed', 'edit', 'delete'];
  user: User;
  role: Role;

  ngOnInit(): void {
    this.getCurrentUser();
    this.getTasks();
  }

  getCurrentUser() {
    this.userService.currentUser.subscribe((user) => {
      if (user?.role_id != '') {
        this.user = user;
      }
    });
  }

  getTasks() {
    this.taskService.getTasks(this.pageIndex, this.pageSize)
      .subscribe((tasks) => {
        this.tasks = tasks.items;
        this.pageIndex = tasks.page;
        this.totalRecords = tasks.total;
        this.pageSize = tasks.size;
      });
  }

  addTask() {
    this.dialogService.openDialog(CreateTaskComponent, { type: 'add' })
      .subscribe(() => {
        this.getTasks();
      });
  }

  editTask(task) {
    this.dialogService.openDialog(CreateTaskComponent, { type: 'edit', task: task })
      .subscribe(() => {
        this.getTasks();
      });
  }

  openTaskDeleteDialog(task) {
    this.dialogService.openDialog(CreateTaskComponent, { type: 'delete', task: task })
      .subscribe(() => {
        this.getTasks();
      });
  }

  openTaskViewDialog(task) {
    this.dialogService.openDialog(CreateTaskComponent, { type: 'view', task: task })
      .subscribe(() => {
        this.getTasks();
      });
  }

  removeStyleTags(description) {
    let resultArry = [];
    let tag = false;
    let str = description.split('');
    str.map((d) => {
      if (d == '<') {
        tag = true;
        d = ' ';
        return;
      }
      if (d == '>') {
        tag = false;
        d = ' ';
        return;
      }
      if (tag == true) {
        d = ' ';
      }
      if (tag == false) {
        resultArry.push(d);
      }
    });
    return resultArry.join('');
  }

  changePage(event: PageEvent) {
    
      this.pageIndex = event.pageIndex + 1;

      if (this.pageIndex == 0) {
        this.pageIndex = 1;
      }
      this.getTasks();
    }

}
