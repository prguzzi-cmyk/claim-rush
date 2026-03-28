import { ClaimService } from 'src/app/services/claim.service';
import { ClaimTask } from './../../../models/tasks-claim.model';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'app-claim-tasks-dialog',
    templateUrl: './claim-tasks-dialog.component.html',
    styleUrls: ['./claim-tasks-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ClaimTasksDialogComponent implements OnInit {

  types: string[] = ["phone-call", "email", "meeting", "reminder", "follow-up", "other"];
  statuses: string[] = ["pending", "in-progress", "waiting-on-carrier", "waiting-on-client", "completed"];
  properties: string[] = ["low","medium","high"];
  phases: string[] = [
    "claim-reported", "scope", "scope-complete", "estimate", "estimate-complete",
    "insurance-company-inspection", "insurance-company-inspection-complete",
    "waiting-for-initial-payment", "initial-payment-received",
    "supplement-payment-received", "appraisal", "mediation", "lawsuit",
    "final-payment-received", "check-at-bank", "client-cancelled", "claim-closed"
  ];
  action: string = 'add';
  claimTaskFormDisabled = false;
  claim_id: string;

  claimTask : ClaimTask;

  claimTaskForm = new FormGroup({
    title: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
    priority: new FormControl('', [Validators.required]),
    task_type: new FormControl('', [Validators.required]),
    due_date: new FormControl(null),
    status: new FormControl(null),
    related_claim_phase: new FormControl(null),
  });

  constructor(
    private dialogRef: MatDialogRef<ClaimTasksDialogComponent>,
    private claimService: ClaimService,
    private snackBar: MatSnackBar,
    public datepipe: DatePipe,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data) {
      this.claim_id = data?.claim?.id;
      this.action = data.type;
    }

    if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
      this.claimTask = data?.claimTask;
    }

    if (this.action == 'edit') {
      this.claimTaskForm.patchValue(this.claimTask);
    }

    // Default related_claim_phase to the claim's current phase on add
    if (this.action == 'add' && data?.claim?.current_phase) {
      this.claimTaskForm.patchValue({ related_claim_phase: data.claim.current_phase });
    }

  }

  ngOnInit(): void {
  }

  addTask() {
    this.claimTaskFormDisabled = true;

    let task = new ClaimTask;
    task.title = this.claimTaskForm.controls['title'].value;
    task.description = this.claimTaskForm.controls['description'].value;
    task.task_type = this.claimTaskForm.controls['task_type'].value;
    task.priority = this.claimTaskForm.controls['priority'].value;
    task.due_date = this.datepipe.transform(this.claimTaskForm.controls['due_date'].value, 'yyyy-MM-dd');
    task.related_claim_phase = this.claimTaskForm.controls['related_claim_phase'].value;

    this.claimService.addClaimTask(task, this.claim_id)
      .subscribe(() => {
        this.claimTaskFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Task created', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  updateTask() {
    this.claimTaskFormDisabled = true;

    let task = new ClaimTask;
    task.id = this.claimTask.id;
    task.title = this.claimTaskForm.controls['title'].value;
    task.description = this.claimTaskForm.controls['description'].value;
    task.task_type = this.claimTaskForm.controls['task_type'].value;
    task.priority = this.claimTaskForm.controls['priority'].value;
    task.status = this.claimTaskForm.controls['status'].value;
    task.due_date = this.datepipe.transform(this.claimTaskForm.controls['due_date'].value, 'yyyy-MM-dd');
    task.related_claim_phase = this.claimTaskForm.controls['related_claim_phase'].value;

    this.claimService.updateClaimTask(task)
      .subscribe(() => {
        this.claimTaskFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Task record has been updated', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  deleteTask() {
    this.claimTaskFormDisabled = true;

    this.claimService.deleteClaimTask(this.claimTask.id)
      .subscribe(() => {
        this.claimTaskFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Task record deleted', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

}


