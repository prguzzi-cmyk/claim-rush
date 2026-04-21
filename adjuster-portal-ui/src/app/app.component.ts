import { Component, HostBinding } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { UpdateService } from "./services/update.service";
import { environment } from "src/environments/environment";

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
    // Dev-auto-login routing happens in DevAutoLoginGuard on "/" and "/login" so the
    // landing page never renders. A router-events subscription here would fire for every
    // navigation and has repeatedly caused a visible landing-flash → portal flicker.

    // Track whether we're inside the authenticated shell, for the host class binding.
    router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.inApplication = event.urlAfterRedirects.startsWith('/app');
      }
    });
  }
}
