import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { Role } from 'src/app/models/role.model';
import { User } from 'src/app/models/user.model';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from 'src/app/services/user.service';
import { RoleService } from 'src/app/services/role.service';
import { UserTask } from 'src/app/models/user-task.model';
import { UserTaskService } from 'src/app/services/userTask.service';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'app-create-user-task',
    templateUrl: './create-user-task.component.html',
    styleUrls: ['./create-user-task.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class CreateuserTaskComponent implements OnInit {

 
 
  userTask : UserTask;
  user: User;
  role: Role;
  userTaskForm = new FormGroup({
    title: new FormControl('', [Validators.required]),
    description: new FormControl(''),
    due_date: new FormControl(''),
    priority: new FormControl('')
  });
  type = 'add';
  userTaskId = '';
  status = 'Save';
  taskList = []
  isActive = true;
  canBeRemoved = false;
  
  priorities: string[] = ['low', 'medium', 'high'];

  constructor( 
              //  private taskService: TasksService, 
               private userTaskService: UserTaskService, 
               public datepipe: DatePipe,
               private router: Router,
               private dialogRef: MatDialogRef<CreateuserTaskComponent>,
               private snackBar: MatSnackBar,
               private userService: UserService,
               private roleService: RoleService,
               @Inject(MAT_DIALOG_DATA) public data: any) 
               {

                if(data){
                  this.type = data.type;
                }
                if(data.type == 'edit'){
                  this.status = 'Update User Task';
                  this.userTaskForm.controls['title'].setValue(data.userTask?.title);
                  this.userTaskForm.controls['description'].setValue(data.userTask?.description);
                  this.userTaskForm.controls['due_date'].setValue(this.datepipe.transform(data.userTask?.due_date, 'yyyy-MM-ddThh:mm'));
                  this.userTaskForm.controls['priority'].setValue(data.userTask?.priority);
                  this.isActive = data.userTask?.is_active;
                  this.userTaskId = data?.userTask?.id;
                } else if(data.type == 'add'){
                  this.status = 'Add User Task';
                  this.userTaskForm.controls['title'].setValue(data.userTask?.title);
                  this.userTaskForm.controls['description'].setValue(data.userTask?.description);
                  this.userTaskForm.controls['due_date'].setValue(this.datepipe.transform(data.userTask?.due_date, 'yyyy-MM-ddThh:mm'));
                  this.userTaskForm.controls['priority'].setValue(data.userTask?.priority);
                  this.isActive = false;
                  this.canBeRemoved = false;
                }else if(data.type == 'delete'){
                  this.userTaskId = data.userTask.id;
                  this.status = '';
                }else if(data.type == 'view'){
                  this.userTask = data.userTask;
                  this.userTaskId = data?.userTask?.id;
                  this.status = '';
                }

   }

  ngOnInit(): void {
    this.getCurrentUser();
  }

  getCurrentUser() {
    this.userService.currentUser.subscribe((user) => {
      if(user?.role_id != '') {
        this.user = user;
        }
    });
  }

  edit() {
    this.type = 'edit';
    this.userTaskForm.controls['title'].setValue(this.userTask?.title);
    this.userTaskForm.controls['description'].setValue(this.userTask?.description);
    this.userTaskForm.controls['due_date'].setValue(this.datepipe.transform(this.userTask?.due_date, 'yyyy-MM-ddThh:mm'));
    this.userTaskForm.controls['priority'].setValue(this.userTask?.priority);
    this.isActive = this.userTask?.is_active;
    this.userTaskId = this?.userTask?.id;
  }

  saveUserTask(){    
    this.userTaskForm.markAllAsTouched();
    if (this.userTaskForm.valid) {
    if(this.type == 'add'){
      this.addUserTask();
    } else if(this.type == 'edit'){
      this.updateUserTask();
    }
  }
  }

  addUserTask() {
    // this.userTaskFormDisabled = true;
    let userTask = new UserTask();
    let dueDate = this.datepipe.transform(this.userTaskForm.controls['due_date'].value, 'yyyy-MM-dd');
    userTask.title = this.userTaskForm.controls['title'].value;
    userTask.description = this.userTaskForm.controls['description'].value;
    userTask.due_date = dueDate;
    userTask.priority = this.userTaskForm.controls['priority'].value;
    userTask.is_active = this.isActive;
    this.userTaskService.addUserTask(userTask)
      .subscribe(() => {
        // this.userTaskFormDisabled = false;
        this.dialogRef.close();
        this.snackBar.open('User Task added', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  updateUserTask(){
    let userTask = new UserTask();
    let dueDate = this.datepipe.transform(this.userTaskForm.controls['due_date'].value, 'yyyy-MM-dd')
    userTask.title = this.userTaskForm.controls['title'].value;
    userTask.description = this.userTaskForm.controls['description'].value;
    userTask.due_date = dueDate;
    userTask.priority = this.userTaskForm.controls['priority'].value;
    userTask.is_active = this.isActive;
    userTask.id = this.userTaskId;
    this.userTaskService.updateUserTask(userTask)
      .subscribe(() => {
        // this.userTaskFormDisabled = false;
        this.dialogRef.close();
        this.snackBar.open('Task has been updated', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  deleteUserTask(id: any) {
    this.userTaskService.deleteUserTask(id)
      .subscribe(() => {
        // this.userFormDisabled = false;
        this.dialogRef.close();
        this.snackBar.open('Task has been deleted.', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }
  
  toggleIsActive(event: MatSlideToggleChange) {
    this.isActive = event.checked;
  }

}
