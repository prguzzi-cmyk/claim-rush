import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Inspection, AppointmentStatus, AdjusterAvailability, BlockedSlot,
  TimeSlot, CalendarDay, CalendarView, InspectionReminder,
} from '../models/inspection-schedule.model';

@Injectable({ providedIn: 'root' })
export class InspectionScheduleEngineService {

  private basePath = 'inspections';

  constructor(private http: HttpClient) {}

  // ── CRUD ──

  getInspections(params?: { date?: string; adjuster_id?: string; status?: string }): Observable<Inspection[]> {
    return this.http.get<Inspection[]>(this.basePath, { params: params as any }).pipe(catchError(() => of([])));
  }

  createInspection(data: Partial<Inspection>): Observable<Inspection> {
    return this.http.post<Inspection>(this.basePath, data);
  }

  updateInspection(id: string, data: Partial<Inspection>): Observable<Inspection> {
    return this.http.patch<Inspection>(`${this.basePath}/${id}`, data);
  }

  deleteInspection(id: string): Observable<any> {
    return this.http.delete(`${this.basePath}/${id}`);
  }

  sendReminder(inspectionId: string, target: 'homeowner' | 'adjuster', channel: 'sms' | 'email'): Observable<any> {
    return this.http.post(`${this.basePath}/${inspectionId}/remind`, { target, channel });
  }

  // ── Availability ──

  getAdjusterAvailability(adjusterId: string): Observable<AdjusterAvailability> {
    return this.http.get<AdjusterAvailability>(`${this.basePath}/availability/${adjusterId}`).pipe(
      catchError(() => of(this.defaultAvailability(adjusterId)))
    );
  }

  saveAvailability(data: AdjusterAvailability): Observable<AdjusterAvailability> {
    return this.http.put<AdjusterAvailability>(`${this.basePath}/availability/${data.adjusterId}`, data);
  }

  private defaultAvailability(adjusterId: string): AdjusterAvailability {
    return { adjusterId, adjusterName: '', availableDays: [1, 2, 3, 4, 5], startHour: 8, endHour: 17, blockedSlots: [] };
  }

  // ── Conflict Detection ──

  checkConflict(adjusterId: string, date: string, time: string, inspections: Inspection[]): Inspection | null {
    return inspections.find(i =>
      i.adjusterId === adjusterId && i.date === date && i.time === time
      && i.status !== 'cancelled'
    ) || null;
  }

  getAvailableSlots(adjusterId: string, date: string, availability: AdjusterAvailability, existing: Inspection[]): TimeSlot[] {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    if (!availability.availableDays.includes(dayOfWeek)) return [];

    const slots: TimeSlot[] = [];
    for (let h = availability.startHour; h < availability.endHour; h++) {
      const time = `${h.toString().padStart(2, '0')}:00`;
      const endTime = `${(h + 1).toString().padStart(2, '0')}:00`;
      const blocked = availability.blockedSlots.find(b => b.date === date && b.startTime <= time && b.endTime > time);
      const booked = existing.find(i => i.adjusterId === adjusterId && i.date === date && i.time === time && i.status !== 'cancelled');
      slots.push({ time, endTime, isAvailable: !blocked && !booked, isBlocked: !!blocked, existingInspection: booked || null });
    }
    return slots;
  }

  // ── Calendar Helpers ──

  buildCalendarDays(startDate: string, days: number, inspections: Inspection[]): CalendarDay[] {
    const today = new Date().toISOString().split('T')[0];
    const result: CalendarDay[] = [];
    const start = new Date(startDate + 'T00:00:00');
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        dayOfWeek: d.getDay(),
        isToday: dateStr === today,
        inspections: inspections.filter(ins => ins.date === dateStr),
      });
    }
    return result;
  }

  getWeekStart(date: string): string {
    const d = new Date(date + 'T00:00:00');
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d.toISOString().split('T')[0];
  }

  getMonthStart(date: string): string {
    return date.substring(0, 7) + '-01';
  }

  getDaysInMonth(date: string): number {
    const [y, m] = date.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  // ── Reminders ──

  buildReminder(inspection: Inspection, target: 'homeowner' | 'adjuster', channel: 'sms' | 'email'): InspectionReminder {
    const name = target === 'homeowner' ? inspection.homeownerName : inspection.adjusterName;
    const msg = target === 'homeowner'
      ? `Hi ${name}, reminder: your property inspection at ${inspection.propertyAddress} is scheduled for ${inspection.date} at ${inspection.time}.`
      : `Reminder: inspection at ${inspection.propertyAddress} (${inspection.homeownerName}) on ${inspection.date} at ${inspection.time}.`;
    return {
      inspectionId: inspection.id, target, channel,
      scheduledAt: new Date().toISOString(), sentAt: null, message: msg,
    };
  }

  // ── Dashboard Data ──

  getUpcomingInspections(inspections: Inspection[], limit: number = 5): Inspection[] {
    const today = new Date().toISOString().split('T')[0];
    return inspections
      .filter(i => i.date >= today && i.status !== 'cancelled')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, limit);
  }

  getInspectionStats(inspections: Inspection[]): { total: number; scheduled: number; confirmed: number; completed: number; cancelled: number } {
    return {
      total: inspections.length,
      scheduled: inspections.filter(i => i.status === 'scheduled').length,
      confirmed: inspections.filter(i => i.status === 'confirmed').length,
      completed: inspections.filter(i => i.status === 'completed').length,
      cancelled: inspections.filter(i => i.status === 'cancelled').length,
    };
  }
}
