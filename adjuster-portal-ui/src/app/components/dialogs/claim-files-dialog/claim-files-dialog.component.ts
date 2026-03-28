import { ClaimService } from 'src/app/services/claim.service';

import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from 'src/app/services/user.service';
import { FileSizePipe } from 'src/app/filesize.pipe';
import { ClaimFile } from 'src/app/models/files-claim.model';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
    selector: 'app-claim-files-dialog',
    templateUrl: './claim-files-dialog.component.html',
    styleUrls: ['./claim-files-dialog.component.scss'],
    standalone: false
})
export class ClaimFilesDialogComponent implements OnInit {
    fileUploadFormDisabled: boolean = false;
    claim_id: string;

    filename: string | undefined;
    file: File | undefined;
    fileType: string | undefined;

    fileUploadForm = new FormGroup({
        fileName: new FormControl('', [Validators.required]),
        description: new FormControl(''),
    });

    selection: any;
    title: any;
    action: string = 'add';
    claimFile: ClaimFile;

    canBeRemoved: boolean = true;
    isShared: boolean = false;

    constructor(
        private userService: UserService,
        private dialogRef: MatDialogRef<ClaimFilesDialogComponent>,
        private snackBar: MatSnackBar,
        private spinner: NgxSpinnerService,
        private claimService: ClaimService,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        if (data) {
            this.action = data.type;

            if (
                this.action == 'view' ||
                this.action == 'delete' ||
                this.action == 'edit'
            ) {
                this.claimFile = data?.claimFile;
                this.title = this.claimFile?.name;

                if (this.action == 'edit') {
                    this.fileUploadForm.controls['fileName'].setValue(
                        this.claimFile?.name
                    );
                    this.fileUploadForm.controls['description'].setValue(
                        this.claimFile?.description
                    );
                    this.canBeRemoved = this.claimFile?.can_be_removed;
                }
            } else if (this.action == 'add') {
                this.title = 'Upload Claim File';

                if (data) {
                    this.claim_id = data?.claim?.id;
                }
            }

            if (this.action == 'multiple' || this.action == 'multiple-delete') {
                this.selection = data?.selection;

                console.log(this.selection.selected.length);

                if (this.action == 'multiple-delete') {
                    this.title = 'Delete multiple claim files';
                }
            }
        }
    }

    ngOnInit(): void {}

    saveFile() {
        if (!this.file) {
            this.snackBar.open('Please choose a file first.', 'Close', {
                duration: 5000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
            });
            return;
        }

        this.fileUploadFormDisabled = true;

        let fileData = {
            file: this.file,
            file_name: this.fileUploadForm.get('fileName').value,
            description: this.fileUploadForm.get('description').value,
            can_be_removed: this.canBeRemoved,
            visibility: this.isShared ? 'shared' : 'internal',
        };

        console.log('[ClaimFileUpload] Uploading file:', {
            name: this.file.name,
            type: this.file.type,
            size: this.file.size,
            claim_id: this.claim_id,
        });

        this.claimService
            .saveClaimFiles(fileData, this.claim_id)
            .subscribe({
                next: (result: any) => {
                    this.fileUploadFormDisabled = false;
                    if (result?.id) {
                        this.dialogRef.close();
                        this.snackBar.open('File uploaded successfully', 'Close', {
                            duration: 5000,
                            horizontalPosition: 'end',
                            verticalPosition: 'bottom',
                        });
                    }
                },
                error: (err: any) => {
                    this.fileUploadFormDisabled = false;
                    console.error('[ClaimFileUpload] Upload failed:', err);

                    const detail = err?.error?.detail || err?.message || '';
                    let msg = 'PDF upload failed';
                    if (detail.toLowerCase().includes('type') || detail.toLowerCase().includes('mime')) {
                        msg = 'PDF upload failed: unsupported file type';
                    } else if (detail.toLowerCase().includes('storage') || detail.toLowerCase().includes('s3') || detail.toLowerCase().includes('copy')) {
                        msg = 'PDF upload failed: backend storage error';
                    } else if (detail.toLowerCase().includes('permission') || detail.toLowerCase().includes('ownership')) {
                        msg = 'PDF upload failed: permission denied';
                    } else if (detail) {
                        msg = `Upload failed: ${detail}`;
                    }

                    this.snackBar.open(msg, 'Close', {
                        duration: 8000,
                        horizontalPosition: 'end',
                        verticalPosition: 'bottom',
                    });
                },
            });
    }

    updateFile() {
        this.fileUploadFormDisabled = true;

        let fileData = {
            name: this.fileUploadForm.get('fileName').value,
            description: this.fileUploadForm.get('description').value,
            can_be_removed: this.canBeRemoved,
        };

        this.claimService
            .updateClaimFiles(fileData, this.claimFile.id)
            .subscribe((result: any) => {
                if (result?.id != '') {
                    this.fileUploadFormDisabled = false;
                    this.dialogRef.close();

                    this.snackBar.open('File has been updated', 'Close', {
                        duration: 5000,
                        horizontalPosition: 'end',
                        verticalPosition: 'bottom',
                    });
                }
            });
    }

    deleteFile() {
        this.fileUploadFormDisabled = true;

        this.claimService
            .deleteClaimFiles(this.claimFile.id)
            .subscribe((result: any) => {
                this.fileUploadFormDisabled = false;
                this.dialogRef.close();
                this.snackBar.open('File has been deleted', 'Close', {
                    duration: 5000,
                    horizontalPosition: 'end',
                    verticalPosition: 'bottom',
                });
            });
    }

    deleteMultiple() {
      this.spinner.show();
        var promise = new Promise((resolve, reject) => {
            this.selection.selected.forEach(async (thisFile, index) => {
                await this.bulkDeleteClaimFile(thisFile.id);
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

    async bulkDeleteClaimFile(fileId: string) {
        const promise = new Promise<void>((resolve, reject) => {
            this.claimService.deleteClaimFiles(fileId).subscribe({
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

    selectFile(event: any) {
        this.file = event.target.files[0];
        this.filename = this.file?.name;
        this.fileType = this.file?.type;
    }

    toggleCanBeRemoved(event: MatSlideToggleChange) {
        this.canBeRemoved = event.checked;
    }

    toggleVisibility(event: MatSlideToggleChange) {
        this.isShared = event.checked;
    }
}
