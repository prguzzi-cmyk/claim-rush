import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import * as FileSaver from 'file-saver';


@Component({
    selector: 'app-view-document-dialog',
    templateUrl: './view-document-dialog.component.html',
    styleUrls: ['./view-document-dialog.component.scss'],
    standalone: false
})
export class ViewDocumentDialogComponent implements OnInit {

  showFile : any;
  fileUrl : any;
  viewer : any = 'url';
  fileType : any;

  sanitizedUrl: SafeUrl | null = null;

  emailContent: string | null = null;
  isLoading: boolean = true;
  isError: boolean = false;
  emailParts: any[] = [];
  attachments: any[] = [];


  constructor(
    private dialogRef: MatDialogRef<ViewDocumentDialogComponent>,
    private snackBar: MatSnackBar,
    private sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

      this.showFile = data.file;
      this.fileUrl = data.file;
      this.fileType = data.type;

      this.sanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.fileUrl);


      if (this.isEml()) {
        this.fetchAndParseEml(this.fileUrl);
      }

  }

  ngOnInit(): void {

    this.dialogRef.keydownEvents().subscribe(event => {
      if (event.key === "Escape") {
        this.dialogRef.close();
      }
    });



  }

  async fetchAndParseEml(url: string) {
    try {
      const response = await fetch(url);
      const emlText = await response.text();
      const { parts, attachments } = this.parseEml(emlText);
      this.emailParts = parts;
      this.attachments = attachments;
      this.isLoading = false;
    } catch (error) {
      this.isError = true;
      this.isLoading = false;
      console.error('Error parsing EML file:', error);
    }
  }

  parseEml(emlText: string): any {
    const parts = [];
    const attachments = [];
    const boundary = this.getBoundary(emlText);
    if (boundary) {
      const sections = emlText.split(boundary);
      sections.forEach(section => {
        const headers = this.parseHeaders(section);
        const content = section.split('\r\n\r\n')[1];
        if (headers && content) {
          if (headers['content-disposition'] && headers['content-disposition'].includes('attachment')) {
            attachments.push({ headers, content: this.base64Decode(content) });
          } else {
            parts.push({ headers, content });
          }
        }
      });
    }
    return { parts, attachments };
  }

  getBoundary(emlText: string): string | null {
    const boundaryMatch = emlText.match(/boundary="(.+?)"/);
    return boundaryMatch ? boundaryMatch[1] : null;
  }

  parseHeaders(section: string): any {
    const headers = {};
    const headerLines = section.split('\r\n\r\n')[0].split('\r\n');
    headerLines.forEach(line => {
      const [key, value] = line.split(': ');
      if (key && value) {
        headers[key.toLowerCase()] = value;
      }
    });
    return headers;
  }

  base64Decode(base64String: string): string {
    try {
      return atob(base64String.replace(/\r\n/g, ''));
    } catch (error) {
      console.error('Error decoding base64:', error);
      return '';
    }
  }

  downloadAttachment(attachment: any): void {
    const blob = new Blob([attachment.content], { type: attachment.headers['content-type'] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.headers['content-disposition'].split('filename=')[1].replace(/"/g, '');
    a.click();
    URL.revokeObjectURL(url);
  }


  onClose(): void {
    this.dialogRef.close();
  }



  isImage(): boolean {
    return this.fileType?.startsWith('image/') ?? false;
  }

  isPdf(): boolean {
    return this.fileType === 'application/pdf';
  }

  isOfficeFile(): boolean {
    // console.log(this.fileType);
    const officeFileTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint'
    ];
    return officeFileTypes.includes(this.fileType ?? '');
  }

  isEml(): boolean {
    return this.fileType === 'message/rfc822';
  }

  getGoogleDriveViewerUrl(): SafeUrl | null {
    if (this.fileUrl) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(this.fileUrl)}`
      );
    }
    return null;
  }

  downloadFile(): void {
    if (this.fileUrl) {
      FileSaver.saveAs(this.fileUrl);
    }
  }

}
