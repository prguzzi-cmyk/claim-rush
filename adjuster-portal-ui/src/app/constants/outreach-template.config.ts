/**
 * Outreach Campaign Templates
 *
 * Pre-built messaging templates for property damage lead outreach.
 * Supports SMS, email, and voice script channels with variable interpolation.
 *
 * To add templates: append to OUTREACH_TEMPLATES below.
 * No code changes needed elsewhere — the campaign engine reads from this array.
 */

import { OutreachMessageTemplate } from '../shared/models/outreach-campaign.model';

export const OUTREACH_TEMPLATES: OutreachMessageTemplate[] = [

  // ── SMS Templates ────────────────────────────────────────────

  {
    id: 'sms-storm-intro',
    name: 'Storm Damage Introduction',
    channel: 'sms',
    subject: null,
    body: 'Hi {{owner_name}}, this is {{adjuster_name}} with {{company_name}}. We noticed recent storm activity near {{property_address}}. We offer free roof inspections for homeowners. Would you like to schedule one? Reply YES or call us.',
    callScript: null,
    category: 'storm_outreach',
    variables: ['owner_name', 'adjuster_name', 'company_name', 'property_address'],
    isActive: true,
  },
  {
    id: 'sms-fire-intro',
    name: 'Fire Damage Introduction',
    channel: 'sms',
    subject: null,
    body: 'Hi {{owner_name}}, this is {{adjuster_name}} with {{company_name}}. We understand there was a recent fire incident near {{property_address}}. We help homeowners navigate insurance claims. Would you like a free consultation? Reply YES.',
    callScript: null,
    category: 'fire_outreach',
    variables: ['owner_name', 'adjuster_name', 'company_name', 'property_address'],
    isActive: true,
  },
  {
    id: 'sms-followup',
    name: 'Follow-Up After No Response',
    channel: 'sms',
    subject: null,
    body: 'Hi {{owner_name}}, just following up about the property at {{property_address}}. We offer free inspections and can help with your insurance claim. No obligation. Reply STOP to opt out.',
    callScript: null,
    category: 'followup',
    variables: ['owner_name', 'property_address'],
    isActive: true,
  },
  {
    id: 'sms-appointment-confirm',
    name: 'Appointment Confirmation',
    channel: 'sms',
    subject: null,
    body: 'Hi {{owner_name}}, confirming your free inspection at {{property_address}}. {{adjuster_name}} will be there as scheduled. Call us if you need to reschedule.',
    callScript: null,
    category: 'appointment',
    variables: ['owner_name', 'property_address', 'adjuster_name'],
    isActive: true,
  },

  // ── Email Templates ──────────────────────────────────────────

  {
    id: 'email-storm-intro',
    name: 'Storm Damage Introduction Email',
    channel: 'email',
    subject: 'Free Roof Inspection — Recent Storm Near {{property_address}}',
    body: 'Dear {{owner_name}},\n\nRecent weather activity in your area may have caused damage to your property at {{property_address}}. As licensed public adjusters, we specialize in helping homeowners recover the full value of their insurance claims.\n\nWe would like to offer you a free, no-obligation roof and property inspection to assess any potential damage.\n\nWhat we do:\n- Inspect your property for storm damage\n- Document all findings with photos and measurements\n- File and negotiate your insurance claim on your behalf\n- Ensure you receive the maximum settlement\n\nPlease reply to this email or call us to schedule your free inspection.\n\nSincerely,\n{{adjuster_name}}\n{{company_name}}',
    callScript: null,
    category: 'storm_outreach',
    variables: ['owner_name', 'property_address', 'adjuster_name', 'company_name'],
    isActive: true,
  },
  {
    id: 'email-fire-intro',
    name: 'Fire Damage Introduction Email',
    channel: 'email',
    subject: 'We Can Help With Your Property Claim — {{property_address}}',
    body: 'Dear {{owner_name}},\n\nWe understand there was a recent fire incident near your property at {{property_address}}. We are licensed public adjusters who help homeowners navigate the insurance claims process.\n\nFire damage claims can be complex. We handle:\n- Property damage assessment\n- Smoke and water damage documentation\n- Insurance claim filing and negotiation\n- Supplement demands for underpaid claims\n\nOur consultation is free and there is no obligation. Please reply or call us to discuss your situation.\n\nSincerely,\n{{adjuster_name}}\n{{company_name}}',
    callScript: null,
    category: 'fire_outreach',
    variables: ['owner_name', 'property_address', 'adjuster_name', 'company_name'],
    isActive: true,
  },
  {
    id: 'email-followup',
    name: 'Follow-Up Email',
    channel: 'email',
    subject: 'Following Up — Free Property Inspection at {{property_address}}',
    body: 'Dear {{owner_name}},\n\nI wanted to follow up on our previous message regarding your property at {{property_address}}.\n\nStorm and weather damage is not always visible from the ground. Many homeowners are unaware they have a valid insurance claim until a professional inspection is completed.\n\nWe are still happy to offer a free inspection at no cost or obligation to you.\n\nPlease let us know a convenient time, or simply reply to this email.\n\nThank you,\n{{adjuster_name}}\n{{company_name}}',
    callScript: null,
    category: 'followup',
    variables: ['owner_name', 'property_address', 'adjuster_name', 'company_name'],
    isActive: true,
  },

  // ── Voice Script Templates ───────────────────────────────────

  {
    id: 'voice-storm-intro',
    name: 'Storm Damage Voice Script',
    channel: 'voice',
    subject: null,
    body: 'Greet the homeowner by name. Introduce yourself and the company. Mention the recent storm activity in their area. Offer a free roof inspection. Ask if they have noticed any damage. If interested, schedule an inspection time.',
    callScript: 'Hello, may I speak with {{owner_name}}? Hi {{owner_name}}, my name is {{adjuster_name}} and I am calling from {{company_name}}. We are licensed public adjusters. I am reaching out because there was recent {{incident_type}} activity near your property at {{property_address}}. We are offering free roof and property inspections to homeowners in the area. Have you noticed any damage to your roof or property recently?',
    category: 'storm_outreach',
    variables: ['owner_name', 'adjuster_name', 'company_name', 'incident_type', 'property_address'],
    isActive: true,
  },
  {
    id: 'voice-fire-intro',
    name: 'Fire Damage Voice Script',
    channel: 'voice',
    subject: null,
    body: 'Greet the homeowner. Express concern about the fire incident. Offer free consultation. Ask about insurance claim status. If no claim filed, explain the process.',
    callScript: 'Hello, may I speak with {{owner_name}}? Hi, my name is {{adjuster_name}} from {{company_name}}. I am calling because we understand there was a fire incident near {{property_address}}. We help homeowners navigate the insurance claims process at no upfront cost. Have you already filed an insurance claim for any damage?',
    category: 'fire_outreach',
    variables: ['owner_name', 'adjuster_name', 'company_name', 'property_address'],
    isActive: true,
  },
  {
    id: 'voice-followup',
    name: 'Follow-Up Voice Script',
    channel: 'voice',
    subject: null,
    body: 'Reference previous contact attempt. Reiterate the free inspection offer. Keep it brief and friendly.',
    callScript: 'Hello {{owner_name}}, this is {{adjuster_name}} with {{company_name}}. I tried reaching you earlier about a free property inspection at {{property_address}}. I just wanted to check if you had any questions or if you would like to schedule a time. There is absolutely no cost or obligation.',
    category: 'followup',
    variables: ['owner_name', 'adjuster_name', 'company_name', 'property_address'],
    isActive: true,
  },
];

/** Get templates by channel. */
export function getOutreachTemplatesByChannel(channel: string): OutreachMessageTemplate[] {
  return OUTREACH_TEMPLATES.filter(t => t.channel === channel && t.isActive);
}

/** Get templates by category. */
export function getOutreachTemplatesByCategory(category: string): OutreachMessageTemplate[] {
  return OUTREACH_TEMPLATES.filter(t => t.category === category && t.isActive);
}

/** Get a template by ID. */
export function getOutreachTemplateById(id: string): OutreachMessageTemplate | undefined {
  return OUTREACH_TEMPLATES.find(t => t.id === id);
}

/** Interpolate template variables with context values. */
export function interpolateTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
}
