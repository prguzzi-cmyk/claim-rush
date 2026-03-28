/**
 * AI Claim Intake Bot — Session & Data Models
 *
 * Defines the intake session lifecycle, structured data capture,
 * and conversion logic for mapping intake data into existing
 * Lead / Claim / Client / File models.
 *
 * Does NOT duplicate:
 * - Lead model (maps into existing Lead fields)
 * - Claim model (maps into existing Claim fields via conversion)
 * - Client model (maps into existing Client fields)
 * - File/Document model (references existing file upload pattern)
 * - Task model (produces ClaimTask-compatible payloads)
 * - Communication model (produces ClaimCommunication-compatible entries)
 */

// ── Intake Session States ──────────────────────────────────────

export type IntakeSessionStatus =
  | 'started'
  | 'in_progress'
  | 'awaiting_documents'
  | 'awaiting_photos'
  | 'ready_for_review'
  | 'converted_to_claim'
  | 'abandoned'
  | 'followup_required';

export const INTAKE_STATUS_META: Record<IntakeSessionStatus, {
  label: string;
  icon: string;
  color: string;
  isTerminal: boolean;
}> = {
  started:              { label: 'Started',              icon: 'play_circle',      color: '#2196f3', isTerminal: false },
  in_progress:          { label: 'In Progress',          icon: 'pending',          color: '#ff9800', isTerminal: false },
  awaiting_documents:   { label: 'Awaiting Documents',   icon: 'upload_file',      color: '#e65100', isTerminal: false },
  awaiting_photos:      { label: 'Awaiting Photos',      icon: 'photo_camera',     color: '#7b1fa2', isTerminal: false },
  ready_for_review:     { label: 'Ready for Review',     icon: 'rate_review',      color: '#4caf50', isTerminal: false },
  converted_to_claim:   { label: 'Converted to Claim',   icon: 'check_circle',     color: '#2e7d32', isTerminal: true },
  abandoned:            { label: 'Abandoned',            icon: 'cancel',           color: '#9e9e9e', isTerminal: true },
  followup_required:    { label: 'Follow-Up Required',   icon: 'notification_important', color: '#c62828', isTerminal: false },
};

// ── Entry Path ─────────────────────────────────────────────────

export type IntakeEntryPath =
  | 'routed_lead'
  | 'voice_outreach'
  | 'client_portal'
  | 'manual_adjuster';

export const ENTRY_PATH_LABELS: Record<IntakeEntryPath, string> = {
  routed_lead:      'From Routed Lead',
  voice_outreach:   'From Voice Outreach',
  client_portal:    'Client Portal Self-Service',
  manual_adjuster:  'Adjuster-Initiated',
};

// ── Structured Intake Data ─────────────────────────────────────

/** Core data captured during intake.
 *  Fields map directly to existing Lead / Claim / Client model fields. */
export interface IntakeData {
  // Claimant / Contact (→ Lead.contact, Client)
  claimantName: string | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyZip: string | null;
  bestCallbackNumber: string | null;
  email: string | null;

  // Loss / Event (→ Claim.loss_date, Claim.peril, Lead fields)
  damageType: string | null;
  eventType: string | null;
  lossDate: string | null;
  lossDateApproximate: boolean;

  // Insurance (→ Claim.insurance_company, Claim.claim_number)
  insuranceCarrier: string | null;
  claimNumber: string | null;
  hasReportedClaim: boolean | null;
  policyNumber: string | null;

  // Inspection / Property (→ Claim fields)
  inspectionRequested: boolean | null;
  inspectionStatus: 'scheduled' | 'pending' | null;
  occupancyStatus: string | null;
  isHabitable: boolean | null;

  // Freeform
  damageDescription: string | null;
  additionalNotes: string | null;
}

export function createEmptyIntakeData(): IntakeData {
  return {
    claimantName: null, propertyAddress: null, propertyCity: null,
    propertyState: null, propertyZip: null, bestCallbackNumber: null,
    email: null, damageType: null, eventType: null, lossDate: null,
    lossDateApproximate: false, insuranceCarrier: null, claimNumber: null,
    hasReportedClaim: null, policyNumber: null, inspectionRequested: null, inspectionStatus: null,
    occupancyStatus: null, isHabitable: null, damageDescription: null,
    additionalNotes: null,
  };
}

