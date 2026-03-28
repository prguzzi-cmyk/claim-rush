import { Component, OnInit } from "@angular/core";
import { Resource } from "src/app/models/resource.model";
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: "app-learn",
    templateUrl: "./learn.component.html",
    styleUrls: ["./learn.component.scss"],
    standalone: false
})
export class LearnComponent implements OnInit {
  learnResource: Resource = {
    name: "Learn",
    description: "Equip yourself with skills from the adjuster university.",
    items: [
      {
        path: "https://adjusteruniversity.online/",
        pathType: "absolute",
        buttonLabel: "Learn",
      },
    ],
  };

  constructor(
    private tabService: TabService,
  ) {}

  ngOnInit(): void {}

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }
}
