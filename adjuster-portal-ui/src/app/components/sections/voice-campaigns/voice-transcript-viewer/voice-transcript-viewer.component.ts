import { Component, OnInit, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { VoiceCampaignService } from 'src/app/services/voice-campaign.service';
import { DurationFormatPipe } from 'src/app/shared/pipes/duration-format.pipe';
import {
  VoiceCallLog,
  VoiceCallLogDetail,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
} from 'src/app/models/voice-campaign.model';

@Component({
  selector: 'app-voice-transcript-viewer',
  templateUrl: './voice-transcript-viewer.component.html',
  styleUrls: ['./voice-transcript-viewer.component.scss'],
  standalone: false,
})
export class VoiceTranscriptViewerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Mode: 'list' or 'detail'
  mode: 'list' | 'detail' = 'list';

  // List mode
  callLogs: VoiceCallLog[] = [];
  loadingList = true;
  listError = false;
  listColumns = ['lead_name', 'phone_number', 'duration', 'outcome', 'created_at', 'actions'];
  listDataSource = new MatTableDataSource<VoiceCallLog>();
  searchTerm = '';
  outcomeFilter = '';
  outcomeOptions = Object.entries(OUTCOME_LABELS).map(([value, label]) => ({ value, label }));

  @ViewChild(MatPaginator) paginator: MatPaginator;

  // Detail mode
  callId: string | null = null;
  callDetail: VoiceCallLogDetail | null = null;
  loadingDetail = true;
  detailError = false;
  transcriptLines: Array<{ speaker: string; text: string }> = [];

  // Navigation between transcripts
  transcriptIds: string[] = [];
  currentIndex = -1;

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.mode !== 'detail' || this.loadingDetail || this.transcriptIds.length <= 1) return;
    if (event.key === 'ArrowLeft' && this.hasPrevious) {
      event.preventDefault();
      this.goToPrevious();
    } else if (event.key === 'ArrowRight' && this.hasNext) {
      event.preventDefault();
      this.goToNext();
    }
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private campaignService: VoiceCampaignService,
    private snackBar: MatSnackBar,
    private durationPipe: DurationFormatPipe,
  ) {}

  ngOnInit(): void {
    this.callId = this.route.snapshot.paramMap.get('callId');
    if (this.callId) {
      this.mode = 'detail';
      this.loadTranscript(this.callId);
      this.loadTranscriptIds();
    } else {
      this.mode = 'list';
      this.loadTranscriptList();
    }
  }

  // ── List Mode ──

  loadTranscriptList(): void {
    this.loadingList = true;
    this.listError = false;
    this.listDataSource.filterPredicate = (data: VoiceCallLog, _filter: string) => {
      const search = this.searchTerm.trim().toLowerCase();
      const searchMatch = !search
        || (data.lead_name || '').toLowerCase().includes(search)
        || (data.phone_number || '').includes(search)
        || (data.transcript_summary || '').toLowerCase().includes(search);
      const outcomeMatch = !this.outcomeFilter || data.outcome === this.outcomeFilter;
      return searchMatch && outcomeMatch;
    };
    this.campaignService.getCallLogs().pipe(takeUntil(this.destroy$)).subscribe({
      next: (logs) => {
        this.callLogs = logs.filter(l => l.status === 'completed');
        this.listDataSource.data = this.callLogs;
        setTimeout(() => {
          this.listDataSource.paginator = this.paginator;
        });
        this.loadingList = false;
      },
      error: () => {
        this.snackBar.open('Failed to load transcripts', 'Retry', { duration: 5000 })
          .onAction().subscribe(() => this.loadTranscriptList());
        this.loadingList = false;
        this.listError = true;
      },
    });
  }

  onSearch(): void {
    this.listDataSource.filter = `${this.searchTerm}|${this.outcomeFilter}`;
    if (this.paginator) this.paginator.firstPage();
  }

  onOutcomeFilterChange(): void {
    this.listDataSource.filter = `${this.searchTerm}|${this.outcomeFilter}`;
    if (this.paginator) this.paginator.firstPage();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearch();
  }

  openTranscript(log: VoiceCallLog): void {
    this.router.navigate(['/app/outreach/transcripts', log.id]);
  }

  // ── Detail Mode ──

  loadTranscript(callId: string): void {
    this.loadingDetail = true;
    this.detailError = false;
    this.campaignService.getTranscript(callId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (detail) => {
        this.callDetail = detail;
        this.parseTranscript(detail.transcript_text || '');
        this.loadingDetail = false;
      },
      error: () => {
        this.snackBar.open('Failed to load transcript', 'Retry', { duration: 5000 })
          .onAction().subscribe(() => this.loadTranscript(callId));
        this.loadingDetail = false;
        this.detailError = true;
      },
    });
  }

  private parseTranscript(text: string): void {
    if (!text) {
      this.transcriptLines = [];
      return;
    }
    const lines = text.split('\n').filter(l => l.trim());
    this.transcriptLines = lines.map(line => {
      const match = line.match(/^(AI|Agent|Lead|Customer|User):\s*(.*)/i);
      if (match) {
        return { speaker: match[1], text: match[2] };
      }
      return { speaker: 'AI', text: line };
    });
  }

  isAISpeaker(speaker: string): boolean {
    return speaker.toLowerCase() === 'ai' || speaker.toLowerCase() === 'agent';
  }

  copyTranscript(): void {
    const text = this.transcriptLines.map(l => `${l.speaker}: ${l.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Transcript copied to clipboard', 'OK', { duration: 2000 });
    });
  }

  downloadTranscript(): void {
    const header = [
      `Lead: ${this.callDetail?.lead_name || 'Unknown'}`,
      `Phone: ${this.callDetail?.phone_number || ''}`,
      `Date: ${this.callDetail?.created_at ? new Date(this.callDetail.created_at).toLocaleString() : ''}`,
      `Duration: ${this.durationPipe.transform(this.callDetail?.duration_seconds || 0)}`,
      `Outcome: ${this.getOutcomeLabel(this.callDetail?.outcome || '')}`,
      '',
      '--- Transcript ---',
      '',
    ].join('\n');
    const body = this.transcriptLines.map(l => `${l.speaker}: ${l.text}`).join('\n');
    const blob = new Blob([header + body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${this.callDetail?.lead_name || 'call'}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Shared Helpers ──

  getOutcomeLabel(outcome: string): string {
    return OUTCOME_LABELS[outcome] || outcome || '—';
  }

  getOutcomeColor(outcome: string): string {
    return OUTCOME_COLORS[outcome] || '#9e9e9e';
  }

  private loadTranscriptIds(): void {
    this.campaignService.getCallLogs().pipe(takeUntil(this.destroy$)).subscribe(logs => {
      this.transcriptIds = logs.filter(l => l.status === 'completed').map(l => l.id);
      this.currentIndex = this.transcriptIds.indexOf(this.callId!);
    });
  }

  get hasPrevious(): boolean {
    return this.currentIndex > 0;
  }

  get hasNext(): boolean {
    return this.currentIndex >= 0 && this.currentIndex < this.transcriptIds.length - 1;
  }

  goToPrevious(): void {
    if (!this.hasPrevious || !this.transcriptIds.length) return;
    const prevId = this.transcriptIds[this.currentIndex - 1];
    if (prevId) this.navigateToTranscript(prevId);
  }

  goToNext(): void {
    if (!this.hasNext || !this.transcriptIds.length) return;
    const nextId = this.transcriptIds[this.currentIndex + 1];
    if (nextId) this.navigateToTranscript(nextId);
  }

  private navigateToTranscript(id: string): void {
    if (!id) return;
    this.callId = id;
    this.currentIndex = this.transcriptIds.indexOf(id);
    this.loadTranscript(id);
  }

  goBack(): void {
    if (this.mode === 'detail') {
      this.router.navigate(['/app/outreach/transcripts']);
    } else {
      this.router.navigate(['/app/outreach/call-logs']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
