import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClientComment } from 'src/app/models/comment-client.model';
import { UserService } from 'src/app/services/user.service';
import { ClientService } from 'src/app/services/client.service';

@Component({
    selector: 'app-client-comments-dialog',
    templateUrl: './client-comments-dialog.component.html',
    styleUrls: ['./client-comments-dialog.component.scss'],
    standalone: false
})
export class ClientCommentsDialogComponent implements OnInit {

  action: string = 'add';
  clientComment: ClientComment;
  canBeRemoved: boolean = true;

  commentFormDisabled: boolean = false;
  client_id: string;
  comment_id: string;

  commentForm = new FormGroup({
    text: new FormControl('', [
      Validators.required
    ])});

  constructor(
    private userService: UserService,
    private dialogRef: MatDialogRef<ClientCommentsDialogComponent>,
    private snackBar: MatSnackBar,
    private clientService: ClientService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data) {

      this.action = data.type;

      if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
        this.comment_id = data?.clientComment.id;
        this.clientComment = data?.clientComment;
        this.canBeRemoved = data?.clientComment.can_be_removed;

        if(this.action == 'edit') {
          this.commentForm.patchValue(data?.clientComment);
        }
      } else if (this.action == 'add') {

        if (data) {
          this.client_id = data?.client?.id;
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
    this.clientService.addClientComments(data, this.client_id).subscribe(
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
      client_comment_id: this.comment_id,
      text: this.commentForm.get('text').value,
      can_be_removed: this.canBeRemoved
    };
    this.clientService.updateClientComments(data).subscribe(
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

    this.clientService.deleteClientComment(this.comment_id)
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
