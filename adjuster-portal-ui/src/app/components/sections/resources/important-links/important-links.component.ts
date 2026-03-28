import { Component, OnInit } from "@angular/core";
import { Resource } from "src/app/models/resource.model";

@Component({
    selector: "app-important-links",
    templateUrl: "./important-links.component.html",
    styleUrls: ["./important-links.component.scss"],
    standalone: false
})
export class ImportantLinksComponent implements OnInit {
  importantLinksresource: Resource = {
    name: "Important Links",
    items: [
      {
        path: "https://resprousa.com/",
        pathType: "absolute",
        buttonLabel: "Resprousa",
      },

      {
        path: "https://acilegal.net/webmail/",
        pathType: "absolute",
        buttonLabel: "Email",
      },
    ],
  };

  constructor() {}

  ngOnInit(): void {}
}
