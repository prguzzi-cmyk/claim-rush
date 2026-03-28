import { Injectable } from '@angular/core';
import { SwUpdate, VersionEvent, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class UpdateService {
  constructor(private updates: SwUpdate, private snackBar: MatSnackBar) {
    if (updates.isEnabled) {
      this.updates.versionUpdates.subscribe((event: VersionEvent) => {
        if (event.type === 'VERSION_READY') {
          this.promptUser();
        }
      });
    } else {
      console.log('SwUpdate is not enabled.');  
    }
  }

  promptUser() {
    const snackBarRef = this.snackBar.open('A new version is available', 'Refresh');

    snackBarRef.onAction().subscribe(() => {
      this.updates.activateUpdate().then(() => document.location.reload());
    });
  }
}
