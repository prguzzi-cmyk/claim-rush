import { Component, OnInit, Inject } from '@angular/core';
import { Task } from 'src/app/models/task.model';
import { FormGroup, Validators, FormControl } from '@angular/forms';
import { TasksService } from 'src/app/services/tasks.service';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { User } from 'src/app/models/user.model';
import { UserService } from 'src/app/services/user.service';
import { RoleService } from 'src/app/services/role.service';
import { Role } from 'src/app/models/role.model';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { AngularEditorConfig } from '@kolkov/angular-editor';

@Component({
    selector: 'app-create-task',
    templateUrl: './create-task.component.html',
    styleUrls: ['./create-task.component.scss'],
    standalone: false
})
export class CreateTaskComponent implements OnInit {

  taskFormDisabled: boolean = false;
  task : Task;
  user: User;
  role: Role;
  taskForm = new FormGroup({
    title: new FormControl('', [
      Validators.required
    ]),
    description: new FormControl(''),
    estimated_duration: new FormControl(0)
  });
  type = 'add';
  taskId = '';
  status = 'Save';
  taskMeta: any;
  isActive = false;
  canBeRemoved = false;
  taskMetaArray = [{key:'', content:'' }]

  constructor( private taskService: TasksService,
               private router: Router,
               private dialogRef: MatDialogRef<CreateTaskComponent>,
               private snackBar: MatSnackBar,
               private userService: UserService,
               private roleService: RoleService,
               @Inject(MAT_DIALOG_DATA) public data: any)
               {

                if(data){
                  this.type = data.type;
                }
                if(data.type == 'edit'){
                  this.status = 'Update';
                  this.taskForm.controls['title'].setValue(data.task?.title);
                  this.taskForm.controls['description'].setValue(data.task?.description);
                  this.taskForm.controls['estimated_duration'].setValue(data.task?.estimated_duration);
                  this.isActive = data.task?.is_active;
                  this.canBeRemoved = data.task?.can_be_removed;
                  this.taskId = data?.task?.id;
                  this.taskMetaArray = data?.task?.task_meta;
                } else if(data.type == 'add'){
                  this.status = 'Save';
                  this.taskForm.controls['title'].setValue(data.task?.title);
                  this.taskForm.controls['description'].setValue(data.task?.description);
                  this.taskForm.controls['estimated_duration'].setValue(data.task?.estimated_duration);
                  this.isActive = false;
                  this.canBeRemoved = false;
                }else if(data.type == 'delete'){
                  this.taskId = data.task.id
                }else if(data.type == 'view'){
                  this.task = data.task;
                  this.taskMetaArray = data?.task?.task_meta;
                }

   }
   editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: '15rem',
    minHeight: '5rem',
    placeholder: 'Enter text here...',
    translate: 'no',
    defaultParagraphSeparator: 'p',
    defaultFontName: 'Arial',
    toolbarHiddenButtons: [
      ['bold']
      ],
    customClasses: [
      {
        name: "quote",
        class: "quote",
      },
      {
        name: 'redText',
        class: 'redText'
      },
      {
        name: "titleText",
        class: "titleText",
        tag: "h1",
      },
    ]
  };

  ngOnInit(): void {
    this.getCurrentUser();
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


 addNewRow(item){
  let obj = {key:'', content:'' }
  this.taskMetaArray.push(obj);

}

deleteTaskMetaRow(index){
  this.taskMetaArray.splice(index, 1);

}

saveTask(){
  this.taskForm.markAllAsTouched();
  if (this.taskForm.valid) {
  let index = this.taskMetaArray.findIndex(v=> v.content === '');
  if(index>-1){
    this.taskMetaArray.splice(index,1);
  }
  if(this.type == 'add'){
    this.addTask();
  } else if(this.type == 'edit'){
    this.updateTask();
  }
}
}

  addTask() {
    this.taskFormDisabled = true;
    let task = new Task;
    task.title = this.taskForm.controls['title'].value;
    task.description = this.taskForm.controls['description'].value;
    task.estimated_duration = this.taskForm.controls['estimated_duration'].value;
    task.task_meta = this.taskMetaArray;
    task.is_active = this.isActive;
    task.can_be_removed = this.canBeRemoved;

    this.taskService.addTask(task)
      .subscribe(() => {
        this.taskFormDisabled = false;
        this.dialogRef.close();
        this.snackBar.open('Task added', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
        this.router.navigateByUrl('/app/administration/tasks/task-list');

      });
  }

  updateTask(){
    this.taskFormDisabled = true;
    let task = new Task;
    task.title = this.taskForm.controls['title'].value;
    task.description = this.taskForm.controls['description'].value;
    task.estimated_duration = this.taskForm.controls['estimated_duration'].value;
    task.task_meta = this.taskMetaArray;
    task.is_active = this.isActive;
    task.can_be_removed = this.canBeRemoved;
    this.taskService.updateTask(task, this.taskId)
      .subscribe(() => {
        this.taskFormDisabled = false;
        this.dialogRef.close();
        this.snackBar.open('Task updated', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
        this.router.navigateByUrl('/app/administration/tasks/task-list');

      });
  }

  deleteTask(id: string) {
    this.taskService.deleteTask(id)
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

  toggleCanBeRemoved(event: MatSlideToggleChange) {
    this.canBeRemoved = event.checked;
  }

  removeStyleTags(description){
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
      if(tag == false){
        resultArry.push(d);
      }
    });
    return resultArry.join('');
  }
}
