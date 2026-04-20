import { Component, OnInit } from "@angular/core";

// TODO: Restore real My Recruits UI when the MLM service is rebuilt on the
// Railway FastAPI backend. The original component injected MlmHierarchyService
// (mlm/v1/my-recruits/:id, mlm/v1/team-hierarchy/:id) and TitleChangeService
// (mlm/v1/title/non-team-members) — all of those endpoints live at
// api.mlm.upaportal.org, which is offline as of 2026-04-20. Until MLM is
// ported, this route renders a "Coming soon" placeholder so the iframe stays
// clean instead of hanging on a 15 s connect timeout.

@Component({
  selector: "app-my-recruits",
  templateUrl: "./my-recruits.component.html",
  styleUrls: ["./my-recruits.component.scss"],
  standalone: false,
})
export class MyRecruitsComponent implements OnInit {
  constructor() {}
  ngOnInit(): void {}
}
