import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { AiSalesAgentService, Appointment, AiConversation, MeetingPlatform, MeetingStatus } from '../ai-sales-agent.service';

@Component({
  selector: 'app-appointment-scheduling',
  templateUrl: './appointment-scheduling.component.html',
  styleUrls: ['./appointment-scheduling.component.scss'],
  standalone: false,
})
export class AppointmentSchedulingComponent implements OnInit, OnDestroy {
  appointments: Appointment[] = [];
  conversations: AiConversation[] = [];
  preselectedConversationId: string | null = null;
  showBookingForm = false;
  private subs: Subscription[] = [];

  adjusters = ['Sarah Mitchell', 'James Carter', 'Maria Santos', 'David Kim', 'Emily Parker'];
  timeSlots: string[] = [];
  platforms: { value: MeetingPlatform; label: string; icon: string }[] = [
    { value: 'teams', label: 'Microsoft Teams', icon: 'groups' },
    { value: 'zoom', label: 'Zoom', icon: 'videocam' },
  ];

  form = {
    conversationId: '',
    adjuster: '',
    date: '',
    time: '',
    platform: 'teams' as MeetingPlatform,
    notes: '',
  };

  constructor(
    private service: AiSalesAgentService,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.buildTimeSlots();
    this.preselectedConversationId = this.route.snapshot.queryParamMap.get('conversationId');
    if (this.preselectedConversationId) {
      this.form.conversationId = this.preselectedConversationId;
      this.showBookingForm = true;
    }

    this.subs.push(
      this.service.getAppointments().subscribe(a => this.appointments = a),
      this.service.getConversations().subscribe(c => this.conversations = c),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  private buildTimeSlots(): void {
    for (let h = 8; h <= 17; h++) {
      for (const m of ['00', '30']) {
        if (h === 17 && m === '30') continue;
        const suffix = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : h;
        this.timeSlots.push(`${displayHour}:${m} ${suffix}`);
      }
    }
  }

  bookAppointment(): void {
    const f = this.form;
    if (!f.conversationId || !f.adjuster || !f.date || !f.time) {
      this.snackBar.open('Please fill all required fields', 'OK', { duration: 3000 });
      return;
    }
    const convo = this.conversations.find(c => c.id === f.conversationId);
    if (!convo) return;

    const appt: Appointment = {
      id: 'APT-' + String(this.appointments.length + 1).padStart(3, '0'),
      conversationId: f.conversationId,
      homeownerName: convo.homeownerName,
      adjusterName: f.adjuster,
      date: f.date,
      time: f.time,
      platform: f.platform,
      status: 'scheduled',
      claimType: convo.claimType,
      propertyAddress: `${convo.propertyAddress}, ${convo.city} ${convo.state}`,
      notes: f.notes,
    };
    this.service.addAppointment(appt);
    this.service.updateConversationStatus(convo.id, 'appointment_set');
    this.showBookingForm = false;
    this.form = { conversationId: '', adjuster: '', date: '', time: '', platform: 'teams', notes: '' };
    this.snackBar.open(`Appointment booked for ${convo.homeownerName}`, 'OK', { duration: 3500 });
  }

  cancelAppointment(appt: Appointment): void {
    this.service.updateAppointmentStatus(appt.id, 'cancelled');
    this.snackBar.open(`Appointment cancelled for ${appt.homeownerName}`, 'OK', { duration: 3000 });
  }

  getStatusBadgeClass(status: string): string {
    const m: Record<string, string> = { scheduled: 'badge-cyan', in_progress: 'badge-orange', completed: 'badge-green', cancelled: 'badge-red' };
    return m[status] || 'badge-muted';
  }

  formatStatus(status: string): string {
    const m: Record<string, string> = { scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' };
    return m[status] || status;
  }

  formatPlatform(p: string): string {
    return p === 'teams' ? 'Teams' : 'Zoom';
  }

  get upcomingAppointments(): Appointment[] {
    return this.appointments.filter(a => a.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
  }

  get pastAppointments(): Appointment[] {
    return this.appointments.filter(a => a.status !== 'scheduled');
  }
}
