/**
 * Inspection Schedule Models
 *
 * Shared types for property inspection scheduling, adjuster availability,
 * conflict detection, and calendar notifications.
 *
 * Integrates with: Communications Hub (appointment booking),
 * Task Engine (inspection tasks), Engagement Engine (reminders).
 */

// ── Appointment ────────────────────────────────────────────────

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, {
  label: string; icon: string; color: string;
}> = {
  scheduled:  { label: 'Scheduled',  icon: 'event',          color: '#2196f3' },
  confirmed:  { label: 'Confirmed',  icon: 'event_available', color: '#4caf50' },
  completed:  { label: 'Completed',  icon: 'check_circle',   color: '#1565c0' },
  cancelled:  { label: 'Cancelled',  icon: 'event_busy',     color: '#9e9e9e' },
};

export interface Inspection {
  id: string;
  date: string;
  time: string;
  endTime: string;
  propertyAddress: string;
  homeownerName: string;
  homeownerPhone: string | null;
  homeownerEmail: string | null;
  adjusterId: string;
  adjusterName: string;
  status: AppointmentStatus;
  notes: string | null;
  leadId: string | null;
  claimId: string | null;
  conversationId: string | null;
  remindersSent: number;
  createdAt: string;
}

// ── Adjuster Availability ──────────────────────────────────────

export interface AdjusterAvailability {
  adjusterId: string;
  adjusterName: string;
  availableDays: number[];
  startHour: number;
  endHour: number;
  blockedSlots: BlockedSlot[];
}

export interface BlockedSlot {
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

// ── Time Slot ──────────────────────────────────────────────────

export interface TimeSlot {
  time: string;
  endTime: string;
  isAvailable: boolean;
  isBlocked: boolean;
  existingInspection: Inspection | null;
}

// ── Calendar View ──────────────────────────────────────────────

export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarDay {
  date: string;
  dayOfWeek: number;
  isToday: boolean;
  inspections: Inspection[];
}

// ── Reminder ───────────────────────────────────────────────────

export type ReminderTarget = 'homeowner' | 'adjuster';
export type ReminderChannel = 'sms' | 'email';

export interface InspectionReminder {
  inspectionId: string;
  target: ReminderTarget;
  channel: ReminderChannel;
  scheduledAt: string;
  sentAt: string | null;
  message: string;
}
