import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Role } from 'src/app/models/role.model';
import { Schedule } from 'src/app/models/schedule.model';
import { User } from 'src/app/models/user.model';
import { RoleService } from 'src/app/services/role.service';
import { SchedulesService } from 'src/app/services/schedules.service';
import { TasksService } from 'src/app/services/tasks.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-create-schedule',
    templateUrl: './create-schedule.component.html',
    styleUrls: ['./create-schedule.component.scss'],
    standalone: false
})
export class CreateScheduleComponent implements OnInit {

 
  schedule : Schedule;
  // task : Task;
  user: User;
  role: Role;
  scheduleForm = new FormGroup({
    tasks: new FormControl([]),
    title: new FormControl('', [Validators.required]),
    goal: new FormControl('', [Validators.required]),
    day_number: new FormControl(0)
  });
  type = 'add';
  scheduleId = '';
  status = 'Save';
  taskList = []
  isActive = false;
  canBeRemoved = false;
  multiTasks = [];


  constructor( private taskService: TasksService, 
               private scheduleService: SchedulesService, 
               private router: Router,
               private dialogRef: MatDialogRef<CreateScheduleComponent>,
               private snackBar: MatSnackBar,
               private userService: UserService,
               private roleService: RoleService,
               @Inject(MAT_DIALOG_DATA) public data: any) 
               {

                if(data){
                  this.type = data.type;
                }
                if(data.type == 'edit'){
                  this.status = 'Update Schedule';
                  let task = [];
                  data?.schedule?.tasks.map(d=>{
                    task.push(d.id);
                  })
                  this.scheduleForm.controls['tasks'].setValue(task);
                  this.scheduleForm.controls['title'].setValue(data.schedule?.title);
                  this.scheduleForm.controls['goal'].setValue(data.schedule?.goal);
                  this.scheduleForm.controls['day_number'].setValue(data.schedule?.day_number);
                  this.isActive = data.schedule?.is_active;
                  this.canBeRemoved = data.schedule?.can_be_removed;
                  this.scheduleId = data?.schedule?.id;
                } else if(data.type == 'add'){
                  this.status = 'Add Schedule';
                  this.scheduleForm.controls['tasks'].setValue(data.schedule?.tasks);
                  this.scheduleForm.controls['title'].setValue(data.schedule?.title);
                  this.scheduleForm.controls['goal'].setValue(data.schedule?.goal);
                  this.scheduleForm.controls['day_number'].setValue(data.schedule?.day_number); 
                  this.isActive = false;
                  this.canBeRemoved = false;
                }else if(data.type == 'delete'){
                  this.scheduleId = data.schedule.id;
                  this.status = '';
                }else if(data.type == 'view'){
                  this.schedule = data.schedule;
                  this.status = '';
                }

   }

  ngOnInit(): void {
    this.getCurrentUser();
    this.getTasks();
  }

  getCurrentUser() {
    this.userService.currentUser.subscribe((user) => {
      if(user?.role_id != '') {
        this.user = user;
        // this.roleService.getRole(this.user['role'].name)
        //   .subscribe(roles => {
        //     this.role = roles;
        //   });
        }
    });
  }

  getTasks(){
    this.taskService.getTasks(1,100)
      .subscribe((res) => {
        if(res){
          let task = res.items;
          task.map(d=> {
            this.taskList.push({id: d.id, value: d.title});
          })
        }
      });
  }

  saveSchedule(){    
    this.scheduleForm.markAllAsTouched();
    if (this.scheduleForm.valid) {
    this.multiTasks = [];
    let tasks = [];
    tasks = this.scheduleForm.controls['tasks'].value;
    tasks.map(d=>{
      let obj = {id: d};
      this.multiTasks.push(obj);
    });
    if(this.type == 'add'){
      this.addSchedule();
    } else if(this.type == 'edit'){
      this.updateSchedule();
    }
  }
  }

  addSchedule() {
    // this.scheduleFormDisabled = true;
    let schedule = new Schedule;
    schedule.tasks = this.multiTasks;
    schedule.title = this.scheduleForm.controls['title'].value;
    schedule.goal = this.scheduleForm.controls['goal'].value;
    schedule.day_number = this.scheduleForm.controls['day_number'].value;
    schedule.is_active = this.isActive;
    schedule.can_be_removed = this.canBeRemoved;
    this.scheduleService.addSchedule(schedule)
      .subscribe(() => {
        // this.scheduleFormDisabled = false;
        this.dialogRef.close();
        this.snackBar.open('Schedule added', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
        this.router.navigateByUrl('/app/administration/schedules/schedule-list');
      });
  }

  updateSchedule(){
    let schedule = new Schedule;
    schedule.tasks = this.multiTasks;
    schedule.title = this.scheduleForm.controls['title'].value;
    schedule.goal = this.scheduleForm.controls['goal'].value;
    schedule.day_number = this.scheduleForm.controls['day_number'].value;
    schedule.is_active = this.isActive;
    schedule.can_be_removed = this.canBeRemoved;
    this.scheduleService.updateSchedule(schedule, this.scheduleId)
      .subscribe(() => {
        // this.scheduleFormDisabled = false;
        this.dialogRef.close();
        this.snackBar.open('Schedule updated', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
        this.router.navigateByUrl('/app/administration/schedules/schedule-list');
      });
  }

  deleteSchedule(id: any) {
    this.scheduleService.deleteSchedule(id)
      .subscribe(() => {
        // this.userFormDisabled = false;
        this.dialogRef.close();
        this.snackBar.open('Schedule has been deleted.', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  getTaskTitle(taskId){   
    if(taskId.length > 0 && this.taskList.length > 0){
    let taskTitle = '';
    this.taskList.map(d=> {
      if(d.value == taskId[0].id){
        taskTitle = d.viewValue;
      }
    });
    return taskTitle;
  }
  }
  
  toggleIsActive(event: MatSlideToggleChange) {
    this.isActive = event.checked;
  }

  toggleCanBeRemoved(event: MatSlideToggleChange) {
    this.canBeRemoved = event.checked;
  }

}
