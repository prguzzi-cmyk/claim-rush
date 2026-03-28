import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ClaimService } from 'src/app/services/claim.service';
import { FileSizePipe } from 'src/app/filesize.pipe';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-shared-files',
    templateUrl: './shared-files.component.html',
    styleUrls: ['./shared-files.component.scss'],
    providers: [
        FileSizePipe,
        DatePipe
    ],
    standalone: false
})
export class SharedFilesComponent implements OnInit {

  file_share_id: string;
  zip_url: string;
  file_links: SharedFilesInfo | undefined;

  constructor(
    private route: ActivatedRoute,
    private claimService: ClaimService
  ) {
    if (this.route.snapshot.paramMap.get("id")) {
      this.file_share_id = this.route.snapshot.paramMap.get("id");
      this.zip_url = `${environment.server}/claims/files/share/${this.file_share_id}/download-all`
      this.loadSharedLinks();
    }
    else {
      this.file_share_id = null;
    }
  }

  loadSharedLinks() {
    this.claimService.getSharedLinks(this.file_share_id).subscribe({
      next: (file_links: SharedFilesInfo) => {
        this.file_links = file_links;
      },
      error: (error) => {
        console.error('Failed to load shared links:', error);
      }
    });
  }

  ngOnInit(): void {
  }

}

interface ClaimFile {
  name: string;
  url: string;
  size: number;
}

interface SharedFilesInfo {
  expiration_date: string;
  files: ClaimFile[];
}
