import { Component, ElementRef, ViewChild } from "@angular/core";
import { AriaGuideService } from "src/app/services/aria-guide.service";
import { Message } from "src/app/models/message.model";

@Component({
  selector: "app-aria-guide-widget",
  templateUrl: "./aria-guide-widget.component.html",
  styleUrls: ["./aria-guide-widget.component.scss"],
  standalone: false,
})
export class AriaGuideWidgetComponent {
  @ViewChild("messageContainer") messageContainer: ElementRef;
  @ViewChild("chatInput") chatInput: ElementRef;

  isOpen = false;
  isLoading = false;
  userInput = "";
  messages: Message[] = [];

  quickActions = [
    { label: "Lead-to-Settlement workflow", prompt: "Walk me through the complete lead-to-settlement workflow in the portal." },
    { label: "How does RIN work?", prompt: "How does the Response Intelligence Network (RIN) work and what fire dispatch call types does it monitor?" },
    { label: "Using AI Sales Agent", prompt: "How do I use the AI Sales Agent to qualify leads and book appointments?" },
    { label: "Policy Vault analysis", prompt: "How do I upload and analyze an insurance policy in the Policy Vault?" },
  ];

  constructor(private ariaGuideService: AriaGuideService) {}

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      setTimeout(() => this.chatInput?.nativeElement?.focus(), 100);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendQuickAction(prompt: string): void {
    this.userInput = prompt;
    this.sendMessage();
  }

  sendMessage(): void {
    const content = this.userInput.trim();
    if (!content || this.isLoading) return;

    const userMessage: Message = { role: "user", content };
    this.messages.push(userMessage);
    this.userInput = "";
    this.isLoading = true;
    this.scrollToBottom();

    this.ariaGuideService.sendMessage(this.messages).subscribe({
      next: (message) => {
        message.content = message.content
          .replace(/(?:\r\n|\r|\n)/g, "<br>")
          .replace(/```(\w*)\n?/g, "<pre>")
          .replace(/```/g, "</pre>")
          .replace(/`([^`]+)`/g, "<code>$1</code>");
        this.messages.push(message);
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: () => {
        this.messages.push({
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        });
        this.isLoading = false;
        this.scrollToBottom();
      },
    });
  }

  clearChat(): void {
    this.messages = [];
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messageContainer) {
        this.messageContainer.nativeElement.scrollTop =
          this.messageContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }
}
