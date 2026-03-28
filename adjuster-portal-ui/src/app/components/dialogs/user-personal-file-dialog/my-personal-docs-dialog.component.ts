import {Component, Inject, OnInit} from '@angular/core';
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {UserPersonalFile} from "../../../models/files-user.model";
import {MatSlideToggleChange} from "@angular/material/slide-toggle";
import {UserService} from "../../../services/user.service";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {MatSnackBar} from "@angular/material/snack-bar";

class PersonalFileType {
  id: number;
  name: string;
  fileFormat: string;
}


@Component({
  selector: 'my-personal-docs-dialog',
  templateUrl: './my-personal-docs-dialog.component.html',
  styleUrls: ['./my-personal-docs-dialog.component.scss'],
  standalone: false
})
export class MyPersonalDocsDialogComponent implements OnInit {

  fileUploadFormDisabled: boolean = false;
  user_id: string;
  fileTypes: PersonalFileType[] = [{
    id: 1,
    name: "License file",
    fileFormat: "application/pdf"
  }, {
    id: 2,
    name:"Bond file",
    fileFormat: "application/pdf"
  }, {
    id: 3,
    name:"Agent Agreement file",
    fileFormat: "application/pdf"
  }, {
    id: 4,
    name:"Head Image file",
    fileFormat: "png"
  }];

  states: string[] = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
    "Wisconsin", "Wyoming"
  ];


  selectedFileId: string |undefined;
  filename: string | undefined;
  userFile: File | undefined;
  fileType: string | undefined;
  fileUploadForm = new FormGroup({
    fileName: new FormControl('', [
      Validators.required
    ]),
    fileType: new FormControl(''),
    state: new FormControl('', []), // State input
    expirationDate: new FormControl('', []), // Expiration date input
    description: new FormControl(''),
  });

  action: string = 'add';
  userFileData: UserPersonalFile;
  protected canBeRemoved: boolean = false;

  constructor(
      private dialogRef: MatDialogRef<MyPersonalDocsDialogComponent>,
      private snackBar: MatSnackBar,
      private userService: UserService,
      @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  ngOnInit(): void {
    this.action = this.data?.type;
    this.userFileData = this.data?.file;
  }

  selectFile(event: any) {
    this.userFile = event.target.files[0];
    const fileTypeName = this.fileUploadForm.get('fileType').value
    const realFileType = this.getRealFileType(fileTypeName);
    if (realFileType?.fileFormat === this.userFile?.type) {
      this.fileType = this.userFile.type;
      this.filename = this.userFile?.name;
      this.fileUploadForm.controls['fileName'].setValue(this.filename);
      if (this.isLicenseOrBondFile()) {
        this.fileUploadForm.controls.state.addValidators(Validators.required);
        this.fileUploadForm.controls.expirationDate.addValidators(Validators.required);
      } else {
        this.fileUploadForm.controls.state.removeValidators(Validators.required);
        this.fileUploadForm.controls.expirationDate.removeValidators(Validators.required);
      }

    } else {
      this.snackBar.open(`Wrong file type detected, the desired file format should be ${realFileType.fileFormat}`, 'Close', {
        duration: 5000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    }
  }

  deleteFile() {
    this.fileUploadFormDisabled = true;

    if (this.userFileData) {
      this.userService.deletePersonalFiles(this.userFileData.id).subscribe(
          (result: any) => {
            if (result?.id != '') {
              this.fileUploadFormDisabled = false;
              this.dialogRef.close();
              this.snackBar.open('File has been deleted', 'Close', {
                duration: 5000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
              });
            }
          }
      )
    }
  }

  onDateChange(date: Date | null): void {
    if (date) {
      const isoDateString = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      this.fileUploadForm.get('expirationDate')?.setValue(isoDateString);
    }
  }

  saveFile() {
    this.fileUploadFormDisabled = true;

    const state = this.fileUploadForm.get('state').value;
    const expirationDate = this.fileUploadForm.get('expirationDate').value;
    let fileData = {
      file: this.userFile,
      file_name: this.fileUploadForm.get('fileName').value,
      state: state ? state : "",
      expiration_date: expirationDate ? expirationDate : "",
      description: this.fileUploadForm.get('description').value,
      can_be_removed: this.canBeRemoved
    }

    this.userService.savePersonalFiles(fileData).subscribe(
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

  private getRealFileType(fileTypeName: string): PersonalFileType {
    const personalFileTypes = this.fileTypes?.filter(value => value.name === fileTypeName);
    return personalFileTypes.length > 0 ? personalFileTypes[0] : null;
  }

  isLicenseOrBondFile() {
    const fileTypeName = this.fileUploadForm.controls['fileType'].value;
    const realFileType = this.getRealFileType(fileTypeName);
    return realFileType?.id === 1 || realFileType?.id === 2;
  }

  toggleCanBeRemoved(event: MatSlideToggleChange) {
    this.canBeRemoved = event.checked;
  }

  changeFileType(fileTypeName: any) {
    //this.fileUploadForm.controls['fileType'].setValue(fileTypeName);
  }

  updateFile() {
    this.fileUploadFormDisabled = true;

    let fileData = {
      name: this.fileUploadForm.get('fileName').value,
      description: this.fileUploadForm.get('description').value,
      state: this.fileUploadForm.get('state').value,
      expiration_date: this.fileUploadForm.get('expiration_date').value,
      can_be_removed: this.canBeRemoved
    }

    this.userService.updatePersonalFiles(fileData, this.selectedFileId).subscribe(
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
}
