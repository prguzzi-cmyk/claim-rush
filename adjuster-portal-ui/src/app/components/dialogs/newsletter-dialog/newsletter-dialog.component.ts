import { DatePipe } from '@angular/common';
import { NewsletterService } from './../../../services/newsletter.service';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Newsletter } from 'src/app/models/newsletter.model';
import { NewsletterFile } from 'src/app/models/files-newsletter.model';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-newsletter-dialog',
    templateUrl: './newsletter-dialog.component.html',
    styleUrls: ['./newsletter-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class NewsletterDialogComponent implements OnInit {

  newsletter_id: string;

  newsletterFiles: MatTableDataSource<NewsletterFile>;

  selectedFile = {};

  filename: string | undefined;
  file: File | undefined;
  fileType: string | undefined;

  newsletterFormDisabled: boolean = false;
  type: string = 'add';
  newsletter: Newsletter;
  visible: boolean = false;

  newsletterForm = new FormGroup({
    title: new FormControl('', [
      Validators.required
    ]),
    content: new FormControl('', [
      Validators.required
    ]),
    publication_date: new FormControl('',[
      Validators.required
    ]),
    is_featured: new FormControl(false),
    can_be_removed: new FormControl(true),
  });

  displayedColumnsFiles: string[] = ['sn', 'name', 'size', 'download', 'delete'];
  displayedColumnsFilesOpen: string[] = ['sn', 'name', 'size', 'download'];

  constructor(
    private newsletterService: NewsletterService,
    private dialogRef: MatDialogRef<NewsletterDialogComponent>,
    private snackBar: MatSnackBar,
    public userService: UserService,
    private datepipe: DatePipe,
    private spinner: NgxSpinnerService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data) {
      this.type = data.type;

      if (this.type == 'open' || this.type == 'view' || this.type == 'delete' || this.type == 'edit') {
        this.newsletter = data.newsletter;
        this.newsletter_id = data.newsletter?.id;

        if (this.type == 'view' || this.type == 'open') {
          this.getNewsletterFiles();
        }

        if (this.type == 'edit') {
          this.newsletterForm.controls['title'].setValue(this.newsletter.title);
          this.newsletterForm.controls['content'].setValue(this.newsletter.content);
          this.newsletterForm.controls['publication_date'].setValue(this.newsletter.publication_date);
          this.newsletterForm.controls['is_featured'].setValue(this.newsletter.is_featured);
          this.newsletterForm.controls['can_be_removed'].setValue(this.newsletter.can_be_removed);
        }
      } else if (this.type == 'add') {

      }

    }

  }

  ngOnInit(): void {

  }

  getNewsletterFiles() {
    this.spinner.show();
    this.newsletterService.getNewsletterFiles(this.newsletter_id).subscribe((newslettersFiles) => {
      this.newsletterFiles = newslettersFiles;
      this.newsletterFiles = new MatTableDataSource(newslettersFiles?.items);
      this.spinner.hide();
    });
  }

  AddNewsletter() {
    this.spinner.show();

    this.newsletterFormDisabled = true;

    let newsletter = new Newsletter;
    newsletter.title = this.newsletterForm.controls['title'].value;
    newsletter.content = this.newsletterForm.controls['content'].value;
    newsletter.can_be_removed = this.newsletterForm.controls['can_be_removed'].value;
    newsletter.is_featured = this.newsletterForm.controls['is_featured'].value;

    if (this.newsletterForm.controls['publication_date']?.value) {
      newsletter.publication_date = this.datepipe.transform(this.newsletterForm.controls['publication_date']?.value, 'yyyy-MM-dd');
    }

    this.newsletterService.addNewsletter(newsletter)
      .subscribe((response) => {

        this.spinner.hide();
        this.newsletter = response;

        if (this.file) {
          let fileData = {
            file: this.file,
            file_name: this.file?.name,
            description: newsletter.title,
            can_be_removed: newsletter.can_be_removed
          }

          this.newsletterService.addNewsletterFile(this.newsletter?.id, fileData).subscribe();
        }

        this.newsletterFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Newsletter added', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  saveNewsletter() {
    this.newsletterFormDisabled = true;

    let newsletter = new Newsletter;
    newsletter.id = this.newsletter_id;
    newsletter.title = this.newsletterForm.controls['title'].value;
    newsletter.content = this.newsletterForm.controls['content'].value;
    newsletter.can_be_removed = this.newsletterForm.controls['can_be_removed'].value;
    newsletter.is_featured = this.newsletterForm.controls['is_featured'].value;
    newsletter.publication_date = this.datepipe.transform(this.newsletterForm.controls['publication_date']?.value, 'yyyy-MM-dd');

    this.newsletterService.updateNewsletter(newsletter)
      .subscribe((response) => {

        this.newsletter = response;

        if (this.file) {
          let fileData = {
            file: this.file,
            file_name: this.file?.name,
            description: newsletter.title,
            can_be_removed: newsletter.can_be_removed
          }

          this.newsletterService.addNewsletterFile(this.newsletter?.id, fileData).subscribe();
        }

        this.newsletterFormDisabled = false;
        this.dialogRef.close();

        this.snackBar.open('Newsletter added', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  deleteNewsletter(id: string) {
    this.spinner.show();
    this.newsletterService.deleteNewsletter(id).subscribe(
      (result: any) => {
        this.spinner.hide();
        this.dialogRef.close();
        this.snackBar.open('Newsletter has been deleted', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      }
    );
  }


  openFileDeleteDialog(file: NewsletterFile) {
    this.spinner.show();
    this.newsletterService.deleteNewsletterFile(file.id).subscribe(
      (result: any) => {
        this.getNewsletterFiles();
        this.spinner.hide();
        this.snackBar.open('File has been deleted', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      }
    );
  }

  editNewsletter() {
    this.type = 'edit';
    this.newsletterForm.controls['title'].setValue(this.newsletter.title);
    this.newsletterForm.controls['content'].setValue(this.newsletter.content);
    this.newsletterForm.controls['publication_date'].setValue(this.newsletter.publication_date);
    this.newsletterForm.controls['is_featured'].setValue(this.newsletter.is_featured);
    this.newsletterForm.controls['can_be_removed'].setValue(this.newsletter.can_be_removed);
  }

  selectFile(event) {
    this.file = event.target.files[0];
    this.filename = this.file?.name;
    this.fileType = this.file?.type;
  }

}
