import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { InspectionScheduleEngineService } from 'src/app/shared/services/inspection-schedule-engine.service';
import {
  Inspection, AppointmentStatus, APPOINTMENT_STATUS_META,
  AdjusterAvailability, CalendarDay, CalendarView, TimeSlot,
} from 'src/app/shared/models/inspection-schedule.model';

type ViewMode = 'calendar' | 'create' | 'availability';

@Component({
  selector: 'app-inspection-calendar',
  templateUrl: './inspection-calendar.component.html',
  styleUrls: ['./inspection-calendar.component.scss'],
  standalone: false,
})
export class InspectionCalendarComponent implements OnInit {

  view: ViewMode = 'calendar';
  calendarView: CalendarView = 'week';
  loading = true;

  inspections: Inspection[] = [];
  calendarDays: CalendarDay[] = [];
  currentDate: string;
  statusFilter: AppointmentStatus | '' = '';

  // Create form
  formDate = '';
  formTime = '';
  formAddress = '';
  formHomeowner = '';
  formPhone = '';
  formAdjuster = '';
  formAdjusterId = '';
  formNotes = '';
  formConflict: Inspection | null = null;
  availableSlots: TimeSlot[] = [];

  // Availability
  availability: AdjusterAvailability | null = null;
  availDays = [1, 2, 3, 4, 5];
  availStart = 8;
  availEnd = 17;
  blockDate = '';
  blockStart = '';
  blockEnd = '';
  blockReason = '';

  dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  hours = Array.from({ length: 10 }, (_, i) => i + 8);

  constructor(
    private engine: InspectionScheduleEngineService,
    private snackBar: MatSnackBar,
  ) {
    this.currentDate = new Date().toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.loadInspections();
  }

  // ── Data Loading ──

  loadInspections(): void {
    this.loading = true;
    this.engine.getInspections().subscribe({
      next: (data) => {
        this.inspections = data.length > 0 ? data : this.getMockInspections();
        this.buildCalendar();
        this.loading = false;
      },
      error: () => {
        this.inspections = this.getMockInspections();
        this.buildCalendar();
        this.loading = false;
      },
    });
  }

  buildCalendar(): void {
    let filtered = [...this.inspections];
    if (this.statusFilter) filtered = filtered.filter(i => i.status === this.statusFilter);

    if (this.calendarView === 'day') {
      this.calendarDays = this.engine.buildCalendarDays(this.currentDate, 1, filtered);
    } else if (this.calendarView === 'week') {
      const weekStart = this.engine.getWeekStart(this.currentDate);
      this.calendarDays = this.engine.buildCalendarDays(weekStart, 7, filtered);
    } else {
      const monthStart = this.engine.getMonthStart(this.currentDate);
      const days = this.engine.getDaysInMonth(this.currentDate);
      this.calendarDays = this.engine.buildCalendarDays(monthStart, days, filtered);
    }
  }

  // ── Navigation ──

  navigateDate(delta: number): void {
    const d = new Date(this.currentDate + 'T00:00:00');
    if (this.calendarView === 'day') d.setDate(d.getDate() + delta);
    else if (this.calendarView === 'week') d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    this.currentDate = d.toISOString().split('T')[0];
    this.buildCalendar();
  }

  goToToday(): void {
    this.currentDate = new Date().toISOString().split('T')[0];
    this.buildCalendar();
  }

  setCalendarView(v: CalendarView): void {
    this.calendarView = v;
    this.buildCalendar();
  }

  // ── Create Appointment ──

  openCreate(date?: string, time?: string): void {
    this.formDate = date || this.currentDate;
    this.formTime = time || '09:00';
    this.formAddress = '';
    this.formHomeowner = '';
    this.formPhone = '';
    this.formAdjuster = '';
    this.formAdjusterId = '';
    this.formNotes = '';
    this.formConflict = null;
    this.view = 'create';
  }

  onFormTimeChange(): void {
    if (this.formAdjusterId && this.formDate && this.formTime) {
      this.formConflict = this.engine.checkConflict(this.formAdjusterId, this.formDate, this.formTime, this.inspections);
    }
  }

  saveInspection(): void {
    if (!this.formDate || !this.formTime || !this.formAddress || !this.formHomeowner) return;
    if (this.formConflict) {
      this.snackBar.open('Time slot conflict — choose another time', 'Close', { duration: 4000 });
      return;
    }
    const [h] = this.formTime.split(':').map(Number);
    const inspection: Partial<Inspection> = {
      date: this.formDate,
      time: this.formTime,
      endTime: `${(h + 1).toString().padStart(2, '0')}:00`,
      propertyAddress: this.formAddress,
      homeownerName: this.formHomeowner,
      homeownerPhone: this.formPhone || null,
      adjusterId: this.formAdjusterId || 'default',
      adjusterName: this.formAdjuster || 'Unassigned',
      status: 'scheduled',
      notes: this.formNotes || null,
      remindersSent: 0,
    };
    this.engine.createInspection(inspection).pipe().subscribe({
      next: () => {
        this.inspections.push({ id: `insp-${Date.now()}`, ...inspection, createdAt: new Date().toISOString() } as Inspection);
        this.buildCalendar();
        this.snackBar.open('Inspection scheduled', 'Close', { duration: 3000 });
        this.view = 'calendar';
      },
      error: () => {
        this.inspections.push({ id: `insp-${Date.now()}`, ...inspection, createdAt: new Date().toISOString() } as Inspection);
        this.buildCalendar();
        this.snackBar.open('Inspection scheduled locally', 'Close', { duration: 3000 });
        this.view = 'calendar';
      },
    });
  }

