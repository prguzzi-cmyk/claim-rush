import { Component, OnInit } from "@angular/core";
import { environment } from "src/environments/environment";

// TODO: Re-enable ChatGPT features once OpenAI calls are proxied through the
// backend. Do not reintroduce a client-side OpenAI API key. Until then, the UI
// entry point is gated behind environment.featureFlags.chatgptEnabled and
// renders a "Coming soon" placeholder.

@Component({
  selector: "app-assistant",
  templateUrl: "./assistant.component.html",
  styleUrls: ["./assistant.component.scss"],
  standalone: false,
})
export class AssistantComponent implements OnInit {
  chatgptEnabled: boolean = environment.featureFlags?.chatgptEnabled === true;

  constructor() {}

  ngOnInit(): void {}
}
