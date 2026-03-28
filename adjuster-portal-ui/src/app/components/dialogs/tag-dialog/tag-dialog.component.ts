import { Component, OnInit, Inject } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { TagService } from "src/app/services/tag.service";
import { NotificationService } from "src/app/services/notification.service";
import { Tag } from "src/app/models/tag.model";

@Component({
    selector: "app-tag-dialog",
    templateUrl: "./tag-dialog.component.html",
    styleUrls: ["./tag-dialog.component.scss"],
    standalone: false
})
export class TagDialogComponent implements OnInit {
  tag: Tag;

  canBeRemoved: boolean = true;

  type: string = "create";

  tagFormDisabled: boolean = false;

  tagForm = new FormGroup({
    name: new FormControl("", [Validators.required, Validators.maxLength(50)]),
    description: new FormControl(""),
  });

  constructor(
    private tagService: TagService,
    private notificationService: NotificationService,
    private dialogRef: MatDialogRef<TagDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.type = data.type;

      if (data.tag) {
        this.tag = data.tag;
      }

      if (this.type == "edit") {
        this.tagForm.controls["name"].setValue(this.tag.name);
        this.tagForm.controls["description"].setValue(this.tag.description);
        this.canBeRemoved = this.tag.can_be_removed;
      }
    }
  }

  toggleCanBeRemoved(event: MatSlideToggleChange) {
    this.canBeRemoved = event.checked;
  }

  getTagData(tag: Tag) {
    tag.name = this.tagForm.controls["name"].value;
    tag.description = this.tagForm.controls["description"].value;
    tag.can_be_removed = this.canBeRemoved;

    return tag;
  }

  displayNotificationCard(message: string, requestStatus: string) {
    this.tagFormDisabled = false;

    this.notificationService.displayNotificationCard(
      this.dialogRef,
      message,
      requestStatus
    );
  }

  createTag() {
    this.tagFormDisabled = true;

    let tag = new Tag();

    this.tagService.createTag(this.getTagData(tag)).subscribe(
      () => {
        this.displayNotificationCard("Tag has been created", "successful");
      },

      (res) => {
        const { detail } = res.error;

        this.displayNotificationCard(
          detail
            ? detail
            : "Tag has not been created. Check your internet connection and then try again",
          "unsuccessful"
        );
      }
    );
  }

  updateTag(tagId: string) {
    this.tagFormDisabled = true;

    let tag = new Tag();

    this.tagService.updateTag(tagId, this.getTagData(tag)).subscribe(
      () => {
        this.displayNotificationCard("Tag has been saved", "successful");
      },

      (res) => {
        const { detail } = res.error;

        this.displayNotificationCard(
          detail
            ? detail
            : "Tag has not been saved. Check your internet connection and then try again",
          "unsuccessful"
        );
      }
    );
  }

  deleteTag(tagId: string) {
    this.tagService.deleteTag(tagId).subscribe(
      () => {
        this.displayNotificationCard("Tag has been deleted", "successful");
      },

      (res) => {
        const { detail } = res.error;

        this.displayNotificationCard(
          detail
            ? detail
            : "Tag has not been deleted. Check your internet connection and then try again",
          "unsuccessful"
        );
      }
    );
  }

  restoreTag(tagId: string) {
    this.tagService.restoreTag(tagId).subscribe(
      () => {
        this.displayNotificationCard("Tag has been restored", "successful");
      },

      (res) => {
        const { detail } = res.error;

        this.displayNotificationCard(
          detail
            ? detail
            : "Tag has not been restored. Check your internet connection and then try again",
          "unsuccessful"
        );
      }
    );
  }

  ngOnInit(): void {}
}
