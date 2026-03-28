import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from "@angular/core";
import { Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AiIntakeService } from "src/app/services/ai-intake.service";
import { IntakeChatResponse, IntakeSession } from "src/app/models/intake-session.model";
import { LeadNotificationService } from "src/app/shared/services/lead-notification.service";

interface ChatMessage {
  role: "ai" | "user";
  text: string;
  timestamp: Date;
}

@Component({
  selector: "app-ai-intake-chat",
  templateUrl: "./ai-intake-chat.component.html",
  styleUrls: ["./ai-intake-chat.component.scss"],
  standalone: false,
})
export class AiIntakeChatComponent implements OnInit, AfterViewChecked {
  @ViewChild("chatContainer") chatContainer: ElementRef;

  messages: ChatMessage[] = [];
  userInput = "";
  sessionId: string | null = null;
  isLoading = false;
  isComplete = false;
  isQualified: boolean | null = null;
  collectedData: Record<string, string | null> = {};
  leadId: string | null = null;
  currentStep = "";

  // Conversation list
  sessions: IntakeSession[] = [];
  activeSession: IntakeSession | null = null;

  constructor(
    private intakeService: AiIntakeService,
    private router: Router,
    private snackBar: MatSnackBar,
    private leadNotifications: LeadNotificationService,
  ) {}

