import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { VoiceOutreachAgentService, VoiceCall } from '../voice-outreach-agent.service';

interface RoutingEvent {
  callId: string;
  leadName: string;
  outcome: string;
  aiScore: number | null;
  salesConversationId: string | null;
  routedAt: string;
  claimType: string;
  propertyAddress: string;
}

@Component({
  selector: 'app-auto-lead-routing',
  templateUrl: './auto-lead-routing.component.html',
  styleUrls: ['./auto-lead-routing.component.scss'],
  standalone: false,
})
export class AutoLeadRoutingComponent implements OnInit, OnDestroy {
  calls: VoiceCall[] = [];
  routedCalls: VoiceCall[] = [];
  pendingCalls: VoiceCall[] = [];
  routingEvents: RoutingEvent[] = [];
  private sub: Subscription;

  constructor(
    private service: VoiceOutreachAgentService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.sub = this.service.getCalls().subscribe(calls => {
      this.calls = calls;
      this.routedCalls = calls.filter(c => c.routedToSalesAgent);
      this.pendingCalls = calls.filter(c =>
        (c.outcome === 'possible_claim' || c.outcome === 'qualified_lead') && !c.routedToSalesAgent
      );
      this.buildRoutingEvents();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private buildRoutingEvents(): void {
    this.routingEvents = this.routedCalls.map(c => ({
      callId: c.id,
      leadName: c.leadName,
      outcome: c.outcome!,
      aiScore: c.aiQualificationScore,
      salesConversationId: c.salesAgentConversationId,
      routedAt: c.completedAt || c.calledAt,
      claimType: c.claimType,
      propertyAddress: `${c.propertyAddress}, ${c.city} ${c.state}`,
    }));
  }

  routeNow(call: VoiceCall): void {
    const convoId = this.service.routeToSalesAgent(call);
    if (convoId) {
      this.snackBar.open(`${call.leadName} routed to AI Sales Agent (${convoId})`, 'OK', { duration: 3500 });
    }
  }

  openSalesConversation(convoId: string): void {
    this.router.navigate(['/app/ai-sales-agent/conversation', convoId]);
  }

  openCallTimeline(callId: string): void {
    this.router.navigate(['/app/voice-outreach-agent/timeline', callId]);
  }

  getOutcomeBadgeClass(outcome: string): string {
    return outcome === 'qualified_lead' ? 'badge-green' : 'badge-cyan';
  }

  formatOutcome(outcome: string): string {
    return outcome === 'qualified_lead' ? 'Qualified Lead' : 'Possible Claim';
  }

  getClaimIcon(type: string): string {
    const m: Record<string, string> = { fire: 'whatshot', water: 'water_drop', storm: 'thunderstorm', vandalism: 'broken_image' };
    return m[type] || 'help';
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  get totalRouted(): number { return this.routedCalls.length; }
  get qualifiedCount(): number { return this.routedCalls.filter(c => c.outcome === 'qualified_lead').length; }
  get possibleCount(): number { return this.routedCalls.filter(c => c.outcome === 'possible_claim').length; }
  get avgScore(): number {
    const scores = this.routedCalls.filter(c => c.aiQualificationScore !== null).map(c => c.aiQualificationScore!);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }
}
