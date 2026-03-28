import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable()
export class VersionCheckService {
  private currentHash = "{{POST_BUILD_ENTERS_HASH_HERE}}";

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
  ) {}

  /**
   * Checks in every set frequency the version of frontend application
   * @param url
   * @param {number} frequency - in milliseconds
   */
  public initVersionCheck(url, frequency = 1000 * 300) {
    this.checkVersion(url);

    setInterval(() => {
      this.checkVersion(url);
    }, frequency);
  }

  /**
   * Will do the call and check if the hash has changed or not
   * @param url
   */
  private checkVersion(url) {
    // Timestamp these requests to invalidate caches
    this.http
      .get(url + "?t=" + new Date().getTime())
      .subscribe(
        (response: any) => {
          const hash = response.hash;
          const hashChanged = this.hasHashChanged(this.currentHash, hash);

          // If new version, do something
          if (hashChanged) {
            console.log('New version available, please reload. Current hash: '+this.currentHash+' | New hash: '+hash);
            let reloadSnackBar = this.snackBar.open('New version available. Please reload.', 'Reload', {
              horizontalPosition: 'center',
              verticalPosition: 'top',
            });

            reloadSnackBar.onAction().subscribe(()=> window.location.reload());
          }

          // store the new hash so we wouldn't trigger versionChange again
          // only necessary in case you did not force refresh
          this.currentHash = hash;
        },
        (err) => {
          console.error(err, "Could not get version");
        }
      );
  }

  /**
   * Checks if hash has changed.
   * This file has the JS hash, if it is a different one than in the version.json
   * we are dealing with version change
   * @param currentHash
   * @param newHash
   * @returns {boolean}
   */
  private hasHashChanged(currentHash, newHash) {
    if (!currentHash || currentHash === "{{POST_BUILD_ENTERS_HASH_HERE}}") {
      return false;
    }

    return currentHash !== newHash;
  }
}
