import { HttpEventType, HttpResponse } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { ClaimService } from 'src/app/services/claim.service';
import { UserService } from 'src/app/services/user.service';
import { FileSizePipe } from 'src/app/filesize.pipe';
import { NgxSpinnerService } from 'ngx-spinner';
import { ClaimFile } from 'src/app/models/files-claim.model';

@Component({
    selector: 'app-claim-bulkfiles-dialog',
    templateUrl: './claim-bulkfiles-dialog.component.html',
    styleUrls: ['./claim-bulkfiles-dialog.component.scss'],
    standalone: false
})
export class ClaimBulkfilesDialogComponent implements OnInit {
    claimFiles: [ClaimFile] = null;

    fileUploadFormDisabled: boolean = false;
    claim_id: string;
    action: string = 'add';

    selectedFiles?: FileList;
    numberOfFiles: number = 0;
    progressInfos: any[] = [];
    message: string[] = [];
    messageError: string[] = [];
    isShared: boolean = false;

    constructor(
        private userService: UserService,
        private dialogRef: MatDialogRef<ClaimBulkfilesDialogComponent>,
        private snackBar: MatSnackBar,
        private claimService: ClaimService,
        private spinner: NgxSpinnerService,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        if (data) {
            this.action = data.type;
            this.claim_id = data?.claim?.id;
        }
    }

    ngOnInit(): void {
        this.getClaimFiles();
    }

    selectFiles(event: any): void {
        this.message = [];
        this.progressInfos = [];
        this.selectedFiles = event.target.files;
        this.numberOfFiles = this.selectedFiles?.length;
    }

    async uploadFiles() {
        if (this.selectedFiles) {
            var uploaded = new Promise<void>(async (resolve, reject) => {
                  this.fileUploadFormDisabled = true;
                  for (let i = 0; i < this.selectedFiles.length; i++) {
                        this.progressInfos[i] = {
                          value: 0,
                          fileName: this.selectedFiles[i].name,
                          size: this.selectedFiles[i].size,
                      };
                      let fileExists = false;
                      
                      this.claimFiles?.forEach((existingFile) => {
                          if (existingFile.name.trim() == this.selectedFiles[i].name.trim()) {
                              this.progressInfos[i] = {
                                  value: -1,
                                  fileName: this.selectedFiles[i].name,
                                  size: this.selectedFiles[i].size,
                              };
                              this.messageError.push(
                                  this.selectedFiles[i].name + ' - Already exists'
                              );
                              fileExists = true;
                          }
                      });
      
                      if (fileExists == false) {
                          await this.upload(i, this.selectedFiles[i]);
                      }

                      if (i === this.selectedFiles.length -1) {
                        resolve();
                      }

                    }
            });

            uploaded.then(() => {
              this.fileUploadFormDisabled = false;
            });
   
        }
    }

    async upload(idx: number, file: File) {
        const promise = new Promise<void>((resolve, reject) => {
          this.claimService.saveBulkClaimFiles(file, this.claim_id, this.isShared ? 'shared' : 'internal').subscribe({
              next: (event: any) => {
                  if (event.type === HttpEventType.UploadProgress) {
                      this.fileUploadFormDisabled = true;
                      this.progressInfos[idx].value = event.total
                          ? Math.round((100 * event.loaded) / event.total)
                          : (this.fileUploadFormDisabled = true);
                  } else if (event instanceof HttpResponse) {
                      this.message.push(file.name + ' - Success');
                  }
              },
              error: (err: any) => {
                  this.fileUploadFormDisabled = false;
                  resolve();
                  this.progressInfos[idx].value = 0;
                  this.messageError.push(
                      file.name + ' - Failed - ' + err?.error?.detail
                  );
              },
              complete: () => {
                this.fileUploadFormDisabled = false;
                resolve();
              },
          });
        });
        return promise;
    }

    getClaimFiles() {
        this.spinner.show();
        this.claimService
            .getClaimFiles(this.claim_id,1,100)
            .subscribe((claimFiles) => {
                this.spinner.hide();
                if (claimFiles !== undefined) {
                    if (claimFiles) {
                        this.claimFiles = claimFiles.items;
                    }
                }
            });
    }
}
