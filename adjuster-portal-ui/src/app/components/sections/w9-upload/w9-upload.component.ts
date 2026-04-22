import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  AdminMembersDataService,
  MemberStatusViewDTO,
} from 'src/app/services/admin-members-data.service';
import { UserService } from 'src/app/services/user.service';

const DEV_USER_ID = 'dev_user';
const DEV_ALIAS_UUID = 'a88fe7c8-1982-5856-aa70-5efe96ece7c7';
function resolveUserId(uid: string): string {
  return uid === DEV_USER_ID ? DEV_ALIAS_UUID : uid;
}

/**
 * Member-facing W-9 upload page at /app/profile/w9.
 *
 * Posts a PDF to /v1/admin/members/{user_id}/w9 which stores the file,
 * wires it into agent_profile.w9_file_id, and (when the user is in
 * pending_w9 state) flips them to active. The R3 banner disappears
 * automatically on the next status query.
 */
@Component({
  selector: 'app-w9-upload',
  templateUrl: './w9-upload.component.html',
  styleUrls: ['./w9-upload.component.scss'],
  standalone: false,
})
export class W9UploadComponent implements OnInit {
  status: MemberStatusViewDTO | null = null;
  loading = true;
  uploading = false;
  errorText: string | null = null;
  selectedFile: File | null = null;

  constructor(
    private readonly userService: UserService,
    private readonly adminMembers: AdminMembersDataService,
    private readonly router: Router,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.userService.currentUser.subscribe(user => {
      if (!user || !(user as any).id) {
        this.loading = false;
        return;
      }
      const uid = resolveUserId(String((user as any).id));
      this.adminMembers.getMemberStatus$(uid).subscribe({
        next: s => { this.status = s; this.loading = false; },
        error: err => {
          this.loading = false;
          this.errorText = err?.error?.detail || err?.message || String(err);
        },
      });
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) { this.selectedFile = null; return; }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.errorText = 'Please select a PDF file.';
      this.selectedFile = null;
      return;
    }
    this.errorText = null;
    this.selectedFile = file;
  }

  submit(): void {
    if (!this.status || !this.selectedFile) return;
    this.uploading = true;
    this.errorText = null;
    this.adminMembers.uploadW9$(this.status.user_id, this.selectedFile).subscribe({
      next: result => {
        this.uploading = false;
        this.snack.open(
          `W-9 uploaded — your status is now ${result.status.toUpperCase()}.`,
          'Dismiss',
          { duration: 5000 },
        );
        if (this.status) this.status = { ...this.status, status: result.status, w9_uploaded: true };
      },
      error: err => {
        this.uploading = false;
        this.errorText = err?.error?.detail || err?.message || String(err);
      },
    });
  }
}
