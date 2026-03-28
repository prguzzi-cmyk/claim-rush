import { ClientTask } from 'src/app/models/tasks-client.model';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { MatTableDataSource } from '@angular/material/table';
import { AbstractControl, ValidatorFn } from '@angular/forms';
import { ClaimFile } from 'src/app/models/files-claim.model';
import { ClaimFileShareRequest } from 'src/app/models/share-claim-files.model';
import { ClaimService } from 'src/app/services/claim.service';
import { v4 as uuidv4 } from 'uuid';

@Component({
    selector: 'app-claim-files-share-dialog',
    templateUrl: './claim-files-share-dialog.component.html',
    styleUrls: ['./claim-files-share-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ClaimFilesShareDialogComponent implements OnInit {

  action: string = 'add';
  shareFormDisabled = false;
  client_id: string;
  selectedClaimFiles: ClaimFile[] = [];
  file_share_id: string = uuidv4();

  clientTask : ClientTask;

  displayedColumns: string[] = [
    "name",
  ];  

  shareTypes: ShareType[] = [{ name: "Send As Link", value: 1 }, { name: "Send As Attachment", value: 2 }]
  
  selectedSharetype: ShareType = this.shareTypes[0];

  dataSource = new MatTableDataSource<ClaimFile>();

  shareFilesForm = new FormGroup({
    link_to_file: new FormControl({value: `${location.origin}/#/fv/${this.file_share_id}`, disabled: true}),
    email_files_to: new FormControl('', [Validators.required, emailListValidator()]), // Ensure this is a non-empty, valid list of emails
    expiration_date: new FormControl(null),
    message: new FormControl(null)
  });


  constructor(
    private dialogRef: MatDialogRef<ClaimFilesShareDialogComponent>,
    private claimService: ClaimService,
    private snackBar: MatSnackBar,
    public datepipe: DatePipe,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data) {
      this.client_id = data?.client?.id;
      this.action = data.type;
      this.selectedClaimFiles = data.selectedClaimFiles
    }

    if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
      this.clientTask = data?.clientTask;
    }

    this.dataSource = new MatTableDataSource<ClaimFile>(this.selectedClaimFiles);
  }

  ngOnInit(): void {
  }

  createShare() {
    this.shareFormDisabled = true;
    const shareRequest: ClaimFileShareRequest = {
      claim_file_ids: this.selectedClaimFiles.map(f => f.id),
      email_files_to: this.shareFilesForm.controls['email_files_to'].value.split(',').map((email: string) => email.trim()),
      share_type: this.selectedSharetype.value,
      file_share_id: this.file_share_id,
      message: this.shareFilesForm.controls['message'].value,
      expiration_date: this.datepipe.transform(this.shareFilesForm.controls['expiration_date'].value, 'yyyy-MM-dd')
    };

    cleanObject(shareRequest); // This will remove any null or empty properties.

    this.claimService.shareClaimFiles(shareRequest)
      .subscribe(() => {
        this.shareFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Claim file share successful', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  isShareTypeSelected(shareType: ShareType) {
    return shareType.value == this.selectedSharetype.value;
  }

  toggleShareType(shareType: ShareType) {
    if (shareType.value == 1) {
      this.selectedSharetype = this.shareTypes[0];
    } else {
      this.selectedSharetype = this.shareTypes[1];
    }
  }

}


class ShareType {
  name: string;
  value: number;
}


const emailPattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export function emailListValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (control.value) {
      const emails = control.value.split(',').map(email => email.trim());
      const invalidEmails = emails.filter(email => !emailPattern.test(email));
      return invalidEmails.length > 0 ? { 'emailListInvalid': { value: control.value } } : null;
    }
    return null;
  };
}

function cleanObject(obj: any) {
  Object.keys(obj).forEach(key => {
    if (obj[key] === null || obj[key] === undefined || (typeof obj[key] === 'string' && obj[key].trim() === '')) {
      delete obj[key];
    }
  });
}