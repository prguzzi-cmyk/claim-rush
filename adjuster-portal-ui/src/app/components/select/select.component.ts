import { Component, OnInit, Input, Output, EventEmitter } from "@angular/core";

@Component({
    selector: "app-select",
    templateUrl: "./select.component.html",
    styleUrls: ["./select.component.scss"],
    standalone: false
})
export class SelectComponent implements OnInit {
  @Input() select: { name: string; displayName: string };
  @Input() options: { name: string; displayName: string }[];
  @Input() value: string;

  @Output() valueChange = new EventEmitter();

  constructor() {}

  onValueChange(selectName: string, selectValue: string) {
    this.valueChange.emit({
      selectName,
      selectValue,
    });
  }

  ngOnInit(): void {}
}
