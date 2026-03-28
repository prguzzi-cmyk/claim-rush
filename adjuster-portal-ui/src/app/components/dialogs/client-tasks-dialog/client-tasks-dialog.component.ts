import { ClientTask } from 'src/app/models/tasks-client.model';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { ClientService } from 'src/app/services/client.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-client-tasks-dialog',
    templateUrl: './client-tasks-dialog.component.html',
    styleUrls: ['./client-tasks-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ClientTasksDialogComponent implements OnInit {

  types: string[] = ["phone-call", "email", "meeting", "reminder", "follow-up", "other"];
  properties: string[] = ["low","medium","high"];
  statuses: string[] = ["to-do", "in-progress", "on-hold", "done"];

  action: string = 'add';
  clientTaskFormDisabled = false;
  client_id: string;

  clientTask : ClientTask;

  clientTaskForm = new FormGroup({
    title: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
    priority: new FormControl('', [Validators.required]),
    task_type: new FormControl('', [Validators.required]),
    due_date: new FormControl(null),
    status: new FormControl(null),
  });

  constructor(
    private dialogRef: MatDialogRef<ClientTasksDialogComponent>,
    private clientService: ClientService,
    private snackBar: MatSnackBar,
    public datepipe: DatePipe,
    public userService: UserService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data) {
      this.client_id = data?.client?.id;
      this.action = data.type;
    }

    if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
      this.clientTask = data?.clientTask;
    }

    if (this.action == 'edit') {
      this.clientTaskForm.patchValue(this.clientTask);
    }

  }

  ngOnInit(): void {
  }

  addTask() {
    this.clientTaskFormDisabled = true;

    let task = new ClientTask;
    task.title = this.clientTaskForm.controls['title'].value;
    task.description = this.clientTaskForm.controls['description'].value;
    task.task_type = this.clientTaskForm.controls['task_type'].value;
    task.priority = this.clientTaskForm.controls['priority'].value;
    task.due_date = this.datepipe.transform(this.clientTaskForm.controls['due_date'].value, 'yyyy-MM-dd');

    this.clientService.addClientTask(task, this.client_id)
      .subscribe(() => {
        this.clientTaskFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Task created', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  updateTask() {
    this.clientTaskFormDisabled = true;

    let task = new ClientTask;
    task.id = this.clientTask.id;
    task.title = this.clientTaskForm.controls['title'].value;
    task.description = this.clientTaskForm.controls['description'].value;
    task.task_type = this.clientTaskForm.controls['task_type'].value;
    task.priority = this.clientTaskForm.controls['priority'].value;
    task.status = this.clientTaskForm.controls['status'].value;
    task.due_date = this.datepipe.transform(this.clientTaskForm.controls['due_date'].value, 'yyyy-MM-dd');

    this.clientService.updateClientTask(task)
      .subscribe(() => {
        this.clientTaskFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Task record has been updated', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  deleteTask() {
    this.clientTaskFormDisabled = true;

    this.clientService.deleteClientTask(this.clientTask.id)
      .subscribe(() => {
        this.clientTaskFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Task record deleted', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

}
