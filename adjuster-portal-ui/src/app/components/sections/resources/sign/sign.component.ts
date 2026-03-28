import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Resource } from "src/app/models/resource.model";

@Component({
    selector: "app-sign",
    templateUrl: "./sign.component.html",
    styleUrls: ["./sign.component.scss"],
    standalone: false
})
export class SignComponent implements OnInit {
  signResource: Resource = {
    name: "Agreements",
    description: "Create, send, and manage digital agreements.",
    items: [
      {
        path: "/app/agreements",
        pathType: "relative",
        buttonLabel: "Open Agreements",
      },
    ],
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Redirect to new agreement dashboard
    this.router.navigate(['/app/agreements']);
  }
}