// ── Intake Session ─────────────────────────────────────────────

/** A single intake session — one per prospect/lead intake attempt. */
export interface IntakeSession {
  id: string;
  status: IntakeSessionStatus;
  entryPath: IntakeEntryPath;
  intakeData: IntakeData;

  // Linking to existing records (no duplication)
  leadId: string | null;
  claimId: string | null;
  clientId: string | null;
  voiceCallId: string | null;

  // Progress tracking
  completedSteps: string[];
  currentStep: string | null;
  completionPercent: number;

  // AI Summary
  aiSummary: string | null;
  aiSummaryGeneratedAt: string | null;

  // Document readiness
  hasPolicy: boolean;
  hasPhotos: boolean;
  hasSupportingDocs: boolean;
  missingItems: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  convertedAt: string | null;
}

// ── Intake Steps (question flow) ───────────────────────────────

export type IntakeStepKey =
  | 'contact_info'
  | 'property_address'
  | 'loss_details'
  | 'insurance_info'
  | 'damage_description'
  | 'inspection_request'
  | 'document_upload'
  | 'photo_upload'
  | 'review_summary';

export interface IntakeStep {
  key: IntakeStepKey;
  label: string;
  icon: string;
  requiredFields: (keyof IntakeData)[];
  order: number;
}

export const INTAKE_STEPS: IntakeStep[] = [
  { key: 'contact_info',       label: 'Contact Information',   icon: 'person',             requiredFields: ['claimantName', 'bestCallbackNumber'], order: 1 },
  { key: 'property_address',   label: 'Property Address',      icon: 'home',               requiredFields: ['propertyAddress', 'propertyCity', 'propertyState', 'propertyZip'], order: 2 },
  { key: 'loss_details',       label: 'Loss Details',          icon: 'event',              requiredFields: ['damageType', 'eventType'], order: 3 },
  { key: 'insurance_info',     label: 'Insurance Information', icon: 'shield',             requiredFields: ['insuranceCarrier'], order: 4 },
  { key: 'damage_description', label: 'Damage Description',    icon: 'description',        requiredFields: ['damageDescription'], order: 5 },
  { key: 'inspection_request', label: 'Claim Inspection',      icon: 'event_available',    requiredFields: ['inspectionStatus'], order: 6 },
  { key: 'document_upload',    label: 'Upload Documents',      icon: 'upload_file',        requiredFields: [], order: 7 },
  { key: 'photo_upload',       label: 'Upload Photos',         icon: 'photo_camera',       requiredFields: [], order: 8 },
  { key: 'review_summary',     label: 'Review & Submit',       icon: 'rate_review',        requiredFields: [], order: 9 },
];

// ── Intake → Lead Mapping ──────────────────────────────────────

/** Produce a Lead-compatible partial object from intake data.
 *  Uses existing Lead model field names. */
export function intakeToLeadPayload(data: IntakeData): Record<string, any> {
  return {
    contact: {
      full_name: data.claimantName,
      phone_number: data.bestCallbackNumber,
      email: data.email,
      address_loss: data.propertyAddress,
      city_loss: data.propertyCity,
      state_loss: data.propertyState,
      zip_code_loss: data.propertyZip,
    },
    loss_date: data.lossDate,
    peril: data.eventType || data.damageType,
    insurance_company: data.insuranceCarrier,
    claim_number: data.claimNumber,
    policy_number: data.policyNumber,
    instructions_or_notes: data.damageDescription,
  };
}

// ── Intake → Claim Mapping ─────────────────────────────────────

/** Produce a Claim-compatible partial object from intake data.
 *  Uses existing Claim model field names for addClaim(). */
export function intakeToClaimPayload(data: IntakeData, clientId?: string): Record<string, any> {
  return {
    client_id: clientId || null,
    loss_date: data.lossDate,
    peril: data.eventType || data.damageType,
    insurance_company: data.insuranceCarrier,
    policy_number: data.policyNumber,
    claim_number: data.claimNumber,
    address_loss: data.propertyAddress,
    city_loss: data.propertyCity,
    state_loss: data.propertyState,
    zip_code_loss: data.propertyZip,
    instructions_or_notes: data.damageDescription,
    inhabitable: data.isHabitable,
    inspection_status: data.inspectionStatus || 'pending',
    status: 'active',
    current_phase: 'claim-reported',
    source: 'ai_intake',
  };
}

