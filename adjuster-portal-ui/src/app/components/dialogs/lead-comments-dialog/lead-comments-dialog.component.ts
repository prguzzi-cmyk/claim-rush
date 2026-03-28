import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LeadComment } from 'src/app/models/comment-lead.model';
import { LeadService } from 'src/app/services/leads.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-lead-comments-dialog',
    templateUrl: './lead-comments-dialog.component.html',
    styleUrls: ['./lead-comments-dialog.component.scss'],
    standalone: false
})
export class LeadCommentsDialogComponent implements OnInit {

  action: string = 'add';
  leadComment: LeadComment;
  canBeRemoved: boolean;

  commentFormDisabled: boolean = false;
  lead_id: string;
  comment_id: string;

  commentForm = new FormGroup({
    text: new FormControl('', [
      Validators.required
    ])});

  constructor(
    private userService: UserService,
    private dialogRef: MatDialogRef<LeadCommentsDialogComponent>,
    private snackBar: MatSnackBar,
    private leadService: LeadService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data) {
      this.action = data.type;


      if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
        this.comment_id = data?.leadComment.id;
        this.leadComment = data?.leadComment;
        this.canBeRemoved = data?.leadComment.can_be_removed;

        if(this.action == 'edit') {
          this.commentForm.patchValue(data?.leadComment);
        }
      } else if (this.action == 'add') {

        if (data) {
          this.lead_id = data?.lead?.id;
        }

      }

    }
  }

  ngOnInit(): void {

  }

  addComment() {
    let data = {
      text: this.commentForm.get('text').value,
      can_be_removed: this.canBeRemoved
    };
    this.leadService.addLeadComments(data, this.lead_id).subscribe(
      (result: any) => {
        if (result?.id != '') {

          this.commentFormDisabled = false;
          this.dialogRef.close();

          this.snackBar.open('Comment has been saved', 'Close', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
          });
        }
      },
      error => {
        this.commentFormDisabled = false;
      }
    );
  }

  updateComment() {
    let data = {
      text: this.commentForm.get('text').value,
      can_be_removed: this.canBeRemoved
    };
    this.leadService.updateLeadComments(data, this.comment_id).subscribe(
      (result: any) => {
        if (result?.id != '') {

          this.commentFormDisabled = false;
          this.dialogRef.close();

          this.snackBar.open('Comment has been saved', 'Close', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
          });
        }
      }
    );
  }

  deleteComment() {
    this.commentFormDisabled = true;

    this.leadService.deleteLeadComment(this.comment_id)
      .subscribe(() => {
        this.commentFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Comment deleted', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  toggleCanBeRemoved(event: MatSlideToggleChange) {
    this.canBeRemoved = event.checked;
  }

}
