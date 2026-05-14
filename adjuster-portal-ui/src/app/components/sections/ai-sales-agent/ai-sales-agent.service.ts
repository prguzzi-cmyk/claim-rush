import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

// ── Types ────────────────────────────────────────────────────────────
export type LeadStatus = 'new_lead' | 'contacted' | 'qualified' | 'appointment_set' | 'client_signed';
export type ClaimType = 'fire' | 'water' | 'storm' | 'vandalism';
export type MeetingPlatform = 'teams' | 'zoom';
export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface AiConversation {
  id: string;
  homeownerName: string;
  homeownerPhone: string;
  homeownerEmail: string;
  propertyAddress: string;
  city: string;
  state: string;
  claimType: ClaimType;
  status: LeadStatus;
  qualificationScore: number | null;
  claimProbabilityScore: number | null;
  assignedAgent: string;
  messages: ConversationMessage[];
  createdAt: string;
  lastActivityAt: string;
}

export interface ConversationMessage {
  id: string;
  sender: 'ai' | 'homeowner' | 'agent';
  content: string;
  timestamp: string;
}

export interface Appointment {
  id: string;
  conversationId: string;
  homeownerName: string;
  adjusterName: string;
  date: string;
  time: string;
  platform: MeetingPlatform;
  status: MeetingStatus;
  claimType: ClaimType;
  propertyAddress: string;
  notes: string;
}

export interface SalesScript {
  id: string;
  name: string;
  claimType: ClaimType;
  stages: ScriptStage[];
  isActive: boolean;
  lastModified: string;
}

export interface ScriptStage {
  label: string;
  prompt: string;
  responseOptions: string[];
}

export interface SalesKpi {
  conversationsStarted: number;
  leadsQualified: number;
  appointmentsBooked: number;
  clientsSigned: number;
  conversionRate: number;
  avgQualificationScore: number;
  avgResponseTime: string;
}

// ── Service ──────────────────────────────────────────────────────────
// Pre-launch honest empty source. No real backend is wired yet for the
// AI Sales Agent surface; conversations / appointments / scripts seed
// empty so every consuming dashboard renders its existing *ngIf-guarded
// empty state instead of fabricated names, conversations, or metrics.
@Injectable({ providedIn: 'root' })
export class AiSalesAgentService {

  private conversations$ = new BehaviorSubject<AiConversation[]>([]);
  private appointments$ = new BehaviorSubject<Appointment[]>([]);
  private scripts$ = new BehaviorSubject<SalesScript[]>([]);

  getConversations(): Observable<AiConversation[]> { return this.conversations$.asObservable(); }
  getAppointments(): Observable<Appointment[]> { return this.appointments$.asObservable(); }
  getScripts(): Observable<SalesScript[]> { return this.scripts$.asObservable(); }

  getConversationById(id: string): AiConversation | undefined {
    return this.conversations$.value.find(c => c.id === id);
  }

  // Returns null until a real backend exists. Consuming dashboards already
  // guard with *ngIf="kpis", so null renders their honest empty state.
  getKpis(): Observable<SalesKpi | null> {
    return of(null);
  }

  updateConversationStatus(id: string, status: LeadStatus): void {
    const list = this.conversations$.value.map(c => c.id === id ? { ...c, status } : c);
    this.conversations$.next(list);
  }

  addAppointment(appt: Appointment): void {
    this.appointments$.next([appt, ...this.appointments$.value]);
  }

  updateAppointmentStatus(id: string, status: MeetingStatus): void {
    const list = this.appointments$.value.map(a => a.id === id ? { ...a, status } : a);
    this.appointments$.next(list);
  }

  saveScript(script: SalesScript): void {
    const list = this.scripts$.value;
    const idx = list.findIndex(s => s.id === script.id);
    if (idx >= 0) { list[idx] = script; } else { list.push(script); }
    this.scripts$.next([...list]);
  }
}
