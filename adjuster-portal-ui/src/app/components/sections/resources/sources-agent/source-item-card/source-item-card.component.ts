import { Component, OnInit, Input } from "@angular/core";

@Component({
    selector: "app-source-item-card",
    templateUrl: "./source-item-card.component.html",
    styleUrls: ["./source-item-card.component.scss"],
    standalone: false
})
export class SourceItemCardComponent implements OnInit {
  @Input() sourceItem;

  constructor() {}

  ngOnInit(): void {}
}
