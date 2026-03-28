import { Component, OnInit } from '@angular/core';
import { Role } from 'src/app/models/role.model';
import { User } from 'src/app/models/user.model';
import { DialogService } from 'src/app/services/dialog.service';
import { RoleService } from 'src/app/services/role.service';
import { SchedulesService } from 'src/app/services/schedules.service';
import { UserService } from 'src/app/services/user.service';
import { CreateScheduleComponent } from '../create-schedule/create-schedule.component';
import { TasksService } from 'src/app/services/tasks.service';
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: 'app-schedule-list',
    templateUrl: './schedule-list.component.html',
    styleUrls: ['./schedule-list.component.scss'],
    standalone: false
})
export class ScheduleListComponent implements OnInit {

  constructor(private scheduleService: SchedulesService,
    private taskService: TasksService,
    private userService: UserService,
    private roleService: RoleService,
    private dialogService: DialogService,
    private tabService: TabService,
  ) { }


  selectedDay = 1;
  schedules = [];
  displayedColumns: string[] = ['title', 'goal', 'day_number', 'is_active', 'can_be_removed', 'edit', 'delete'];
  user: User;
  role: Role;
  tasks = [];

  ngOnInit(): void {
    this.getCurrentUser();
  }

  getCurrentUser() {
    this.userService.currentUser.subscribe((user) => {
      if (user?.role_id != '') {
        this.user = user;
        this.getTasks();
      }
    });
  }

  getTasks() {
    this.taskService.getTasks()
      .subscribe((tasks) => {
        this.tasks = tasks;
        this.getSchedules();
      });
  }

  getSchedules() {
    this.scheduleService.getSchedules()
      .subscribe((schedules) => {
        this.schedules = schedules.items;
      });
  }

  addSchedule() {
    this.dialogService.openDialog(CreateScheduleComponent, { type: 'add' })
      .subscribe(() => {
        this.getSchedules();
      });
  }

  editSchedule(schedule) {
    this.dialogService.openDialog(CreateScheduleComponent, { type: 'edit', schedule: schedule })
      .subscribe(() => {
        this.getSchedules();
      });
  }

  openScheduleDeleteDialog(schedule) {
    this.dialogService.openDialog(CreateScheduleComponent, { type: 'delete', schedule: schedule })
      .subscribe(() => {
        this.getSchedules();
      });
  }

  openScheduleViewDialog(schedule) {
    this.dialogService.openDialog(CreateScheduleComponent, { type: 'view', schedule: schedule })
      .subscribe(() => {
        this.getSchedules();
      });
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  getTaskTitle(taskId) {
    if (taskId.length > 0) {
      // console.log('get task id : ', taskId);
      let taskTitle = '';
      this.tasks.map(d => {
        if (d.id == taskId[0].id) {
          taskTitle = d.title;
          // console.log('get task id : ', taskId);
        }
      });
      return taskTitle;
    }
  }

}
