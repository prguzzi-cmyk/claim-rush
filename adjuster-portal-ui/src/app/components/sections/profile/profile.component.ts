import { Component, OnInit } from '@angular/core';
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


  constructor(
    private userService: UserService,
    private dialogService: DialogService,
    private tabService: TabService,
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
}
