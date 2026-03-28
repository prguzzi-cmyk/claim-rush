import { Component, OnInit, Inject } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { FileService } from "src/app/services/file.service";
import { TagService } from "src/app/services/tag.service";
import { NotificationService } from "src/app/services/notification.service";
import { FileResource } from "src/app/models/file-resource.model";
import { Tag } from "src/app/models/tag.model";
import { FileTag } from "src/app/models/file-tag.model";

@Component({
    selector: "app-file-dialog",
    templateUrl: "./file-dialog.component.html",
    styleUrls: ["./file-dialog.component.scss"],
    standalone: false
})
export class FileDialogComponent implements OnInit {
  file: FileResource;

  tags: Tag[];

  fileTags: FileTag[] = [];

  selectedFile = {};

  canBeRemoved: boolean = true;

  type: string = "create";

  fileFormDisabled: boolean = false;

  fileForm = new FormGroup({
    name: new FormControl("", [Validators.required, Validators.maxLength(255)]),
    description: new FormControl(""),
  });

  constructor(
    private fileService: FileService,
    private tagService: TagService,
    private notificationService: NotificationService,
    private dialogRef: MatDialogRef<FileDialogComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.type = data.type;

      if (data.file) {
        this.file = data.file;
      }

      if (this.type == "upload" || this.type == "edit") {
        this.getTags();
      }

      if (this.type == "edit") {
        this.fileForm.controls["name"].setValue(this.file.name);
        this.fileForm.controls["description"].setValue(this.file.description);
        this.fileTags = this.file.tags;
        this.canBeRemoved = this.file.can_be_removed;
      }
    }
  }

  isTagAppendedToFile(tag: FileTag) {
    let isTagAppendedToFile: boolean = false;

    this.fileTags.forEach((fileTag) => {
      if (fileTag.id == tag.id) {
        isTagAppendedToFile = true;
      }
    });

    return isTagAppendedToFile ? true : false;
  }

  appendTagToFile(tag: FileTag) {
    this.fileTags.push(tag);
  }

  removeTagFromFile(tag: FileTag) {
    this.fileTags = this.fileTags.filter((fileTag) => {
      if (fileTag.id == tag.id) {
        return;
      } else {
        return fileTag;
      }
    });
  }

  toggleTag(tag: FileTag) {
    if (this.isTagAppendedToFile(tag)) {
      this.removeTagFromFile(tag);
    } else {
      this.appendTagToFile(tag);
    }
  }

  toggleCanBeRemoved(event: MatSlideToggleChange) {
    this.canBeRemoved = event.checked;
  }

  selectFile(event) {
    this.selectedFile = event.target.files[0];
  }

  getFileData(file: FileResource) {
    file.description = this.fileForm.controls["description"].value;
    file.can_be_removed = this.canBeRemoved;

    return file;
  }

  displayNotificationCard(message: string, requestStatus: string) {
    this.fileFormDisabled = false;

    this.notificationService.displayNotificationCard(
      this.dialogRef,
      message,
      requestStatus
    );
  }

  getTags() {
    this.tagService.getTags().subscribe((tags) => (this.tags = tags));
  }

  uploadFile() {
    this.fileFormDisabled = true;

    const file = this.getFileData({
      file: this.selectedFile,
      file_name: this.fileForm.controls["name"].value,
      description: "",
      tags: this.fileTags.map((fileTag) => fileTag.id),
      can_be_removed: true,
    });

    const fileFormData = new FormData();

    fileFormData.append("file", file.file, file.file.name);
    fileFormData.append("file_name", file.file_name);
    fileFormData.append("description", file.description);
    file.tags.forEach((tag: string) => {
      fileFormData.append("tags", tag);
    });

    this.fileService.uploadFile(fileFormData).subscribe(
      () => {
        this.displayNotificationCard("File has been created", "successful");
      },

      (res) => {
        const { detail } = res.error;

        this.displayNotificationCard(
          detail
            ? detail
            : "File has not been created. Check your internet connection and then try again",
          "unsuccessful"
        );
      }
    );
  }

  updateFile(fileId: string) {
    this.fileFormDisabled = true;

    const file = this.getFileData({
      name: this.fileForm.controls["name"].value,
      description: "",
      tags: this.fileTags.map((fileTag) => ({
        id: fileTag.id,
      })),
      can_be_removed: true,
    });

    this.fileService.updateFile(fileId, file).subscribe(
      () => {
        this.displayNotificationCard("File has been saved", "successful");
      },

      (res) => {
        const { detail } = res.error;

        this.displayNotificationCard(
          detail
            ? detail
            : "File has not been saved. Check your internet connection and then try again",
          "unsuccessful"
        );
      }
    );
  }

  deleteFile(fileId: string) {
    this.fileService.deleteFile(fileId).subscribe(
      () => {
        this.displayNotificationCard("File has been deleted", "successful");
      },

      (res) => {
        const { detail } = res.error;

        this.displayNotificationCard(
          detail
            ? detail
            : "File has not been deleted. Check your internet connection and then try again",
          "unsuccessful"
        );
      }
    );
  }

  ngOnInit(): void {}
}