// ── Task Generation ────────────────────────────────────────────

/** Produce a ClaimTask-compatible payload from intake session state. */
export function intakeToTaskPayload(
  session: IntakeSession,
  taskType: 'review' | 'documents' | 'photos' | 'followup',
): Record<string, any> {
  const titles: Record<string, string> = {
    review:    `Review Intake: ${session.intakeData.claimantName || 'New Intake'}`,
    documents: `Request Documents: ${session.intakeData.claimantName || 'Intake'}`,
    photos:    `Request Photos: ${session.intakeData.claimantName || 'Intake'}`,
    followup:  `Follow Up: Incomplete Intake — ${session.intakeData.claimantName || 'Prospect'}`,
  };

  const descriptions: Record<string, string> = {
    review:    'AI intake session is ready for adjuster review. Check structured data and summary before converting to claim.',
    documents: 'Intake requires supporting documents (policy, proof of loss). Contact claimant to request.',
    photos:    'Intake requires damage photos. Contact claimant to request photo upload.',
    followup:  'Intake session was abandoned or incomplete. Re-engage the prospect.',
  };

  const priorities: Record<string, string> = {
    review: 'medium', documents: 'medium', photos: 'low', followup: 'high',
  };

  return {
    title: titles[taskType],
    description: descriptions[taskType],
    priority: priorities[taskType],
    task_type: `intake_${taskType}`,
    status: 'pending',
    related_claim_phase: 'claim-reported',
  };
}

// ── Communication Entry ────────────────────────────────────────

/** Produce a ClaimCommunication-compatible entry for the timeline. */
export function intakeToCommunicationEntry(
  session: IntakeSession,
  eventType: 'started' | 'resumed' | 'completed' | 'summary_generated' | 'converted',
): Record<string, any> {
  const subjects: Record<string, string> = {
    started:           'AI Intake Started',
    resumed:           'AI Intake Resumed',
    completed:         'AI Intake Completed',
    summary_generated: 'AI Intake Summary Generated',
    converted:         'Intake Converted to Claim',
  };

  const bodies: Record<string, string> = {
    started:           `Intake session started via ${ENTRY_PATH_LABELS[session.entryPath]}.`,
    resumed:           `Intake session resumed. Progress: ${session.completionPercent}%.`,
    completed:         `Intake session completed. ${session.missingItems.length > 0 ? 'Missing: ' + session.missingItems.join(', ') : 'All data collected.'}`,
    summary_generated: session.aiSummary || 'AI summary generated for adjuster review.',
    converted:         `Intake converted to claim workflow.`,
  };

  return {
    message_type: 'internal',
    subject: subjects[eventType],
    body: bodies[eventType],
    direction: 'outbound',
    channel: 'system',
    is_system_generated: true,
  };
}

// ── Portal Nudge Integration ───────────────────────────────────

/** Produce nudge data for client portal based on intake state. */
export function intakeToPortalNudge(session: IntakeSession): {
  nudgeType: string;
  title: string;
  message: string;
  priority: string;
} | null {
  switch (session.status) {
    case 'started':
    case 'in_progress':
      return {
        nudgeType: 'action_needed',
        title: 'Complete Your Claim Intake',
        message: `Your intake is ${session.completionPercent}% complete. Continue to submit your claim.`,
        priority: 'medium',
      };
    case 'awaiting_documents':
      return {
        nudgeType: 'document_required',
        title: 'Documents Needed',
        message: 'Please upload the required documents to proceed with your claim.',
        priority: 'high',
      };
    case 'awaiting_photos':
      return {
        nudgeType: 'document_required',
        title: 'Photos Needed',
        message: 'Please upload photos of the damage to help us assess your claim.',
        priority: 'medium',
      };
    case 'followup_required':
      return {
        nudgeType: 'action_needed',
        title: 'Your Claim Needs Attention',
        message: 'Your intake is incomplete. Please log in to continue.',
        priority: 'high',
      };
    default:
      return null;
  }
}
