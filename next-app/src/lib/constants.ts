export const PERIOD_TYPES = {
  ALL_TIME: "all-time",
  CURRENT_YEAR: "current-year",
  CURRENT_MONTH: "current-month",
  CURRENT_WEEK: "current-week",
  LAST_MONTH: "last-month",
  LAST_WEEK: "last-week",
  LAST_180_DAYS: "last-180-days",
  LAST_90_DAYS: "last-90-days",
  LAST_30_DAYS: "last-30-days",
  LAST_7_DAYS: "last-7-days",
  CUSTOM_RANGE: "custom-range",
} as const;

export type PeriodType = (typeof PERIOD_TYPES)[keyof typeof PERIOD_TYPES];

export const DEFAULT_PERIOD: PeriodType = PERIOD_TYPES.CURRENT_YEAR;

export const PERIOD_LABELS: Record<PeriodType, string> = {
  "all-time": "All Time",
  "current-year": "Current Year",
  "current-month": "Current Month",
  "current-week": "Current Week",
  "last-month": "Last Month",
  "last-week": "Last Week",
  "last-180-days": "Last 180 Days",
  "last-90-days": "Last 90 Days",
  "last-30-days": "Last 30 Days",
  "last-7-days": "Last 7 Days",
  "custom-range": "Custom Range",
};
