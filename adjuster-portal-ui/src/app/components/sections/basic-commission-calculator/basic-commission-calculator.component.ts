import { Component, OnInit } from "@angular/core";

// TODO: Restore real commission calculator once two issues are resolved:
//   1. ClaimRush rinRoute mismatch — claim-rush/src/App.jsx passes
//      `/app/basic-commission-calculator`, but the RIN router expects
//      `/app/claims/basic-commission-calculator`. Align one side before
//      re-enabling the iframe.
//   2. Verify MLM dependency. The calculator itself has no direct MLM service
//      calls today, but the "Simulator" variant in ../commission-simulator/*
//      and the upstream commission pages do hit api.mlm.upaportal.org, which
//      is offline as of 2026-04-20. Confirm this component can run fully
//      against the Railway FastAPI backend before turning it back on.

@Component({
  selector: "app-basic-commission-calculator",
  templateUrl: "./basic-commission-calculator.component.html",
  styleUrls: ["./basic-commission-calculator.component.scss"],
  standalone: false,
})
export class BasicCommissionCalculatorComponent implements OnInit {
  constructor() {}
  ngOnInit(): void {}
}