  // ── Status Update ──

  updateStatus(inspection: Inspection, status: AppointmentStatus): void {
    inspection.status = status;
    this.engine.updateInspection(inspection.id, { status }).subscribe();
    this.snackBar.open(`Marked as ${APPOINTMENT_STATUS_META[status].label}`, 'Close', { duration: 3000 });
  }

  // ── Availability ──

  openAvailability(): void {
    this.view = 'availability';
    this.availDays = [1, 2, 3, 4, 5];
    this.availStart = 8;
    this.availEnd = 17;
  }

  toggleDay(day: number): void {
    const idx = this.availDays.indexOf(day);
    if (idx >= 0) this.availDays.splice(idx, 1);
    else this.availDays.push(day);
  }

  addBlockedSlot(): void {
    if (!this.blockDate || !this.blockStart || !this.blockEnd) return;
    if (!this.availability) {
      this.availability = this.engine['defaultAvailability']('current');
    }
    this.availability.blockedSlots.push({
      date: this.blockDate, startTime: this.blockStart, endTime: this.blockEnd, reason: this.blockReason,
    });
    this.blockDate = '';
    this.blockStart = '';
    this.blockEnd = '';
    this.blockReason = '';
  }

  removeBlock(index: number): void {
    this.availability?.blockedSlots.splice(index, 1);
  }

  // ── Reminders ──

  sendReminder(inspection: Inspection, target: 'homeowner' | 'adjuster'): void {
    const reminder = this.engine.buildReminder(inspection, target, 'sms');
    this.snackBar.open(`Reminder sent to ${target}`, 'Close', { duration: 3000 });
    inspection.remindersSent++;
  }

  // ── Display Helpers ──

  getStatusColor(s: string): string { return APPOINTMENT_STATUS_META[s as AppointmentStatus]?.color || '#9e9e9e'; }
  getStatusIcon(s: string): string { return APPOINTMENT_STATUS_META[s as AppointmentStatus]?.icon || 'event'; }
  getStatusLabel(s: string): string { return APPOINTMENT_STATUS_META[s as AppointmentStatus]?.label || s; }

  get upcomingInspections(): Inspection[] {
    return this.engine.getUpcomingInspections(this.inspections);
  }

  get stats() {
    return this.engine.getInspectionStats(this.inspections);
  }

  formatDateLabel(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ── Mock Data ──

  private getMockInspections(): Inspection[] {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const d = (offset: number) => { const x = new Date(today); x.setDate(x.getDate() + offset); return fmt(x); };
    return [
      { id: 'insp-1', date: d(0), time: '09:00', endTime: '10:00', propertyAddress: '4521 Maple Dr, Plano, TX', homeownerName: 'Robert Chen', homeownerPhone: '(214) 555-0101', homeownerEmail: null, adjusterId: 'adj-1', adjusterName: 'Marcus Rivera', status: 'confirmed', notes: 'Hail damage — roof and gutters', leadId: null, claimId: null, conversationId: null, remindersSent: 1, createdAt: d(-2) },
      { id: 'insp-2', date: d(0), time: '14:00', endTime: '15:00', propertyAddress: '892 Elm St, Fort Worth, TX', homeownerName: 'Maria Gonzalez', homeownerPhone: '(817) 555-0202', homeownerEmail: null, adjusterId: 'adj-2', adjusterName: 'Angela Watts', status: 'scheduled', notes: null, leadId: null, claimId: null, conversationId: null, remindersSent: 0, createdAt: d(-1) },
      { id: 'insp-3', date: d(1), time: '10:00', endTime: '11:00', propertyAddress: '2100 Oak Ridge Blvd, Arlington, TX', homeownerName: 'James Parker', homeownerPhone: '(682) 555-0303', homeownerEmail: null, adjusterId: 'adj-1', adjusterName: 'Marcus Rivera', status: 'scheduled', notes: 'Wind damage — shingles', leadId: null, claimId: null, conversationId: null, remindersSent: 0, createdAt: d(-1) },
      { id: 'insp-4', date: d(2), time: '11:00', endTime: '12:00', propertyAddress: '567 Pine Ave, Dallas, TX', homeownerName: 'Patricia Williams', homeownerPhone: '(972) 555-0404', homeownerEmail: null, adjusterId: 'adj-3', adjusterName: 'Tyler Jackson', status: 'scheduled', notes: null, leadId: null, claimId: null, conversationId: null, remindersSent: 0, createdAt: d(0) },
      { id: 'insp-5', date: d(-1), time: '09:00', endTime: '10:00', propertyAddress: '1890 Cedar Ln, Irving, TX', homeownerName: 'David Thompson', homeownerPhone: '(469) 555-0505', homeownerEmail: null, adjusterId: 'adj-2', adjusterName: 'Angela Watts', status: 'completed', notes: 'Inspection complete — claim created', leadId: null, claimId: null, conversationId: null, remindersSent: 2, createdAt: d(-3) },
      { id: 'insp-6', date: d(3), time: '13:00', endTime: '14:00', propertyAddress: '3200 Birch Ct, Garland, TX', homeownerName: 'Jennifer Adams', homeownerPhone: '(214) 555-0606', homeownerEmail: null, adjusterId: 'adj-1', adjusterName: 'Marcus Rivera', status: 'scheduled', notes: 'Fire damage claim', leadId: null, claimId: null, conversationId: null, remindersSent: 0, createdAt: d(0) },
    ];
  }
}
