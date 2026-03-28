import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { AiSalesAgentService, AiConversation, Appointment, MeetingPlatform } from '../ai-sales-agent.service';

interface IntakeMeeting {
  conversationId: string;
  homeownerName: string;
  platform: MeetingPlatform;
  status: 'ready' | 'in_progress' | 'completed';
  launchedAt: string | null;
  claimType: string;
  propertyAddress: string;
}

@Component({
  selector: 'app-intake-launcher',
  templateUrl: './intake-launcher.component.html',
  styleUrls: ['./intake-launcher.component.scss'],
  standalone: false,
})
export class IntakeLauncherComponent implements OnInit, OnDestroy {
  conversations: AiConversation[] = [];
  appointments: Appointment[] = [];
  intakeMeetings: IntakeMeeting[] = [];
  selectedConversationId: string | null = null;
  selectedPlatform: MeetingPlatform = 'teams';
  private subs: Subscription[] = [];

  constructor(
    private service: AiSalesAgentService,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.selectedConversationId = this.route.snapshot.queryParamMap.get('conversationId');

    this.subs.push(
      this.service.getConversations().subscribe(c => this.conversations = c),
      this.service.getAppointments().subscribe(a => {
        this.appointments = a;
        this.buildIntakeMeetings();
      }),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  private buildIntakeMeetings(): void {
    this.intakeMeetings = this.appointments
      .filter(a => a.status === 'scheduled')
      .map(a => ({
        conversationId: a.conversationId,
        homeownerName: a.homeownerName,
        platform: a.platform,
        status: 'ready' as const,
        launchedAt: null,
        claimType: a.claimType,
        propertyAddress: a.propertyAddress,
      }));
  }

  getSelectedConversation(): AiConversation | undefined {
    return this.conversations.find(c => c.id === this.selectedConversationId);
  }

  launchMeeting(meeting: IntakeMeeting): void {
    meeting.status = 'in_progress';
    meeting.launchedAt = new Date().toISOString();
    this.snackBar.open(`${meeting.platform === 'teams' ? 'Teams' : 'Zoom'} meeting launched for ${meeting.homeownerName}`, 'OK', { duration: 3500 });
  }

  launchQuickMeeting(): void {
    const convo = this.getSelectedConversation();
    if (!convo) {
      this.snackBar.open('Select a conversation first', 'OK', { duration: 3000 });
      return;
    }
    const meeting: IntakeMeeting = {
      conversationId: convo.id,
      homeownerName: convo.homeownerName,
      platform: this.selectedPlatform,
      status: 'in_progress',
      launchedAt: new Date().toISOString(),
      claimType: convo.claimType,
      propertyAddress: `${convo.propertyAddress}, ${convo.city} ${convo.state}`,
    };
    this.intakeMeetings.unshift(meeting);
    this.snackBar.open(`Quick ${this.selectedPlatform === 'teams' ? 'Teams' : 'Zoom'} meeting launched for ${convo.homeownerName}`, 'OK', { duration: 3500 });
  }

  completeMeeting(meeting: IntakeMeeting): void {
    meeting.status = 'completed';
    this.snackBar.open(`Meeting completed for ${meeting.homeownerName}`, 'OK', { duration: 3000 });
  }

  getStatusClass(status: string): string {
    const m: Record<string, string> = { ready: 'badge-cyan', in_progress: 'badge-orange', completed: 'badge-green' };
    return m[status] || 'badge-muted';
  }

  formatStatus(status: string): string {
    const m: Record<string, string> = { ready: 'Ready', in_progress: 'In Progress', completed: 'Completed' };
    return m[status] || status;
  }

  getClaimIcon(type: string): string {
    const m: Record<string, string> = { fire: 'whatshot', water: 'water_drop', storm: 'thunderstorm', vandalism: 'broken_image' };
    return m[type] || 'help';
  }
}
