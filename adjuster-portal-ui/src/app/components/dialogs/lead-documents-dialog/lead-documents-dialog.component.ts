import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LeadFile } from 'src/app/models/files-lead.model';
import { UserService } from 'src/app/services/user.service';
import { LeadService } from 'src/app/services/leads.service';
import { FileSizePipe } from 'src/app/filesize.pipe';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

@Component({
    selector: 'app-lead-documents-dialog',
    templateUrl: './lead-documents-dialog.component.html',
    styleUrls: ['./lead-documents-dialog.component.scss'],
    providers: [
        FileSizePipe
    ],
    standalone: false
})

export class LeadDocumentsDialogComponent implements OnInit {

  fileUploadFormDisabled: boolean = false;
  lead_id: string;

  filename: string | undefined;
  file: File | undefined;
  fileType: string | undefined;

  fileUploadForm = new FormGroup({
    fileName: new FormControl('', [
      Validators.required
    ]),
    description: new FormControl(''),
  });

  action: string = 'add';
  leadFile: LeadFile;

  canBeRemoved: boolean = true;

  constructor(
    private userService: UserService,
    private dialogRef: MatDialogRef<LeadDocumentsDialogComponent>,
    private snackBar: MatSnackBar,
    private leadService: LeadService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.action = data.type;


      if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
        this.leadFile = data?.leadFile;

        if(this.action == 'edit') {
          this.fileUploadForm.controls['fileName'].setValue(this.leadFile?.name);
          this.fileUploadForm.controls['description'].setValue(this.leadFile?.description);
          this.canBeRemoved = this.leadFile?.can_be_removed;
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

  saveFile() {

    this.fileUploadFormDisabled = true;

    let fileData = {
      file: this.file,
      file_name: this.fileUploadForm.get('fileName').value,
      description: this.fileUploadForm.get('description').value,
      can_be_removed: this.canBeRemoved
    }

    this.leadService.saveLeadFiles(fileData, this.lead_id).subscribe(
      (result: any) => {
        if (result?.id != '') {
          this.fileUploadFormDisabled = false;
          this.dialogRef.close();

          this.snackBar.open('File has been saved', 'Close', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
          });
        }
      }
    );
  }

  updateFile() {

    this.fileUploadFormDisabled = true;

    let fileData = {
      name: this.fileUploadForm.get('fileName').value,
      description: this.fileUploadForm.get('description').value,
      can_be_removed: this.canBeRemoved
    }

    this.leadService.updateLeadFiles(fileData, this.leadFile.id).subscribe(
      (result: any) => {
        if (result?.id != '') {

          this.fileUploadFormDisabled = false;
          this.dialogRef.close();

          this.snackBar.open('File has been updated', 'Close', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
          });
        }
      }
    );
  }

  deleteFile() {

    this.fileUploadFormDisabled = true;

    this.leadService.deleteLeadFiles(this.leadFile.id).subscribe(
      (result: any) => {
          this.fileUploadFormDisabled = false;
          this.dialogRef.close();
          this.snackBar.open('File has been deleted', 'Close', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
          });
        }
    );

  }

  selectFile(event: any) {
    this.file = event.target.files[0];
    this.filename = this.file?.name;
    this.fileType = this.file?.type;

    if (this.fileUploadForm.get('fileName').value == '') {
      this.fileUploadForm.controls['fileName'].setValue(this.filename);
    }
  }

  toggleCanBeRemoved(event: MatSlideToggleChange) {
    this.canBeRemoved = event.checked;
  }
}
