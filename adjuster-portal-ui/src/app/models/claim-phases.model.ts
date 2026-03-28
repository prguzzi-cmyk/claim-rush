export const ESCALATION_PATHS = [
    { slug: 'none', label: 'None', icon: 'remove_circle_outline', color: '' },
    { slug: 'appraisal', label: 'Appraisal', icon: 'gavel', color: '#e67e22' },
    { slug: 'umpire', label: 'Umpire', icon: 'sports', color: '#8e44ad' },
    { slug: 'attorney-litigation', label: 'Attorney / Litigation', icon: 'balance', color: '#c0392b' },
];

export const PHASE_MILESTONES = [
    { key: 'intake',         label: 'Intake',                   clientLabel: 'Claim Reported',       icon: 'assignment',   slugs: ['claim-reported'] },
    { key: 'signed',         label: 'Signed / Opened',          clientLabel: 'Signed / Opened',      icon: 'draw',         slugs: ['scope'] },
    { key: 'inspection',     label: 'Inspection / Scope',       clientLabel: 'Inspection Completed', icon: 'search',       slugs: ['scope-complete'] },
    { key: 'estimate',       label: 'Estimate Complete',        clientLabel: 'Estimate Submitted',   icon: 'calculate',    slugs: ['estimate', 'estimate-complete'] },
    { key: 'carrier_review', label: 'Carrier Review',           clientLabel: 'Carrier Review',       icon: 'rate_review',  slugs: ['insurance-company-inspection', 'insurance-company-inspection-complete'] },
    { key: 'supplement',     label: 'Supplement / Negotiation', clientLabel: 'Supplement Phase',     icon: 'handshake',    slugs: ['waiting-for-initial-payment', 'initial-payment-received', 'supplement-payment-received', 'appraisal', 'mediation', 'lawsuit'] },
    { key: 'payment',        label: 'Payment / Reinspection',   clientLabel: 'Payment Issued',       icon: 'payments',     slugs: ['final-payment-received', 'check-at-bank'] },
    { key: 'closed',         label: 'Closed / Resolved',        clientLabel: 'Claim Closed',         icon: 'check_circle', slugs: ['claim-closed', 'client-cancelled'] },
];

export function getPhaseIndex(currentPhaseSlug: string): number {
    if (!currentPhaseSlug) return -1;
    const slug = currentPhaseSlug.toLowerCase().replace(/\s+/g, '-');
    return PHASE_MILESTONES.findIndex(m => m.slugs.includes(slug));
}

export function getPhaseLabel(currentPhaseSlug: string, useClientLabel = false): string {
    if (!currentPhaseSlug) return 'Unknown';
    const slug = currentPhaseSlug.toLowerCase().replace(/\s+/g, '-');
    const milestone = PHASE_MILESTONES.find(m => m.slugs.includes(slug));
    if (!milestone) return currentPhaseSlug;
    return useClientLabel ? milestone.clientLabel : milestone.label;
}
