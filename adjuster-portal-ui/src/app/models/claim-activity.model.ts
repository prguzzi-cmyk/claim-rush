export const ACTIVITY_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  'phase-changed':          { icon: 'swap_horiz',    color: '#1976d2', label: 'Phase Changed' },
  'escalation-changed':     { icon: 'trending_up',   color: '#e67e22', label: 'Escalation Changed' },
  'sub-status-changed':     { icon: 'label',         color: '#8e44ad', label: 'Sub-Status Changed' },
  'supplement-email-sent':  { icon: 'email',         color: '#00897b', label: 'Supplement Email Sent' },
  'claim-created':          { icon: 'add_circle',    color: '#4caf50', label: 'Claim Created' },
  'document-uploaded':      { icon: 'upload_file',   color: '#0288d1', label: 'Document Uploaded' },
  'comment-added':          { icon: 'chat',          color: '#7b1fa2', label: 'Message Added' },
  'payment-issued':         { icon: 'payments',      color: '#2e7d32', label: 'Payment Issued' },
  'payment-updated':        { icon: 'update',        color: '#558b2f', label: 'Payment Updated' },
  'claim-assigned':         { icon: 'person_add',    color: '#5d4037', label: 'Claim Assigned' },
  'task-created':           { icon: 'add_task',      color: '#1565c0', label: 'Task Created' },
  'task-status-changed':    { icon: 'published_with_changes', color: '#0277bd', label: 'Task Status Changed' },
  'task-assigned':          { icon: 'assignment_ind', color: '#00838f', label: 'Task Assigned' },
  'task-completed':         { icon: 'task_alt',      color: '#2e7d32', label: 'Task Completed' },
  'carrier-estimate-received': { icon: 'receipt_long', color: '#ef6c00', label: 'Carrier Estimate Received' },
};

export function getActivityIcon(type: string): string {
  return ACTIVITY_ICONS[type]?.icon || 'info';
}

export function getActivityColor(type: string): string {
  return ACTIVITY_ICONS[type]?.color || '#757575';
}

export function getActivityLabel(type: string): string {
  return ACTIVITY_ICONS[type]?.label || type;
}
