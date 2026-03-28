import { ClaimService } from 'src/app/services/claim.service';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClientComment } from 'src/app/models/comment-client.model';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-claim-comments-dialog',
    templateUrl: './claim-comments-dialog.component.html',
    styleUrls: ['./claim-comments-dialog.component.scss'],
    standalone: false
})
export class ClaimCommentsDialogComponent implements OnInit {

  action: string = 'add';
  claimComment: ClientComment;
  canBeRemoved: boolean = true;

  commentFormDisabled: boolean = false;
  claim_id: string;
  comment_id: string;

  commentForm = new FormGroup({
    text: new FormControl('', [
      Validators.required
    ])});

  constructor(
    private userService: UserService,
    private dialogRef: MatDialogRef<ClaimCommentsDialogComponent>,
    private snackBar: MatSnackBar,
    private claimService: ClaimService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data) {

      // console.log(data);

      this.action = data.type;

      if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
        this.comment_id = data?.claimComment.id;
        this.claimComment = data?.claimComment;
        this.canBeRemoved = data?.claimComment.can_be_removed;

        if(this.action == 'edit') {
          this.commentForm.patchValue(data?.claimComment);
        }
      } else if (this.action == 'add') {

        if (data) {
          this.claim_id = data?.claim?.id;
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
    this.claimService.addClaimComments(data, this.claim_id).subscribe(
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
      claim_comment_id: this.comment_id,
      text: this.commentForm.get('text').value,
      can_be_removed: this.canBeRemoved
    };
    this.claimService.updateClaimComments(data).subscribe(
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

    this.claimService.deleteClaimComment(this.comment_id)
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


