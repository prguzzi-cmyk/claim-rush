import { Component, Inject, OnInit } from '@angular/core';
import { ClientService } from 'src/app/services/client.service';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from 'src/app/services/user.service';
import { FileSizePipe } from 'src/app/filesize.pipe';
import { ClientFile } from 'src/app/models/files-client.model';
import { HttpEventType, HttpResponse } from '@angular/common/http';

@Component({
    selector: 'app-client-bulk-files-dialog',
    templateUrl: './client-bulk-files-dialog.component.html',
    styleUrls: ['./client-bulk-files-dialog.component.scss'],
    standalone: false
})
export class ClientBulkFilesDialogComponent implements OnInit {
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
  selectedFiles?: FileList;
  numberOfFiles: number = 0;
  progressInfos: any[] = [];
  message: string[] = [];

  constructor(
    private userService: UserService,
    private dialogRef: MatDialogRef<ClientBulkFilesDialogComponent>,
    private snackBar: MatSnackBar,
    private clientService: ClientService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      
          this.action = data.type;
          this.client_id = data?.client?.id;
      }

    }

  ngOnInit(): void {

  }
  
  selectFiles(event: any): void {
    this.message = [];
    this.progressInfos = [];
    this.selectedFiles = event.target.files;
    this.numberOfFiles = this.selectedFiles?.length;
  }

  uploadFiles(): void {
    if (this.selectedFiles) {
      for (let i = 0; i < this.selectedFiles.length; i++) {
        this.upload(i, this.selectedFiles[i]);
      }
    }
  }

  upload(idx: number, file: File): void {
    this.fileUploadFormDisabled = true;
    this.progressInfos[idx] = { value: 0, fileName: file.name };
    
    this.clientService.saveBulkClientFiles(file, this.client_id).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.progressInfos[idx].value = Math.round(100 * event.loaded / event.total);
        } else if (event instanceof HttpResponse) {
          this.message.push('Uploaded the file successfully: ' + file.name);
          this.fileUploadFormDisabled = false;
        }
      },
      error: (err: any) => {
        this.progressInfos[idx].value = 0;
        this.message.push('Could not upload the file: ' + err?.error?.detail + file.name);
        this.fileUploadFormDisabled = false;
      }
    });
  }


}
