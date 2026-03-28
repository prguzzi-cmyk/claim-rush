import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { VoiceOutreachAgentService, VoiceCall, CallOutcome } from '../voice-outreach-agent.service';

@Component({
  selector: 'app-call-result-classifier',
  templateUrl: './call-result-classifier.component.html',
  styleUrls: ['./call-result-classifier.component.scss'],
  standalone: false,
})
export class CallResultClassifierComponent implements OnInit, OnDestroy {
  calls: VoiceCall[] = [];
  private sub: Subscription;

  outcomes: { value: CallOutcome; label: string; icon: string; color: string }[] = [
    { value: 'no_answer', label: 'No Answer', icon: 'phone_missed', color: 'muted' },
    { value: 'left_voicemail', label: 'Left Voicemail', icon: 'voicemail', color: 'blue' },
    { value: 'not_interested', label: 'Not Interested', icon: 'thumb_down', color: 'red' },
    { value: 'call_back_later', label: 'Call Back Later', icon: 'schedule', color: 'yellow' },
    { value: 'possible_claim', label: 'Possible Claim', icon: 'help_outline', color: 'cyan' },
    { value: 'qualified_lead', label: 'Qualified Lead', icon: 'star', color: 'green' },
  ];

  constructor(
    private service: VoiceOutreachAgentService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.sub = this.service.getCalls().subscribe(c => this.calls = c);
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get classifiedCalls(): VoiceCall[] {
    return this.calls.filter(c => c.outcome !== null);
  }

  getOutcomeCount(outcome: CallOutcome): number {
    return this.calls.filter(c => c.outcome === outcome).length;
  }

  getOutcomePercentage(outcome: CallOutcome): number {
    const total = this.calls.length || 1;
    return Math.round((this.getOutcomeCount(outcome) / total) * 100);
  }

  reclassify(call: VoiceCall, newOutcome: CallOutcome): void {
    this.service.classifyCallOutcome(call.id, newOutcome);
    this.snackBar.open(`${call.leadName} reclassified as ${this.formatOutcome(newOutcome)}`, 'OK', { duration: 3000 });

    // Auto-route if qualified
    if (newOutcome === 'possible_claim' || newOutcome === 'qualified_lead') {
      if (!call.routedToSalesAgent) {
        this.service.routeToSalesAgent(call);
        this.snackBar.open(`${call.leadName} routed to AI Sales Agent pipeline`, 'OK', { duration: 3500 });
      }
    }
  }

  viewTimeline(call: VoiceCall): void {
    this.router.navigate(['/app/voice-outreach-agent/timeline', call.id]);
  }

  getOutcomeBadgeClass(outcome: string | null): string {
    if (!outcome) return 'badge-muted';
    const m: Record<string, string> = {
      qualified_lead: 'badge-green', possible_claim: 'badge-cyan', call_back_later: 'badge-yellow',
      left_voicemail: 'badge-blue', not_interested: 'badge-red', no_answer: 'badge-muted',
    };
    return m[outcome] || 'badge-muted';
  }

  formatOutcome(outcome: string): string {
    const m: Record<string, string> = {
      qualified_lead: 'Qualified Lead', possible_claim: 'Possible Claim', call_back_later: 'Call Back',
      left_voicemail: 'Voicemail', not_interested: 'Not Interested', no_answer: 'No Answer',
    };
    return m[outcome] || outcome;
  }

  formatDuration(seconds: number): string {
    if (seconds === 0) return '—';
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
