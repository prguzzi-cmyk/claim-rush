import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { VoiceOutreachAgentService, VoiceCall, VoiceAgentCampaign, CallOutcome } from '../voice-outreach-agent.service';

@Component({
  selector: 'app-ai-voice-call-engine',
  templateUrl: './ai-voice-call-engine.component.html',
  styleUrls: ['./ai-voice-call-engine.component.scss'],
  standalone: false,
})
export class AiVoiceCallEngineComponent implements OnInit, OnDestroy {
  calls: VoiceCall[] = [];
  campaigns: VoiceAgentCampaign[] = [];
  filteredCalls: VoiceCall[] = [];
  campaignFilter = 'all';
  outcomeFilter = 'all';
  searchTerm = '';
  private subs: Subscription[] = [];

  outcomeOptions: { value: CallOutcome | 'all'; label: string }[] = [
    { value: 'all', label: 'All Outcomes' },
    { value: 'qualified_lead', label: 'Qualified Lead' },
    { value: 'possible_claim', label: 'Possible Claim' },
    { value: 'call_back_later', label: 'Call Back Later' },
    { value: 'left_voicemail', label: 'Left Voicemail' },
    { value: 'not_interested', label: 'Not Interested' },
    { value: 'no_answer', label: 'No Answer' },
  ];

  constructor(
    private service: VoiceOutreachAgentService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.service.getCalls().subscribe(c => { this.calls = c; this.applyFilters(); }),
      this.service.getCampaigns().subscribe(c => this.campaigns = c),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  applyFilters(): void {
    let list = this.calls;
    if (this.campaignFilter !== 'all') list = list.filter(c => c.campaignId === this.campaignFilter);
    if (this.outcomeFilter !== 'all') list = list.filter(c => c.outcome === this.outcomeFilter);
    if (this.searchTerm.trim()) {
      const t = this.searchTerm.toLowerCase();
      list = list.filter(c => c.leadName.toLowerCase().includes(t) || c.propertyAddress.toLowerCase().includes(t));
    }
    this.filteredCalls = list;
  }

  openTimeline(call: VoiceCall): void {
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

  formatOutcome(outcome: string | null): string {
    if (!outcome) return 'Pending';
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

  getClaimIcon(type: string): string {
    const m: Record<string, string> = { fire: 'whatshot', water: 'water_drop', storm: 'thunderstorm', vandalism: 'broken_image' };
    return m[type] || 'help';
  }

  formatTime(ts: string): string {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
}
