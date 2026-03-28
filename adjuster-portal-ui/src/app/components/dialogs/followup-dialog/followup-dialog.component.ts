import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LeadService } from 'src/app/services/leads.service';
import { Followup } from 'src/app/models/followup.model';
import { LeadTask } from 'src/app/models/tasks-lead.model';
import { DatePipe } from '@angular/common';


@Component({
    selector: 'app-followup-dialog',
    templateUrl: './followup-dialog.component.html',
    styleUrls: ['./followup-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})

export class FollowupDialogComponent implements OnInit {

  types: string[] = ["phone-call", "email", "meeting", "reminder", "follow-up", "other"];
  properties: string[] = ["low","medium","high"];
  action: string = 'add';
  leadTaskFormDisabled = false;
  lead_id: string;

  leadTask : LeadTask;

  leadTaskForm = new FormGroup({
    title: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
    priority: new FormControl('', [Validators.required]),
    task_type: new FormControl('', [Validators.required]),
    due_date: new FormControl(null),
    // start_date: new FormControl('', [Validators.required]),
    // completion_date: new FormControl('', [Validators.required]),
    // assignee_id: new FormControl('', [Validators.required]),
    // can_be_removed: new FormControl('', [Validators.required]),
    // is_removed: new FormControl(null)
  });

  constructor(
    private dialogRef: MatDialogRef<FollowupDialogComponent>,
    private leadService: LeadService,
    private snackBar: MatSnackBar,
    public datepipe: DatePipe,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data) {
      this.lead_id = data?.lead?.id;
      this.action = data.type;
    }

    if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
      this.leadTask = data?.leadTask;
    }

    if (this.action == 'edit') {
      this.leadTaskForm.patchValue(this.leadTask);
    }

  }

  ngOnInit(): void {

  }

  addTask() {
    this.leadTaskFormDisabled = true;

    let task = new LeadTask;
    task.title = this.leadTaskForm.controls['title'].value;
    task.description = this.leadTaskForm.controls['description'].value;
    task.task_type = this.leadTaskForm.controls['task_type'].value;
    task.priority = this.leadTaskForm.controls['priority'].value;
    task.due_date = this.datepipe.transform(this.leadTaskForm.controls['due_date'].value, 'yyyy-MM-dd');


    this.leadService.addTasks(task, this.lead_id)
      .subscribe(() => {
        this.leadTaskFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Task created', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  updateFollowup() {
    this.leadTaskFormDisabled = true;

    let leadTask = new LeadTask;
    leadTask.id = this.leadTask.id;
    leadTask.title = this.leadTaskForm.controls['type'].value;
    leadTask.due_date = this.leadTaskForm.controls['next_date'].value;
    leadTask.description = this.leadTaskForm.controls['note'].value;



    this.leadService.updateLeadTask(leadTask)
      .subscribe(() => {
        this.leadTaskFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Task record has been updated', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  deleteFollowup() {
    this.leadTaskFormDisabled = true;

    this.leadService.deleteLeadTask(this.leadTask.id)
      .subscribe(() => {
        this.leadTaskFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Task record deleted', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

}