  ngOnInit(): void {
    // Load sessions — auto-start chat if no existing conversations
    this.loadSessions();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  // ── Session List ──

  loadSessions(): void {
    this.intakeService.getSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
      },
      error: () => {
        this.sessions = [];
      },
    });
  }

  getSessionStatus(s: IntakeSession): string {
    if (s.status === 'completed' && s.is_qualified) return 'Qualified';
    if (s.status === 'completed') return 'Reviewed';
    if (s.current_step === 'appointment') return 'Booked';
    if (s.current_step && s.current_step !== 'greeting') return 'Engaged';
    return 'New';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Qualified': return 'status-qualified';
      case 'Booked': return 'status-booked';
      case 'Engaged': return 'status-engaged';
      case 'Reviewed': return 'status-reviewed';
      default: return 'status-new';
    }
  }

  getLastMessage(s: IntakeSession): string {
    if (!s.conversation_log) return 'No messages yet';
    try {
      const log = JSON.parse(s.conversation_log);
      if (Array.isArray(log) && log.length > 0) {
        const last = log[log.length - 1];
        const text = last.text || '';
        return text.length > 60 ? text.substring(0, 60) + '...' : text;
      }
    } catch {}
    return 'Conversation started';
  }

  getAssignmentForSession(s: IntakeSession): { agent: string; reason: string; auto: boolean } | null {
    if (!s.lead_id) return null;
    const notifs = this.leadNotifications.getNotifications();
    let match: any = null;
    notifs.subscribe(list => {
      match = list.find(n => n.leadId === s.lead_id && n.autoAssigned);
    }).unsubscribe();
    if (match) {
      return { agent: match.assignedAgent || '', reason: match.assignedReason || '', auto: true };
    }
    return null;
  }

  // ── Open Session ──

  openSession(session: IntakeSession): void {
    this.activeSession = session;
    this.sessionId = session.id;
    this.isComplete = session.status === "completed";
    this.isQualified = session.is_qualified;
    this.currentStep = session.current_step;

    this.messages = [];
    if (session.conversation_log) {
      try {
        const log = JSON.parse(session.conversation_log);
        for (const entry of log) {
          this.messages.push({
            role: entry.role === "ai" ? "ai" : "user",
            text: entry.text,
            timestamp: new Date(entry.ts),
          });
        }
      } catch {}
    }
  }

  // ── New Conversation ──

  private lastSentDraft = '';

  startNewConversation(): void {
    // Single-attempt guard — no retries, no re-entry while loading
    if (this.isLoading) return;

    this.messages = [];
    this.sessionId = null;
    this.activeSession = null;
    this.isComplete = false;
    this.isQualified = null;
    this.collectedData = {};
    this.leadId = null;
    this.currentStep = "";
    this.isLoading = true;

    this.intakeService.chat({ session_id: null, message: "" }).subscribe({
      next: (res: IntakeChatResponse) => {
        this.sessionId = res.session_id;
        this.currentStep = res.current_step;
        this.messages.push({ role: "ai", text: res.ai_message, timestamp: new Date() });
        this.isLoading = false;
        this.loadSessions();
      },
      error: () => {
        // Single attempt failed — show the greeting locally so the UI
        // is never blank.  No retry, no banner, no toast.
        this.isLoading = false;
        this.messages.push({
          role: "ai",
          text: "Hi, I\u2019m your ACI Claim Assistant. I\u2019m having a little trouble connecting right now \u2014 please click \u201cNew Conversation\u201d to try again.",
          timestamp: new Date(),
        });
      },
    });
  }

  // ── Send Message ──

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading || this.isComplete) return;

    // Session validation — if no session, tell user to start one
    if (!this.sessionId) {
      this.messages.push({
        role: "ai",
        text: "Please start a new conversation first.",
        timestamp: new Date(),
      });
      return;
    }

    this.messages.push({ role: "user", text, timestamp: new Date() });
    this.lastSentDraft = text;
    this.userInput = "";
    this.isLoading = true;

    this.intakeService.chat({ session_id: this.sessionId, message: text }).subscribe({
      next: (res: IntakeChatResponse) => {
        // If backend recovered the session (fallback=true), silently
        // adopt the new session_id — no extra UI noise.
        this.sessionId = res.session_id;
        this.currentStep = res.current_step;
        this.isComplete = res.is_complete;
        this.isQualified = res.is_qualified;
        this.collectedData = res.collected_data;
        this.leadId = res.lead_id;
        this.lastSentDraft = '';
        this.messages.push({ role: "ai", text: res.ai_message, timestamp: new Date() });
        this.isLoading = false;

        // Trigger high-priority notifications + auto-assignment on completion
        if (res.is_complete && res.lead_id) {
          const name = res.collected_data?.['homeowner_name'] || 'Unknown';
          const addr = res.collected_data?.['property_address'] || '';
          const aiMsg = (res.ai_message || '').toLowerCase();

          if (aiMsg.includes('appointment') || aiMsg.includes('inspection') || aiMsg.includes('consultation')) {
            this.leadNotifications.notify({
              leadId: res.lead_id, sessionId: this.sessionId || undefined,
              status: 'BOOKED', leadName: name, address: addr, source: 'ai-intake',
            });
          } else if (res.is_qualified) {
            this.leadNotifications.notify({
              leadId: res.lead_id, sessionId: this.sessionId || undefined,
              status: 'QUALIFIED', leadName: name, address: addr, source: 'ai-intake',
            });
          } else {
            this.leadNotifications.notify({
              leadId: res.lead_id, sessionId: this.sessionId || undefined,
              status: 'CALL_BACK_REQUESTED', leadName: name, address: addr, source: 'ai-intake',
            });
          }
        }

        if (res.is_complete) this.loadSessions();
      },
      error: (err: any) => {
        console.error('[AiIntake] sendMessage failed:', err?.status, err?.error?.detail || err?.message || err);
        this.isLoading = false;
        // Restore draft so user can resend
        this.userInput = this.lastSentDraft;
        // Remove the user message that failed
        if (this.messages.length > 0 && this.messages[this.messages.length - 1].role === 'user') {
          this.messages.pop();
        }
        this.messages.push({ role: "ai", text: "That didn't go through — your message is still in the input. Please try sending again.", timestamp: new Date() });
      },
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /** Send a predefined quick reply (used by appointment buttons). */
  quickReply(text: string): void {
    this.userInput = text;
    this.sendMessage();
  }

  // ── Actions ──

  markQualified(): void {
    this.snackBar.open('Marked as qualified', 'OK', { duration: 2000 });
  }

  bookAppointment(): void {
    this.snackBar.open('Appointment booking initiated', 'OK', { duration: 2000 });
  }

  assignToAdjuster(): void {
    this.snackBar.open('Assigned to adjuster queue', 'OK', { duration: 2000 });
  }

  markNotInterested(): void {
    this.snackBar.open('Marked as not interested', 'OK', { duration: 2000 });
  }

  // ── Utils ──

  getStepLabel(step: string): string {
    const labels: Record<string, string> = {
      greeting: "Welcome", name: "Name", address: "Property Address",
      contact: "Contact Info", incident: "Incident Details", date_of_loss: "Date of Loss",
      insurance: "Insurance", policy: "Policy Number", qualification: "Qualification",
      appointment: "Appointment", complete: "Complete",
    };
    return labels[step] || step || 'Idle';
  }

  getProgressPercent(): number {
    const steps = ["greeting", "name", "address", "contact", "incident", "date_of_loss", "insurance", "policy", "qualification", "appointment", "complete"];
    const idx = steps.indexOf(this.currentStep);
    return idx >= 0 ? Math.round(((idx + 1) / steps.length) * 100) : 0;
  }

  private scrollToBottom(): void {
    if (this.chatContainer) {
      const el = this.chatContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
