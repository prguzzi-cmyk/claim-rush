import { Component, HostBinding } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { UpdateService } from "./services/update.service";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    standalone: false
})
export class AppComponent {
  title = "rin-portal";
  @HostBinding("class.in-application") inApplication: boolean = false;

  constructor(
    private router: Router,
    private updateNotificationService: UpdateService
  ) {
    // Subscribe to router URL
    router.events.subscribe((event) => {
      this.inApplication = router.url.startsWith('/app');
    });
  }
}
