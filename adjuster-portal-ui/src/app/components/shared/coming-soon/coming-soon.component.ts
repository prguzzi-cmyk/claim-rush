import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * Generic "Coming Soon" / "Beta" landing for ecosystem sidebar items
 * whose downstream UI is unfinished or mis-wired. Keeps the sidebar
 * entry visible and intentional rather than navigating to a broken or
 * incorrect component during a live demo.
 *
 * Usage (sidebar template):
 *   <a routerLink="/app/coming-soon" [queryParams]="{ name: 'UPASign' }">
 *
 * Optional query params:
 *   ?name=<label>          — page title (e.g. "UPASign")
 *   ?status=<beta|soon|activation>  — pill text override (default: "COMING SOON")
 *   ?note=<extra text>     — sub-line under the title
 */
@Component({
  selector: "app-coming-soon",
  templateUrl: "./coming-soon.component.html",
  styleUrls: ["./coming-soon.component.scss"],
  standalone: false,
})
export class ComingSoonComponent {
  name$: Observable<string>;
  status$: Observable<string>;
  note$: Observable<string | null>;

  constructor(private route: ActivatedRoute) {
    this.name$ = this.route.queryParamMap.pipe(
      map((p) => p.get("name") || "This module")
    );
    this.status$ = this.route.queryParamMap.pipe(
      map((p) => {
        const s = (p.get("status") || "soon").toLowerCase();
        if (s === "beta") return "BETA";
        if (s === "activation") return "ACTIVATION REQUIRED";
        return "COMING SOON";
      })
    );
    this.note$ = this.route.queryParamMap.pipe(
      map((p) => p.get("note"))
    );
  }
}
