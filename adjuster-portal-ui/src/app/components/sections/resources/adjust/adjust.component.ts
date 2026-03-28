import { Component, OnInit } from "@angular/core";
import { Resource } from "src/app/models/resource.model";

@Component({
    selector: "app-adjust",
    templateUrl: "./adjust.component.html",
    styleUrls: ["./adjust.component.scss"],
    standalone: false
})
export class AdjustComponent implements OnInit {
  adjustResource: Resource = {
    name: "Adjust",
    description: "Get accurate property damage estimates.",
    items: [
      {
        path: "http://iscopesoftware.com/",
        pathType: "absolute",
        buttonLabel: "Adjust",
      },
    ],
  };

  constructor() {}

  ngOnInit(): void {}
}
