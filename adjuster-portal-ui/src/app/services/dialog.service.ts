import { Injectable } from "@angular/core";
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { PasswordChangeDialogComponent } from "../components/dialogs/password-change-dialog/password-change-dialog.component";

@Injectable({
  providedIn: "root",
})
export class DialogService {
  dialogConfig: MatDialogConfig;

  constructor(private dialog: MatDialog) {
    this.dialogConfig = new MatDialogConfig();
    this.dialogConfig.disableClose = true;
    this.dialogConfig.autoFocus = true;
  }

  openDialog(componentName, data?: object, config?: object) {
    const dialogCfg: MatDialogConfig = {
      ...this.dialogConfig,
      ...(config || {}),
    };
    if (data) dialogCfg.data = data;

    const dialogRef = this.dialog.open(componentName, dialogCfg);

    return dialogRef.afterClosed();
  }

  openExportDialog(data?: object) {
    if (data) this.dialogConfig.data = data;
  }
}
