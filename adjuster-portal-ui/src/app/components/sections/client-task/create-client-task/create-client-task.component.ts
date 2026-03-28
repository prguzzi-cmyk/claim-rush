import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { Role } from 'src/app/models/role.model';
import { ClientTask } from 'src/app/models/tasks-client.model';
import { User } from 'src/app/models/user.model';

@Component({
    selector: 'app-create-client-task',
    templateUrl: './create-client-task.component.html',
    styleUrls: ['./create-client-task.component.scss'],
    standalone: false
})
export class CreateClientTaskComponent implements OnInit {

 
 
  // clientTasks : ClientTask;
  // user: User;
  // role: Role;
  // userTaskForm = new FormGroup({
  //   title: new FormControl('', [Validators.required]),
  //   description: new FormControl(''),
  //   due_date: new FormControl(''),
  //   priority: new FormControl('')
  // });
  // type = 'add';
  // userTaskId = '';
  // status = 'Save';
  // taskList = []
  // isActive = false;
  // canBeRemoved = false;

  // constructor( 
  //             //  private taskService: TasksService, 
  //              private clientTaskService: , 
  //              public datepipe: DatePipe,
  //              private router: Router,
  //              private dialogRef: MatDialogRef<CreateuserTaskComponent>,
  //              private snackBar: MatSnackBar,
  //              private userService: UserService,
  //              private roleService: RoleService,
  //              @Inject(MAT_DIALOG_DATA) public data: any) 
  //              {

  //               if(data){
  //                 this.type = data.type;
  //               }
  //               if(data.type == 'edit'){
  //                 this.status = 'Update User Task';
  //                 this.userTaskForm.controls['title'].setValue(data.clientTasks?.title);
  //                 this.userTaskForm.controls['description'].setValue(data.clientTasks?.description);
  //                 this.userTaskForm.controls['due_date'].setValue(this.datepipe.transform(data.clientTasks?.due_date, 'yyyy-MM-ddThh:mm'));
  //                 this.userTaskForm.controls['priority'].setValue(data.clientTasks?.priority);
  //                 this.isActive = data.clientTasks?.is_active;
  //                 this.userTaskId = data?.clientTasks?.id;
  //               } else if(data.type == 'add'){
  //                 this.status = 'Add User Task';
  //                 this.userTaskForm.controls['title'].setValue(data.clientTasks?.title);
  //                 this.userTaskForm.controls['description'].setValue(data.clientTasks?.description);
  //                 this.userTaskForm.controls['due_date'].setValue(this.datepipe.transform(data.clientTasks?.due_date, 'yyyy-MM-ddThh:mm'));
  //                 this.userTaskForm.controls['priority'].setValue(data.clientTasks?.priority);
  //                 this.isActive = false;
  //                 this.canBeRemoved = false;
  //               }else if(data.type == 'delete'){
  //                 this.userTaskId = data.clientTasks.id;
  //                 this.status = '';
  //               }else if(data.type == 'view'){
  //                 this.clientTasks = data.clientTasks;
  //                 this.status = '';
  //               }

  //  }

  ngOnInit(): void {
    // this.getCurrentUser();
  }

  // getCurrentUser() {
  //   this.userService.currentUser.subscribe((user) => {
  //     if(user?.role_id != '') {
  //       this.user = user;
  //       }
  //   });
  // }


  // saveUserTask(){    
  //   this.userTaskForm.markAllAsTouched;
  //   if (this.userTaskForm.valid) {
  //   if(this.type == 'add'){
  //     this.addUserTask();
  //   } else if(this.type == 'edit'){
  //     this.updateUserTask();
  //   }
  // }
  // }

  // addUserTask() {
  //   // this.userTaskFormDisabled = true;
  //   let clientTasks = new ClientTasks();
  //   let dueDate = this.datepipe.transform(this.userTaskForm.controls['due_date'].value, 'yyyy-MM-dd');
  //   clientTasks.title = this.userTaskForm.controls['title'].value;
  //   clientTasks.description = this.userTaskForm.controls['description'].value;
  //   clientTasks.due_date = dueDate;
  //   clientTasks.priority = this.userTaskForm.controls['priority'].value;
  //   clientTasks.is_active = this.isActive;
  //   this.userTaskService.addUserTask(clientTasks)
  //     .subscribe(() => {
  //       // this.userTaskFormDisabled = false;
  //       this.dialogRef.close();
  //       this.snackBar.open('User Task added', 'Close', {
  //         duration: 5000,
  //         horizontalPosition: 'end',
  //         verticalPosition: 'bottom',
  //       });
  //       this.router.navigateByUrl('/app/administration/usertask/clientTasks-list');
  //     });
  // }

  // updateUserTask(){
  //   let clientTasks = new ClientTasks();
  //   let dueDate = this.datepipe.transform(this.userTaskForm.controls['due_date'].value, 'yyyy-MM-dd')
  //   clientTasks.title = this.userTaskForm.controls['title'].value;
  //   clientTasks.description = this.userTaskForm.controls['description'].value;
  //   clientTasks.due_date = dueDate;
  //   clientTasks.priority = this.userTaskForm.controls['priority'].value;
  //   clientTasks.is_active = this.isActive;
  //   this.userTaskService.updateUserTask(clientTasks, this.userTaskId)
  //     .subscribe(() => {
  //       // this.userTaskFormDisabled = false;
  //       this.dialogRef.close();
  //       this.snackBar.open('clientTasks updated', 'Close', {
  //         duration: 5000,
  //         horizontalPosition: 'end',
  //         verticalPosition: 'bottom',
  //       });
  //       this.router.navigateByUrl('/app/administration/usertask/usertask-list');
  //     });
  // }

  // deleteUserTask(id: any) {
  //   this.userTaskService.deleteUserTask(id)
  //     .subscribe(() => {
  //       // this.userFormDisabled = false;
  //       this.dialogRef.close();
  //       this.snackBar.open('User Task has been deleted.', 'Close', {
  //         duration: 5000,
  //         horizontalPosition: 'end',
  //         verticalPosition: 'bottom',
  //       });
  //     });
  // }
  
  // toggleIsActive(event: MatSlideToggleChange) {
  //   this.isActive = event.checked;
  // }


}
