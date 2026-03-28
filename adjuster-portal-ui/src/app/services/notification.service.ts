import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";

@Injectable({
  providedIn: "root",
})
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}

  displayNotificationCard(dialogRef, message: string, requestStatus: string) {
    if (requestStatus == "successful") {
      dialogRef.close();
    }

    this.snackBar.open(message, "Close", {
      duration: 5000,
      horizontalPosition: "end",
      verticalPosition: "bottom",
    });
  }


  error(message: string) {

    this.snackBar.open(message, "Close", {
      duration: 10000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: ['snackbar-error'],
    });
  }
}
