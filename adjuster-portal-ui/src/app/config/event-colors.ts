import { StormEventType } from '../models/storm-event.model';

/** Canonical event-type color map — the ONE source of truth. */
export const EVENT_COLORS: Record<StormEventType, string> = {
  hail: '#E5533D',
  wind: '#2F6FED',
  hurricane: '#6D28D9',
  lightning: '#F39C12',
  tornado: '#991b1b',
};

/** ZIP boundary overlay color. */
export const ZIP_BOUNDARY_COLOR = '#10B981';

/** Severity badge colors. */
export const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  moderate: '#F39C12',
  high: '#E5533D',
  severe: '#C0392B',
  extreme: '#991b1b',
};

export const PROPERTIES_COLOR = '#8B5CF6';

export const SEVERITY_COLOR_DEFAULT = '#6b7280';

/** Damage-score label → color mapping for roof analysis badges. */
export const DAMAGE_SCORE_COLORS: Record<string, string> = {
  none: '#22c55e',
  low: '#84cc16',
  moderate: '#F39C12',
  high: '#E5533D',
  severe: '#991b1b',
};
