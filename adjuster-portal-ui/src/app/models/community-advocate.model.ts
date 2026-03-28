// ── Community Advocate Module Models ──

// ── Role-Based Access Types ──
export type CaRole = 'advocate' | 'chapter-president' | 'regional-vp' | 'admin';

export const ROLE_TO_CA_ROLE: Record<string, CaRole> = {
  'agent': 'advocate',
  'call-center-agent': 'advocate',
  'chapter-president': 'chapter-president',
  'regional-vp': 'regional-vp',
  'admin': 'admin',
  'super-admin': 'admin',
};

export const CA_ROLE_TITLES: Record<CaRole, string> = {
  'advocate': 'My Community Outreach',
  'chapter-president': 'Chapter Outreach',
  'regional-vp': 'Regional Outreach',
  'admin': 'Community Advocate',
};

export const CA_ROLE_SUBTITLES: Record<CaRole, string> = {
  'advocate': 'Your personal outreach dashboard',
  'chapter-president': 'Manage your chapter\'s outreach team',
  'regional-vp': 'Regional outreach oversight',
  'admin': 'Trust-building outreach center for licensed public adjusters',
};

export interface AdvocateProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  status: 'active' | 'inactive' | 'pending';
  territories: string[];
  specialties: string[];
  bio: string;
  metrics: AdvocateMetrics;
  created_at: string;
  updated_at: string;
}

export interface AdvocateMetrics {
  referrals_generated: number;
  community_events: number;
  homeowners_helped: number;
  satisfaction_score: number;
  active_campaigns: number;
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  filters: AudienceFilter[];
  estimated_reach: number;
  created_at: string;
}

export interface AudienceFilter {
  field: 'state' | 'county' | 'zip' | 'property_type' | 'claim_history' | 'homeowner_age';
  operator: 'equals' | 'contains' | 'in' | 'greater_than' | 'less_than';
  value: string | string[] | number;
}

export interface TerritoryOverlayData {
  id: string;
  territory_name: string;
  advocate_id: string;
  advocate_name: string;
  center: { lat: number; lng: number };
  radius_miles: number;
  saturation: number;
  homeowner_count: number;
  active_campaigns: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  audience_segment_id: string;
  audience_segment_name: string;
  steps: CampaignStep[];
  created_at: string;
  updated_at: string;
  metrics: CampaignMetrics;
}

export interface CampaignStep {
  id: string;
  order: number;
  channel: 'email' | 'sms' | 'social' | 'direct_mail' | 'phone' | 'in_person';
  template_id: string;
  template_name: string;
  delay_days: number;
  subject?: string;
}

export interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
}

export interface OutreachTemplate {
  id: string;
  name: string;
  channel: 'email' | 'sms' | 'social' | 'direct_mail' | 'phone' | 'in_person';
  subject?: string;
  body: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface ChannelConfig {
  id: string;
  channel: 'email' | 'sms' | 'social' | 'direct_mail' | 'phone' | 'in_person';
  label: string;
  icon: string;
  is_enabled: boolean;
  daily_limit: number;
  templates_count: number;
  description: string;
}

export interface CommunityPage {
  id: string;
  title: string;
  slug: string;
  advocate_id: string;
  advocate_name: string;
  content: string;
  is_published: boolean;
  views: number;
  leads_generated: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerOffer {
  id: string;
  partner_name: string;
  category: 'home_services' | 'insurance' | 'legal' | 'restoration' | 'financial';
  title: string;
  description: string;
  discount_value: string;
  expiry_date: string;
  is_active: boolean;
  redemptions: number;
}

export interface EducationContent {
  id: string;
  title: string;
  category: 'article' | 'video' | 'checklist' | 'infographic';
  topic: string;
  summary: string;
  content: string;
  thumbnail: string;
  views: number;
  shares: number;
  is_published: boolean;
  created_at: string;
}

export interface SocialPost {
  id: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'twitter';
  content: string;
  image_url?: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_at?: string;
  published_at?: string;
  engagement: SocialEngagement;
}

export interface SocialEngagement {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

export interface AdCreative {
  id: string;
  name: string;
  platform: 'facebook' | 'google' | 'instagram';
  headline: string;
  body: string;
  cta: string;
  image_url: string;
  status: 'draft' | 'active' | 'paused';
  budget_daily: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: 'new_lead' | 'event_signup' | 'page_visit' | 'referral_received' | 'claim_filed';
  trigger_label: string;
  actions: AutomationAction[];
  is_active: boolean;
  executions: number;
  last_executed_at?: string;
  created_at: string;
}

export interface AutomationAction {
  type: 'send_email' | 'send_sms' | 'assign_advocate' | 'create_task' | 'add_to_segment';
  label: string;
  config: Record<string, string>;
}

export interface AdvocacyKpiSummary {
  total_advocates: number;
  active_campaigns: number;
  total_referrals: number;
  homeowners_reached: number;
  community_events: number;
  avg_satisfaction: number;
  referral_trend: AdvocacyChartData[];
}

export interface AdvocacyChartData {
  name: string;
  value: number;
}

export interface ChannelPerformance {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  conversion_rate: number;
}

export interface ComplianceDisclaimer {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'email' | 'sms' | 'advertising' | 'social';
  is_required: boolean;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export interface ComplianceChecklist {
  id: string;
  name: string;
  items: ComplianceCheckItem[];
  completion_percentage: number;
  last_reviewed_at: string;
}

export interface ComplianceCheckItem {
  id: string;
  label: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
}
