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
@Injectable({ providedIn: 'root' })
export class AiSalesAgentService {

  private conversations$ = new BehaviorSubject<AiConversation[]>(this.mockConversations());
  private appointments$ = new BehaviorSubject<Appointment[]>(this.mockAppointments());
  private scripts$ = new BehaviorSubject<SalesScript[]>(this.mockScripts());

  getConversations(): Observable<AiConversation[]> { return this.conversations$.asObservable(); }
  getAppointments(): Observable<Appointment[]> { return this.appointments$.asObservable(); }
  getScripts(): Observable<SalesScript[]> { return this.scripts$.asObservable(); }

  getConversationById(id: string): AiConversation | undefined {
    return this.conversations$.value.find(c => c.id === id);
  }

  getKpis(): Observable<SalesKpi> {
    const convos = this.conversations$.value;
    const qualified = convos.filter(c => c.status === 'qualified' || c.status === 'appointment_set' || c.status === 'client_signed').length;
    const signed = convos.filter(c => c.status === 'client_signed').length;
    const appts = this.appointments$.value.length;
    const scores = convos.filter(c => c.qualificationScore !== null).map(c => c.qualificationScore!);
    return of({
      conversationsStarted: convos.length,
      leadsQualified: qualified,
      appointmentsBooked: appts,
      clientsSigned: signed,
      conversionRate: convos.length ? Math.round((signed / convos.length) * 100) : 0,
      avgQualificationScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      avgResponseTime: '2.4 min',
    });
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

  // ── Mock Data ────────────────────────────────────────────────────
  private mockConversations(): AiConversation[] {
    return [
      {
        id: 'SAC-001', homeownerName: 'Robert Williams', homeownerPhone: '(214) 555-0142',
        homeownerEmail: 'rwilliams@email.com', propertyAddress: '1420 Elm St', city: 'Dallas', state: 'TX',
        claimType: 'fire', status: 'new_lead', qualificationScore: null, claimProbabilityScore: null,
        assignedAgent: 'Sarah Mitchell', createdAt: '2026-03-16T08:30:00Z', lastActivityAt: '2026-03-16T08:30:00Z',
        messages: [
          { id: 'm1', sender: 'ai', content: 'Hello Robert, I\'m the UPA AI assistant. I see a fire incident was reported near your property at 1420 Elm St. Are you dealing with any property damage?', timestamp: '2026-03-16T08:30:00Z' },
          { id: 'm2', sender: 'homeowner', content: 'Yes, we had smoke damage throughout the house and some structural damage to the kitchen.', timestamp: '2026-03-16T08:32:00Z' },
          { id: 'm3', sender: 'ai', content: 'I\'m sorry to hear that. We specialize in helping homeowners like you navigate the insurance claim process. Do you currently have an active homeowner\'s insurance policy?', timestamp: '2026-03-16T08:32:30Z' },
        ],
      },
      {
        id: 'SAC-002', homeownerName: 'Jennifer Martinez', homeownerPhone: '(405) 555-0198',
        homeownerEmail: 'jmartinez@email.com', propertyAddress: '892 Oak Ave', city: 'Oklahoma City', state: 'OK',
        claimType: 'storm', status: 'qualified', qualificationScore: 87, claimProbabilityScore: 82,
        assignedAgent: 'James Carter', createdAt: '2026-03-15T10:15:00Z', lastActivityAt: '2026-03-16T06:20:00Z',
        messages: [
          { id: 'm1', sender: 'ai', content: 'Hi Jennifer, this is the UPA AI assistant. We detected a severe hailstorm in your area. Has your property sustained any damage?', timestamp: '2026-03-15T10:15:00Z' },
          { id: 'm2', sender: 'homeowner', content: 'Yes, my roof has dents and the siding is cracked on the north side.', timestamp: '2026-03-15T10:20:00Z' },
          { id: 'm3', sender: 'ai', content: 'That sounds like significant damage. Based on what you\'ve described, you likely have a strong insurance claim. I\'ve assigned James Carter as your dedicated adjuster. He\'ll be reaching out to schedule a free property inspection.', timestamp: '2026-03-15T10:20:30Z' },
          { id: 'm4', sender: 'homeowner', content: 'That would be great, thank you.', timestamp: '2026-03-15T10:22:00Z' },
          { id: 'm5', sender: 'agent', content: 'Hi Jennifer, James here. I\'d love to come take a look at the damage. Are you available Thursday or Friday afternoon?', timestamp: '2026-03-15T14:00:00Z' },
        ],
      },
      {
        id: 'SAC-003', homeownerName: 'Michael Thompson', homeownerPhone: '(713) 555-0267',
        homeownerEmail: 'mthompson@email.com', propertyAddress: '3300 Pine Rd', city: 'Houston', state: 'TX',
        claimType: 'storm', status: 'appointment_set', qualificationScore: 92, claimProbabilityScore: 88,
        assignedAgent: 'Maria Santos', createdAt: '2026-03-14T16:45:00Z', lastActivityAt: '2026-03-16T09:10:00Z',
        messages: [
          { id: 'm1', sender: 'ai', content: 'Hello Michael, I\'m reaching out from UPA regarding wind damage reports in your area. Have you noticed any damage to your property?', timestamp: '2026-03-14T16:45:00Z' },
          { id: 'm2', sender: 'homeowner', content: 'My fence is down and the garage roof has missing shingles.', timestamp: '2026-03-14T16:50:00Z' },
          { id: 'm3', sender: 'ai', content: 'I understand. Wind damage like this is typically covered under standard homeowner policies. Let me connect you with Maria Santos, one of our top adjusters. She can assess the damage and help you get the settlement you deserve.', timestamp: '2026-03-14T16:50:30Z' },
          { id: 'm4', sender: 'agent', content: 'Michael, I\'ve scheduled your consultation for March 17 at 10:00 AM via Teams. You\'ll receive a calendar invite shortly.', timestamp: '2026-03-15T09:00:00Z' },
        ],
      },
      {
        id: 'SAC-004', homeownerName: 'Lisa Anderson', homeownerPhone: '(602) 555-0333',
        homeownerEmail: 'landerson@email.com', propertyAddress: '567 Maple Dr', city: 'Phoenix', state: 'AZ',
        claimType: 'fire', status: 'contacted', qualificationScore: 74, claimProbabilityScore: 68,
        assignedAgent: 'David Kim', createdAt: '2026-03-15T08:20:00Z', lastActivityAt: '2026-03-16T07:45:00Z',
        messages: [
          { id: 'm1', sender: 'ai', content: 'Hi Lisa, I\'m the UPA AI assistant. A fire incident was reported near 567 Maple Dr. Is everything okay? Did your property sustain any damage?', timestamp: '2026-03-15T08:20:00Z' },
          { id: 'm2', sender: 'homeowner', content: 'We had a kitchen fire. The fire department came out. There\'s damage to the kitchen and smoke throughout.', timestamp: '2026-03-15T08:25:00Z' },
          { id: 'm3', sender: 'ai', content: 'I\'m glad everyone is safe. Kitchen fires can cause more damage than what\'s visible — smoke and water damage often extend beyond the obvious areas. Do you have your insurance information handy?', timestamp: '2026-03-15T08:25:30Z' },
        ],
      },
      {
        id: 'SAC-005', homeownerName: 'Thomas Garcia', homeownerPhone: '(303) 555-0412',
        homeownerEmail: 'tgarcia@email.com', propertyAddress: '1100 Birch Ln', city: 'Denver', state: 'CO',
        claimType: 'storm', status: 'client_signed', qualificationScore: 95, claimProbabilityScore: 93,
        assignedAgent: 'Emily Parker', createdAt: '2026-03-13T11:00:00Z', lastActivityAt: '2026-03-16T10:00:00Z',
        messages: [
          { id: 'm1', sender: 'ai', content: 'Hello Thomas, I\'m reaching out regarding the recent hailstorm. We noticed your area received significant hail. How is your property?', timestamp: '2026-03-13T11:00:00Z' },
          { id: 'm2', sender: 'homeowner', content: 'The roof is badly damaged. Multiple shingles torn off and I can see dents on the metal vents.', timestamp: '2026-03-13T11:05:00Z' },
          { id: 'm3', sender: 'ai', content: 'That\'s a strong indicator of a valid hail damage claim. Based on your description, I\'m giving this a high priority. Emily Parker will be your dedicated adjuster. She\'s one of our best.', timestamp: '2026-03-13T11:05:30Z' },
          { id: 'm4', sender: 'agent', content: 'Thomas, great news — your claim has been approved. I\'m sending over the representation agreement now. Once signed, we\'ll get your roof replacement process started immediately.', timestamp: '2026-03-15T14:00:00Z' },
          { id: 'm5', sender: 'homeowner', content: 'Signed and sent back. Thank you for making this so easy!', timestamp: '2026-03-15T16:30:00Z' },
        ],
      },
      {
        id: 'SAC-006', homeownerName: 'Angela Davis', homeownerPhone: '(817) 555-0188',
        homeownerEmail: 'adavis@email.com', propertyAddress: '2200 Cedar Ct', city: 'Fort Worth', state: 'TX',
        claimType: 'vandalism', status: 'new_lead', qualificationScore: null, claimProbabilityScore: null,
        assignedAgent: 'Sarah Mitchell', createdAt: '2026-03-16T07:00:00Z', lastActivityAt: '2026-03-16T07:00:00Z',
        messages: [
          { id: 'm1', sender: 'ai', content: 'Hello Angela, I\'m the UPA AI assistant. We received a report about vandalism incidents in your neighborhood. Has your property been affected?', timestamp: '2026-03-16T07:00:00Z' },
        ],
      },
      {
        id: 'SAC-007', homeownerName: 'David Chen', homeownerPhone: '(972) 555-0290',
        homeownerEmail: 'dchen@email.com', propertyAddress: '450 Willow Way', city: 'Plano', state: 'TX',
        claimType: 'water', status: 'qualified', qualificationScore: 81, claimProbabilityScore: 76,
        assignedAgent: 'James Carter', createdAt: '2026-03-14T14:00:00Z', lastActivityAt: '2026-03-16T05:30:00Z',
        messages: [
          { id: 'm1', sender: 'ai', content: 'Hi David, I\'m the UPA AI assistant. We understand you may be dealing with water damage at your home. Can you tell me what happened?', timestamp: '2026-03-14T14:00:00Z' },
          { id: 'm2', sender: 'homeowner', content: 'A pipe burst in the upstairs bathroom and water leaked through the ceiling into the living room.', timestamp: '2026-03-14T14:10:00Z' },
          { id: 'm3', sender: 'ai', content: 'Pipe bursts can cause extensive hidden damage — mold, structural weakening, and electrical issues. This is definitely something your insurance should cover. Let me connect you with James Carter.', timestamp: '2026-03-14T14:10:30Z' },
        ],
      },
      {
        id: 'SAC-008', homeownerName: 'Patricia Moore', homeownerPhone: '(469) 555-0155',
        homeownerEmail: 'pmoore@email.com', propertyAddress: '789 Spruce Blvd', city: 'Arlington', state: 'TX',
        claimType: 'storm', status: 'appointment_set', qualificationScore: 89, claimProbabilityScore: 85,
        assignedAgent: 'Maria Santos', createdAt: '2026-03-14T09:00:00Z', lastActivityAt: '2026-03-16T08:00:00Z',
        messages: [
          { id: 'm1', sender: 'ai', content: 'Hello Patricia, strong storms passed through Arlington recently. How did your property fare?', timestamp: '2026-03-14T09:00:00Z' },
          { id: 'm2', sender: 'homeowner', content: 'We have roof damage and a broken window from hail. The gutters are wrecked too.', timestamp: '2026-03-14T09:15:00Z' },
          { id: 'm3', sender: 'agent', content: 'Patricia, I have you scheduled for a consultation on March 18 at 2:00 PM. We\'ll go over everything.', timestamp: '2026-03-15T10:00:00Z' },
        ],
      },
    ];
  }

  private mockAppointments(): Appointment[] {
    return [
      { id: 'APT-001', conversationId: 'SAC-003', homeownerName: 'Michael Thompson', adjusterName: 'Maria Santos', date: '2026-03-17', time: '10:00 AM', platform: 'teams', status: 'scheduled', claimType: 'storm', propertyAddress: '3300 Pine Rd, Houston TX', notes: 'Wind damage assessment — fence and garage roof' },
      { id: 'APT-002', conversationId: 'SAC-008', homeownerName: 'Patricia Moore', adjusterName: 'Maria Santos', date: '2026-03-18', time: '2:00 PM', platform: 'zoom', status: 'scheduled', claimType: 'storm', propertyAddress: '789 Spruce Blvd, Arlington TX', notes: 'Hail damage — roof, window, gutters' },
      { id: 'APT-003', conversationId: 'SAC-005', homeownerName: 'Thomas Garcia', adjusterName: 'Emily Parker', date: '2026-03-15', time: '11:00 AM', platform: 'teams', status: 'completed', claimType: 'storm', propertyAddress: '1100 Birch Ln, Denver CO', notes: 'Full roof replacement review — signed' },
      { id: 'APT-004', conversationId: 'SAC-002', homeownerName: 'Jennifer Martinez', adjusterName: 'James Carter', date: '2026-03-19', time: '3:30 PM', platform: 'zoom', status: 'scheduled', claimType: 'storm', propertyAddress: '892 Oak Ave, Oklahoma City OK', notes: 'Roof and siding hail inspection' },
    ];
  }

  private mockScripts(): SalesScript[] {
    return [
      {
        id: 'SCR-001', name: 'Fire Damage Outreach', claimType: 'fire', isActive: true, lastModified: '2026-03-10T12:00:00Z',
        stages: [
          { label: 'Initial Contact', prompt: 'Hello {name}, I\'m the UPA AI assistant. A fire incident was reported near your property at {address}. Are you dealing with any property damage?', responseOptions: ['Yes, we had damage', 'No damage', 'Not sure yet'] },
          { label: 'Damage Assessment', prompt: 'I\'m sorry to hear that. Can you describe the damage? Was it structural, smoke, or water damage from firefighting?', responseOptions: ['Structural', 'Smoke damage', 'Water damage', 'Multiple types'] },
          { label: 'Insurance Check', prompt: 'Do you currently have an active homeowner\'s insurance policy? Fire damage claims are typically well-covered.', responseOptions: ['Yes, I have insurance', 'Not sure about coverage', 'No insurance'] },
          { label: 'Schedule Consultation', prompt: 'Great. I\'d like to connect you with one of our certified adjusters for a free property assessment. What days work best for you?', responseOptions: ['This week', 'Next week', 'Need more info first'] },
        ],
      },
      {
        id: 'SCR-002', name: 'Water Damage Response', claimType: 'water', isActive: true, lastModified: '2026-03-08T09:00:00Z',
        stages: [
          { label: 'Initial Contact', prompt: 'Hi {name}, I\'m the UPA AI assistant. We understand you may be dealing with water damage. Can you tell me what happened?', responseOptions: ['Pipe burst', 'Flooding', 'Roof leak', 'Appliance malfunction'] },
          { label: 'Severity Assessment', prompt: 'Water damage can cause hidden problems like mold and structural weakening. How much of your home is affected?', responseOptions: ['One room', 'Multiple rooms', 'Entire floor', 'Multiple floors'] },
          { label: 'Urgency Check', prompt: 'Is the water issue currently contained, or is it still an active problem?', responseOptions: ['Contained', 'Still active', 'Not sure'] },
          { label: 'Schedule Consultation', prompt: 'We should get someone out quickly to assess the full extent of damage before it worsens. Can I schedule a free inspection?', responseOptions: ['Yes, ASAP', 'Yes, this week', 'Need to think about it'] },
        ],
      },
      {
        id: 'SCR-003', name: 'Storm Damage Outreach', claimType: 'storm', isActive: true, lastModified: '2026-03-12T15:00:00Z',
        stages: [
          { label: 'Initial Contact', prompt: 'Hello {name}, severe weather was recently reported in your area. Has your property sustained any damage from the storm?', responseOptions: ['Yes, roof damage', 'Yes, siding/windows', 'Yes, multiple areas', 'No damage'] },
          { label: 'Damage Details', prompt: 'Storm damage often affects areas you can\'t easily see from the ground. Have you noticed any of these: missing shingles, dents on vents, cracked siding, or water stains on ceilings?', responseOptions: ['Yes, visible damage', 'Haven\'t checked yet', 'Only minor issues'] },
          { label: 'Insurance Verification', prompt: 'Most homeowner policies cover storm damage. Would you like us to review your coverage and help you file a claim at no upfront cost?', responseOptions: ['Yes, please help', 'Tell me more first', 'Already filed'] },
          { label: 'Schedule Inspection', prompt: 'I\'d like to schedule a free roof and property inspection with one of our certified adjusters. They\'ll document everything needed for your claim. When works best?', responseOptions: ['This week', 'Next week', 'Weekends only'] },
        ],
      },
      {
        id: 'SCR-004', name: 'Vandalism Claim Outreach', claimType: 'vandalism', isActive: false, lastModified: '2026-03-05T10:00:00Z',
        stages: [
          { label: 'Initial Contact', prompt: 'Hello {name}, we received a report about vandalism incidents in your area. Has your property been affected?', responseOptions: ['Yes', 'No', 'Not sure'] },
          { label: 'Documentation Check', prompt: 'Have you filed a police report for the vandalism? This is important for your insurance claim.', responseOptions: ['Yes, filed', 'Not yet', 'Didn\'t know I needed to'] },
          { label: 'Damage Assessment', prompt: 'Can you describe the damage? For example: broken windows, graffiti, structural damage, or stolen items?', responseOptions: ['Windows/doors', 'Exterior damage', 'Interior damage', 'Multiple types'] },
          { label: 'Schedule Consultation', prompt: 'We can help you get your property restored through your insurance. Want to schedule a free consultation?', responseOptions: ['Yes, schedule me', 'Need more info', 'Not interested'] },
        ],
      },
    ];
  }
}
