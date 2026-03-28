import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { Lead } from 'src/app/models/lead.model';
import { User } from 'src/app/models/user.model';
import { LeadService } from 'src/app/services/leads.service';
import { UserService } from 'src/app/services/user.service';
import { atLeastOneValidator } from 'src/app/validators/atLeastOneFormFieldValidator';

@Component({
    selector: 'app-leads-edit-dialog',
    templateUrl: './leads-edit-dialog.component.html',
    styleUrls: ['./leads-edit-dialog.component.scss'],
    standalone: false
})
export class LeadsEditDialogComponent implements OnInit {
  selection : any;

  action: string = 'add';
  title: string = 'Edit multiple leads';
  lead: Lead;

  role: string;
  agent: User;
  agents: any[];
  user: User;
  createClaim: boolean = false;
  phases: any;

  FormDisabled: boolean = false;

  statuses: string[] = ["callback", "not-interested", "signed", "transfer", "not-qualified", "interested", "pending-sign"];
  sources: string[] = ['self', 'company', 'other'];

  public leadForm = new FormGroup({
      assign_to: new FormControl(''),
      status: new FormControl(''),
      source: new FormControl(''),
  }, { validators: atLeastOneValidator() });

  constructor(
      private userService: UserService,
      private dialogRef: MatDialogRef<LeadsEditDialogComponent>,
      private snackBar: MatSnackBar,
      private leadService: LeadService,
      private spinner: NgxSpinnerService,
      @Inject(MAT_DIALOG_DATA) public data: any
  ) {

      this.selection = null;
      this.role = localStorage.getItem('role-name');

      if (this.role == 'super-admin' || this.role == 'admin') {
          this.statuses.push('signed-approved');
          this.getUsers();
      }

      if (data) {
          this.action = data.type;
      }

      if (this.action == 'multiple') {
          this.selection = data?.selection;
      }
  }

  updateMultiple() {
      let belongsTo = this.leadForm.controls['assign_to'].value;
      let status = this.leadForm.controls['status'].value;
      let source = this.leadForm.controls['source'].value;

      this.spinner.show();
      var promise = new Promise((resolve, reject) => {
          this.selection.selected.forEach(async (thisClaim, index) => {
              await this.bulkUpdateClaim(
                  thisClaim.id,
                  belongsTo,
                  status,
                  source
              );
              if (index === this.selection.selected.length - 1) resolve(true);
          });
      });

      promise.then(() => {
          this.spinner.hide();
          this.dialogRef.close();
          this.snackBar.open('Client records updated', 'Close', {
              duration: 5000,
              horizontalPosition: 'end',
              verticalPosition: 'bottom',
          });
      });
  }

  async bulkUpdateClaim(
      leadId: string,
      assignedTo: string,
      status: string,
      source: string
  ) {
      let newLead = new Lead();
      newLead.id = leadId;

      if (assignedTo != '' && assignedTo != null) {
        newLead.assigned_to = assignedTo;
      }

      if (status != '' && status != null) {
        newLead.status = status;
      }

      if (source != '' && source != null) {
        newLead.source = source;
      }

      const promise = new Promise<void>((resolve, reject) => {
          this.leadService.updateLead(newLead).subscribe({
              next: (lead: any) => {
                  resolve();
              },
              error: (err: any) => {
                  reject(err);
              },
              complete: () => {
                  // console.log('comment complete');
              },
          });
      });
      return promise;
  }

  ngOnInit(): void {
      this.getUser();
  }

  getUsers() {
      this.userService.getUsers(1,100).subscribe((agents) => {
          this.agents = agents.items;
      });
  }

  getUser() {
      this.userService.currentUser.subscribe((user) => {
          if (user) {
              this.user = user;
          }
      });
  }
}
