import { Component, OnInit } from '@angular/core';
import { Role } from 'src/app/models/role.model';
import { User } from 'src/app/models/user.model';
import { RoleService } from 'src/app/services/role.service';
import { TasksService } from 'src/app/services/tasks.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-tasks',
    templateUrl: './tasks.component.html',
    styleUrls: ['./tasks.component.scss'],
    standalone: false
})
export class TasksComponent implements OnInit {

  constructor( private taskService: TasksService,
               private userService: UserService,
               private roleService: RoleService) { }

  days = [
    {text:1, active: true},
    {text:2, active: false},
    {text:3, active: false},
    {text:4, active: false},
    {text:5, active: false},
    {text:6, active: false},
    {text:7, active: false},
    {text:8, active: false},
    {text:9, active: false},
    {text:10, active: false},
    {text:11, active: false},
    {text:12, active: false},
    {text:13, active: false},
    {text:14, active: false},
    {text:15, active: false},
    {text:16, active: false},
    {text:17, active: false},
    {text:18, active: false},
    {text:19, active: false},
    {text:20, active: false},
    {text:21, active: false},
  ];
  selectedDay = 1;
  tasks =[];
  displayedColumns: string[] = ['title', 'description', 'estimated_duration','is_active', 'is_removed', 'edit', 'delete'];
  user: User;
  role: Role;

  ngOnInit(): void {
    this.getCurrentUser();
    this.getTasks();
  }

  getCurrentUser() {
    this.userService.currentUser.subscribe((user) => {
      if(user?.role_id != '') {
        this.user = user;
        this.roleService.getRole(this.user.role_id)
          .subscribe(roles => {
            this.role = roles;
          });
        }
    });
  }
  
  getTasks(){
    this.taskService.getTasks()
      .subscribe((tasks) => {
        this.tasks = tasks.items;
        console.log('tasks : ', this.tasks);
      });
  }

  selectDay(day){
    this.days.map(d=> {
      if(d.text === day.text){
        d.active = true;
        this.selectedDay = day.text;
      } else {
        d.active = false;
      }
    })
  }
}
