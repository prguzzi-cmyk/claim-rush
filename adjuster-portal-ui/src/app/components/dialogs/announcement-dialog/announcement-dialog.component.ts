import { DatePipe } from '@angular/common';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { Announcement } from 'src/app/models/announcement.model';
import { AnnouncementFile } from 'src/app/models/files-announcement.model';
import { AnnouncementService } from 'src/app/services/announcement.service';
import { NotificationService } from 'src/app/services/notification.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-announcement-dialog',
    templateUrl: './announcement-dialog.component.html',
    styleUrls: ['./announcement-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class AnnouncementDialogComponent implements OnInit {

  announcementFiles: MatTableDataSource<AnnouncementFile>;

  selectedFile = {};

  filename: string | undefined;
  file: File | undefined;
  fileType: string | undefined;

  announcement_id: string;
  announcementFormDisabled: boolean = false;
  announcement: Announcement;
  type: string = 'add';

  announcementForm = new FormGroup({
    title: new FormControl('', [
      Validators.required
    ]),
    content: new FormControl('', [
      Validators.required
    ]),
    announcement_date: new FormControl('', [
      Validators.required
    ]),
    expiration_date: new FormControl(''),
    can_be_removed: new FormControl(true),
  });

  displayedColumnsFiles: string[] = ['sn', 'name', 'size', 'download', 'delete'];
  displayedColumnsFilesOpen: string[] = ['sn', 'name', 'size', 'download'];

  constructor(
    private announcementService: AnnouncementService,
    private dialogRef: MatDialogRef<AnnouncementDialogComponent>,
    private snackBar: MatSnackBar,
    public userService: UserService,
    private datepipe: DatePipe,
    private notificationService: NotificationService,
    private spinner: NgxSpinnerService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data) {
      this.type = data.type;

      if (this.type == 'open' || this.type == 'view' || this.type == 'delete' || this.type == 'edit') {
        this.announcement = data.announcement;
        this.announcement_id = data.announcement?.id;

        if (this.type == 'view' || this.type == 'open') {
          this.getAnnouncementFiles();
          let activity = {
            "activity_type" : "seen",
            "details" : "seen"
          };
          this.announcementService.addAnnouncementActivity(this.announcement, activity);
        }

        if (this.type == 'edit') {
          this.announcementForm.controls['title'].setValue(this.announcement.title);
          this.announcementForm.controls['content'].setValue(this.announcement.content);
          this.announcementForm.controls['announcement_date'].setValue(this.announcement.announcement_date);
          this.announcementForm.controls['expiration_date'].setValue(this.announcement.expiration_date);
          this.announcementForm.controls['can_be_removed'].setValue(this.announcement.can_be_removed);
        }
      }

    }

  }

  ngOnInit(): void {

  }


  AddAnnouncement() {
    this.spinner.show();
    this.announcementFormDisabled = true;

    let announcement = new Announcement;
    announcement.title = this.announcementForm.controls['title'].value;
    announcement.content = this.announcementForm.controls['content'].value;
    announcement.can_be_removed = this.announcementForm.controls['can_be_removed'].value;

    if (this.announcementForm.controls['announcement_date']?.value) {
      announcement.announcement_date = this.datepipe.transform(this.announcementForm.controls['announcement_date']?.value, 'yyyy-MM-dd');
    }

    if (this.announcementForm.controls['expiration_date']?.value) {
      announcement.expiration_date = this.datepipe.transform(this.announcementForm.controls['expiration_date']?.value, 'yyyy-MM-dd');
    }

    this.announcementService.addAnnouncement(announcement)
      .subscribe((response) => {

        this.spinner.hide();
        this.announcement = response;

        if (this.file) {
          let fileData = {
            file: this.file,
            file_name: this.file?.name,
            description: announcement.title,
            can_be_removed: announcement.can_be_removed
          }

          this.announcementService.addAnnouncementFile(this.announcement?.id, fileData).subscribe();
        }

        this.announcementFormDisabled = false;
        this.notificationService.displayNotificationCard(this.dialogRef, 'Announcement added successfully', 'successful');
      });
  }

  saveAnnouncement() {
    this.announcementFormDisabled = true;

    let announcement = new Announcement;
    announcement.id = this.announcement_id;
    announcement.title = this.announcementForm.controls['title'].value;
    announcement.content = this.announcementForm.controls['content'].value;
    announcement.can_be_removed = this.announcementForm.controls['can_be_removed'].value;
    announcement.expiration_date = this.datepipe.transform(this.announcementForm.controls['expiration_date']?.value, 'yyyy-MM-dd');
    announcement.announcement_date = this.datepipe.transform(this.announcementForm.controls['announcement_date']?.value, 'yyyy-MM-dd');

    this.announcementService.updateAnnouncement(announcement)
      .subscribe((response) => {
        this.announcement = response;

        if (this.file) {
          let fileData = {
            file: this.file,
            file_name: this.file?.name,
            description: announcement.title,
            can_be_removed: announcement.can_be_removed
          }

          this.announcementService.addAnnouncementFile(this.announcement?.id, fileData).subscribe();
        }

        this.announcementFormDisabled = false;
        this.notificationService.displayNotificationCard(this.dialogRef, 'Announcement saved successfully', 'successful');
      });
  }

  deleteAnnouncement(id: string) {
    this.spinner.show();
    this.announcementService.deleteAnnouncement(id).subscribe(
      (result: any) => {
        this.spinner.hide();
        this.notificationService.displayNotificationCard(this.dialogRef, 'Announcement deleted successfully', 'successful');
      }
    );
  }

  getAnnouncementFiles() {
    this.spinner.show();
    this.announcementService.getAnnouncementFiles(this.announcement_id).subscribe((files) => {
      this.announcementFiles = files.items;
      this.announcementFiles = new MatTableDataSource(files?.items);
      this.spinner.hide();
    });
  }

  selectFile(event) {
    this.file = event.target.files[0];
    this.filename = this.file?.name;
    this.fileType = this.file?.type;
  }

  openFileDeleteDialog(file: AnnouncementFile) {
    this.spinner.show();
    this.announcementService.deleteAnnouncementFile(file.id).subscribe(
      (result: any) => {
        this.getAnnouncementFiles();
        this.spinner.hide();
        this.notificationService.displayNotificationCard(this.dialogRef, 'File deleted successfully', '');
      }
    );
  }

  editAnnouncement() {
    this.type = 'edit';
    this.announcementForm.controls['title'].setValue(this.announcement.title);
    this.announcementForm.controls['content'].setValue(this.announcement.content);
    this.announcementForm.controls['expiration_date'].setValue(this.announcement.expiration_date);
    this.announcementForm.controls['announcement_date'].setValue(this.announcement.announcement_date);
    this.announcementForm.controls['can_be_removed'].setValue(this.announcement.can_be_removed);
  }

}
