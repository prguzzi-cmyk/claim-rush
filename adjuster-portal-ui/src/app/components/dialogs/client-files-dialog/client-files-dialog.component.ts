import { ClientService } from 'src/app/services/client.service';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from 'src/app/services/user.service';
import { FileSizePipe } from 'src/app/filesize.pipe';
import { ClientFile } from 'src/app/models/files-client.model'
import { NgxSpinnerService } from 'ngx-spinner';


@Component({
    selector: 'app-client-files-dialog',
    templateUrl: './client-files-dialog.component.html',
    styleUrls: ['./client-files-dialog.component.scss'],
    standalone: false
})
export class ClientFilesDialogComponent implements OnInit {
  fileUploadFormDisabled: boolean = false;
  client_id: string;

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
  clientFile: ClientFile;

  canBeRemoved: boolean = true;
  selection: any;
  title: any;

  constructor(
    private userService: UserService,
    private dialogRef: MatDialogRef<ClientFilesDialogComponent>,
    private snackBar: MatSnackBar,
    private spinner: NgxSpinnerService,
    private clientService: ClientService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.action = data.type;

      if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
        this.clientFile = data?.clientFile;
        this.title = data?.clientFile?.name;

        if(this.action == 'edit') {
          this.fileUploadForm.controls['fileName'].setValue(this.clientFile?.name);
          this.fileUploadForm.controls['description'].setValue(this.clientFile?.description);
          this.canBeRemoved = this.clientFile?.can_be_removed;
        }
      } else if (this.action == 'add') {

        if (data) {
          this.client_id = data?.client?.id;
        }

      }

      if (this.action == 'multiple' || this.action == 'multiple-delete') {
        this.selection = data?.selection;

        console.log(this.selection.selected.length);

        if (this.action == 'multiple-delete') {
            this.title = 'Delete multiple files';
        }
    }

    }
  }

  ngOnInit(): void {

  }

  deleteMultiple() {
    this.spinner.show();
      var promise = new Promise((resolve, reject) => {
          this.selection.selected.forEach(async (thisFile, index) => {
              await this.bulkDeleteClientFile(thisFile.id);
              if (index === this.selection.selected.length - 1) resolve(true);
          });
      });

      promise.then(() => {
        this.spinner.hide();
          this.dialogRef.close();
          this.snackBar.open('Claim files deleted.', 'Close', {
              duration: 5000,
              horizontalPosition: 'end',
              verticalPosition: 'bottom',
          });
      });
  }

  async bulkDeleteClientFile(fileId: string) {
      const promise = new Promise<void>((resolve, reject) => {
          this.clientService.deleteClientFiles(fileId).subscribe({
              next: (lead: any) => {
                  resolve();
              },
              error: (err: any) => {
                  reject(err);
              },
              complete: () => {},
          });
      });
      return promise;
  }

  saveFile() {

    this.fileUploadFormDisabled = true;

    let fileData = {
      file: this.file,
      file_name: this.fileUploadForm.get('fileName').value,
      description: this.fileUploadForm.get('description').value,
      can_be_removed: this.canBeRemoved
    }

    this.clientService.saveClientFiles(fileData, this.client_id).subscribe(
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

    this.clientService.updateClientFiles(fileData, this.clientFile.id).subscribe(
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

    this.clientService.deleteClientFiles(this.clientFile.id).subscribe(
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
