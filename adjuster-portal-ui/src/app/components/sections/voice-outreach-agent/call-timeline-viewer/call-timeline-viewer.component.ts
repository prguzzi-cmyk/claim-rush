import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VoiceOutreachAgentService, VoiceCall, CallOutcome, TranscriptEntry, AiDecisionMarker } from '../voice-outreach-agent.service';

interface TimelineItem {
  type: 'transcript' | 'marker';
  timestamp: string;
  entry?: TranscriptEntry;
  marker?: AiDecisionMarker;
}

@Component({
  selector: 'app-call-timeline-viewer',
  templateUrl: './call-timeline-viewer.component.html',
  styleUrls: ['./call-timeline-viewer.component.scss'],
  standalone: false,
})
export class CallTimelineViewerComponent implements OnInit {
  call: VoiceCall | null = null;
  timeline: TimelineItem[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: VoiceOutreachAgentService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.call = this.service.getCallById(id) || null;
    if (!this.call) { this.router.navigate(['/app/voice-outreach-agent']); return; }
    this.buildTimeline();
  }

  goBack(): void { this.router.navigate(['/app/voice-outreach-agent/calls']); }

  private buildTimeline(): void {
    if (!this.call) return;
    const items: TimelineItem[] = [];

    this.call.transcript.forEach(t => items.push({ type: 'transcript', timestamp: t.timestamp, entry: t }));
    this.call.aiDecisionMarkers.forEach(m => items.push({ type: 'marker', timestamp: m.timestamp, marker: m }));

    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    this.timeline = items;
  }

  routeToSalesAgent(): void {
    if (!this.call) return;
    const convoId = this.service.routeToSalesAgent(this.call);
    if (convoId) {
      this.snackBar.open(`${this.call.leadName} routed to AI Sales Agent`, 'OK', { duration: 3500 });
    }
  }

  openSalesConversation(): void {
    if (this.call?.salesAgentConversationId) {
      this.router.navigate(['/app/ai-sales-agent/conversation', this.call.salesAgentConversationId]);
    }
  }

  getOutcomeBadgeClass(outcome: string | null): string {
    if (!outcome) return 'badge-muted';
    const m: Record<string, string> = {
      qualified_lead: 'badge-green', possible_claim: 'badge-cyan', call_back_later: 'badge-yellow',
      left_voicemail: 'badge-blue', not_interested: 'badge-red', no_answer: 'badge-muted',
    };
    return m[outcome] || 'badge-muted';
  }

  formatOutcome(outcome: string | null): string {
    if (!outcome) return 'Pending';
    const m: Record<string, string> = {
      qualified_lead: 'Qualified Lead', possible_claim: 'Possible Claim', call_back_later: 'Call Back',
      left_voicemail: 'Voicemail', not_interested: 'Not Interested', no_answer: 'No Answer',
    };
    return m[outcome] || outcome;
  }

  getClaimIcon(type: string): string {
    const m: Record<string, string> = { fire: 'whatshot', water: 'water_drop', storm: 'thunderstorm', vandalism: 'broken_image' };
    return m[type] || 'help';
  }

  getSentimentClass(sentiment: string | null): string {
    if (!sentiment) return '';
    return 'sentiment-' + sentiment;
  }

  getSentimentIcon(sentiment: string | null): string {
    if (!sentiment) return '';
    const m: Record<string, string> = { positive: 'sentiment_satisfied', neutral: 'sentiment_neutral', negative: 'sentiment_dissatisfied' };
    return m[sentiment] || '';
  }

  getMarkerIcon(type: string): string {
    const m: Record<string, string> = {
      intent_detected: 'psychology', qualification_trigger: 'verified', objection_handled: 'shield',
      escalation_point: 'send', scoring_update: 'trending_up',
    };
    return m[type] || 'info';
  }

  getMarkerClass(type: string): string {
    const m: Record<string, string> = {
      intent_detected: 'marker-cyan', qualification_trigger: 'marker-green', objection_handled: 'marker-yellow',
      escalation_point: 'marker-purple', scoring_update: 'marker-orange',
    };
    return m[type] || 'marker-muted';
  }

  formatDuration(seconds: number): string {
    if (seconds === 0) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  formatShortTime(ts: string): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }
}
