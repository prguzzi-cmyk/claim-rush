import { Component, OnInit, Input } from "@angular/core";
import { Resource } from "src/app/models/resource.model";

@Component({
    selector: "app-resource",
    templateUrl: "./resource.component.html",
    styleUrls: ["./resource.component.scss"],
    standalone: false
})
export class ResourceComponent implements OnInit {
  @Input() resource: Resource;

  // @Input() resource: Resource = {
  //   name: "",
  //   description: "",
  //   items: [
  //     {
  //       path: "",
  //       pathType: "",
  //       buttonLabel: "",
  //     },
  //   ],
  // };

  constructor() {}

  ngOnInit(): void {}
}
