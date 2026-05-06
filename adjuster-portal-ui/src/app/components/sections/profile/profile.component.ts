import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { User } from 'src/app/models/user.model';
import { UserService } from 'src/app/services/user.service';
import { DialogService } from 'src/app/services/dialog.service';
import { PasswordChangeDialogComponent } from '../../dialogs/password-change-dialog/password-change-dialog.component';
import { TabService } from 'src/app/services/tab.service';
import { UserDetailsDialogComponent } from '../../dialogs/user-details-dialog/user-details-dialog.component';
import {UserPersonalFile} from "../../../models/files-user.model";
import { MyPersonalDocsDialogComponent } from '../../dialogs/user-personal-file-dialog/my-personal-docs-dialog.component';
import { ViewDocumentDialogComponent } from '../../dialogs/view-document-dialog/view-document-dialog.component';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss'],
    standalone: false
})
export class ProfileComponent implements OnInit {
  user: User;
  userPersonalFiles: UserPersonalFile[];
  displayedColumnsFiles: string[] = ['sn', 'name', 'state', 'expiration_date' , 'size', 'download', 'delete'];

  // ───── Profile photo upload (dev-friendly base64 path) ─────
  // The selected image is held in `pendingPhotoDataUrl` until the user
  // clicks Save Photo. The preview source falls back to the persisted
  // photo so the circle still shows the current avatar after save.
  pendingPhotoDataUrl: string | null = null;
  savingPhoto = false;

  constructor(
    private userService: UserService,
    private dialogService: DialogService,
    private tabService: TabService,
    private snack: MatSnackBar,
  ) { }

  ngOnInit() {

    this.getUser();
    this.getPersonalFiles();


  }

  getUser() {
    this.userService.currentUser.subscribe((user) => {
      this.user = user;
    });
  }

  private getPersonalFiles() {
    this.userService.getPersonalFiles().subscribe(
        response => {
          this.userPersonalFiles = response?.items;
        }
    )
  }

  addUserPersonalFile(user: User) {
    this.dialogService
        .openDialog(MyPersonalDocsDialogComponent, {
          type: 'add',
        }).subscribe(() => {
      this.getUser();
      this.getPersonalFiles();
    });
  }

  previewFile(file: UserPersonalFile) {
    this.dialogService.openDialog(ViewDocumentDialogComponent, { type: file.type, file: file.path })
        .subscribe(() => console.log("View file callback called..."));
  }

  openFileDeleteDialog(file: UserPersonalFile) {
    this.userService.deletePersonalFiles(file.id).subscribe(
        (result: any) => {
          this.getPersonalFiles();
        }
    );
  }


  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  openPasswordChangeDialog() {
    this.dialogService.openDialog(PasswordChangeDialogComponent);
  }

  openUserEditDialog() {
    this.dialogService
      .openDialog(UserDetailsDialogComponent, { type: "edit", user: this.user, profile: true })
      .subscribe(() => this.getUser());
  }

  // ───── Profile photo handlers ─────

  /** Image source for the circular preview. Pending selection wins; falls
   *  back to the persisted photo so the avatar always renders. */
  get photoPreviewSrc(): string | null {
    return this.pendingPhotoDataUrl || this.user?.profile_image_url || null;
  }

  /** Initials shown in the empty-state badge when no photo has been
   *  uploaded yet. Stays in sync with first/last name. */
  get photoInitials(): string {
    const first = (this.user?.first_name || '').trim();
    const last = (this.user?.last_name || '').trim();
    const i = (first[0] || '') + (last[0] || '');
    return (i || (this.user?.email || '?').slice(0, 2)).toUpperCase();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.snack.open('Please choose an image file.', 'Dismiss', { duration: 2500 });
      return;
    }
    // 5 MB cap to keep dev base64 payloads sane on Postgres.
    if (file.size > 5 * 1024 * 1024) {
      this.snack.open('Image is too large (max 5 MB).', 'Dismiss', { duration: 3000 });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.pendingPhotoDataUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
    // Allow re-selecting the same file later.
    input.value = '';
  }

  savePhoto(): void {
    if (!this.pendingPhotoDataUrl || this.savingPhoto) return;
    this.savingPhoto = true;
    this.userService.updateProfileImage(this.pendingPhotoDataUrl).subscribe({
      next: (updated) => {
        this.user = updated;
        this.pendingPhotoDataUrl = null;
        this.savingPhoto = false;
        this.snack.open('Profile photo updated', 'OK', { duration: 2500 });
      },
      error: () => {
        this.savingPhoto = false;
        this.snack.open('Could not save photo. Please try again.', 'Dismiss', { duration: 3000 });
      },
    });
  }

  clearPendingPhoto(): void {
    this.pendingPhotoDataUrl = null;
  }
}
