import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AiSalesAgentService, AiConversation, ConversationMessage, LeadStatus } from '../ai-sales-agent.service';

@Component({
  selector: 'app-ai-conversation-engine',
  templateUrl: './ai-conversation-engine.component.html',
  styleUrls: ['./ai-conversation-engine.component.scss'],
  standalone: false,
})
export class AiConversationEngineComponent implements OnInit {
  conversation: AiConversation | null = null;
  newMessage = '';
  qualifyingInProgress = false;

  statusOptions: { value: LeadStatus; label: string }[] = [
    { value: 'new_lead', label: 'New Lead' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'appointment_set', label: 'Appointment Set' },
    { value: 'client_signed', label: 'Client Signed' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: AiSalesAgentService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.conversation = this.service.getConversationById(id) || null;
    }
    if (!this.conversation) {
      this.router.navigate(['/app/ai-sales-agent']);
    }
  }

  goBack(): void {
    this.router.navigate(['/app/ai-sales-agent']);
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.conversation) return;
    const msg: ConversationMessage = {
      id: 'msg-' + Date.now(),
      sender: 'agent',
      content: this.newMessage.trim(),
      timestamp: new Date().toISOString(),
    };
    this.conversation.messages.push(msg);
    this.conversation.lastActivityAt = msg.timestamp;
    this.newMessage = '';
  }

  updateStatus(status: LeadStatus): void {
    if (!this.conversation) return;
    this.service.updateConversationStatus(this.conversation.id, status);
    this.conversation.status = status;
    this.snackBar.open(`Status updated to ${this.formatStatus(status)}`, 'OK', { duration: 3000 });
  }

  runAiQualification(): void {
    if (!this.conversation || this.qualifyingInProgress) return;
    this.qualifyingInProgress = true;
    setTimeout(() => {
      const score = Math.floor(Math.random() * 31) + 70;
      this.conversation!.qualificationScore = score;
      this.conversation!.claimProbabilityScore = Math.floor(score * (0.85 + Math.random() * 0.15));
      if (this.conversation!.status === 'new_lead' || this.conversation!.status === 'contacted') {
        this.conversation!.status = 'qualified';
        this.service.updateConversationStatus(this.conversation!.id, 'qualified');
      }
      this.qualifyingInProgress = false;
      // Add AI message
      this.conversation!.messages.push({
        id: 'msg-' + Date.now(),
        sender: 'ai',
        content: `Qualification complete. Lead score: ${score}/100. Claim probability: ${this.conversation!.claimProbabilityScore}%. This lead is ${score >= 80 ? 'highly qualified' : 'moderately qualified'} for outreach.`,
        timestamp: new Date().toISOString(),
      });
      this.snackBar.open(`AI Score: ${score} — ${this.conversation!.homeownerName} qualified`, 'OK', { duration: 3500 });
    }, 2000);
  }

  navigateToAppointment(): void {
    if (!this.conversation) return;
    this.router.navigate(['/app/ai-sales-agent/appointments'], { queryParams: { conversationId: this.conversation.id } });
  }

  navigateToIntake(): void {
    if (!this.conversation) return;
    this.router.navigate(['/app/ai-sales-agent/intake-launcher'], { queryParams: { conversationId: this.conversation.id } });
  }

  getStatusBadgeClass(status: string): string {
    const m: Record<string, string> = {
      new_lead: 'badge-cyan', contacted: 'badge-blue', qualified: 'badge-green',
      appointment_set: 'badge-orange', client_signed: 'badge-purple',
    };
    return m[status] || 'badge-muted';
  }

  formatStatus(status: string): string {
    const m: Record<string, string> = {
      new_lead: 'New Lead', contacted: 'Contacted', qualified: 'Qualified',
      appointment_set: 'Appt Set', client_signed: 'Signed',
    };
    return m[status] || status;
  }

  getClaimIcon(type: string): string {
    const m: Record<string, string> = { fire: 'whatshot', water: 'water_drop', storm: 'thunderstorm', vandalism: 'broken_image' };
    return m[type] || 'help';
  }

  getSenderIcon(sender: string): string {
    const m: Record<string, string> = { ai: 'smart_toy', homeowner: 'person', agent: 'support_agent' };
    return m[sender] || 'chat';
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  timeAgo(ts: string): string {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }
}
