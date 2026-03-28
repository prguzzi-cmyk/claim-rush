import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  AdvocateProfile, AudienceSegment, TerritoryOverlayData, Campaign, CampaignStep,
  OutreachTemplate, ChannelConfig, CommunityPage, PartnerOffer, EducationContent,
  SocialPost, AdCreative, AutomationRule, AdvocacyKpiSummary, AdvocacyChartData,
  ChannelPerformance, ComplianceDisclaimer, ComplianceChecklist, CaRole
} from '../models/community-advocate.model';

// ── Mock Seed Data ──

const MOCK_ADVOCATES: AdvocateProfile[] = [
  { id: 'adv-1', name: 'Maria Santos', email: 'maria@upa.org', phone: '(305) 555-0101', avatar: '', status: 'active', territories: ['Miami-Dade County', 'Broward County'], specialties: ['Hurricane Damage', 'Flood Claims'], bio: 'Bilingual community advocate specializing in hurricane and flood damage claims across South Florida.', metrics: { referrals_generated: 42, community_events: 8, homeowners_helped: 156, satisfaction_score: 4.9, active_campaigns: 3 }, created_at: '2024-06-15', updated_at: '2025-03-01' },
  { id: 'adv-2', name: 'James Blackwell', email: 'james@upa.org', phone: '(713) 555-0202', avatar: '', status: 'active', territories: ['Harris County', 'Fort Bend County'], specialties: ['Hail Damage', 'Wind Claims'], bio: 'Former contractor turned public adjuster advocate, helping Houston-area homeowners recover from storm damage.', metrics: { referrals_generated: 35, community_events: 5, homeowners_helped: 112, satisfaction_score: 4.7, active_campaigns: 2 }, created_at: '2024-08-20', updated_at: '2025-02-15' },
  { id: 'adv-3', name: 'Linda Park', email: 'linda@upa.org', phone: '(407) 555-0303', avatar: '', status: 'active', territories: ['Orange County', 'Seminole County'], specialties: ['Roof Claims', 'Water Damage'], bio: 'Dedicated community advocate in Central Florida with deep roots in homeowner education and fair claims advocacy.', metrics: { referrals_generated: 28, community_events: 12, homeowners_helped: 98, satisfaction_score: 4.8, active_campaigns: 2 }, created_at: '2024-09-10', updated_at: '2025-03-05' },
  { id: 'adv-4', name: 'Carlos Rivera', email: 'carlos@upa.org', phone: '(214) 555-0404', avatar: '', status: 'active', territories: ['Dallas County', 'Tarrant County'], specialties: ['Fire Damage', 'Storm Claims'], bio: 'Passionate about helping DFW families navigate insurance claims after fire and storm events.', metrics: { referrals_generated: 19, community_events: 4, homeowners_helped: 67, satisfaction_score: 4.6, active_campaigns: 1 }, created_at: '2024-11-01', updated_at: '2025-01-20' },
  { id: 'adv-5', name: 'Aisha Johnson', email: 'aisha@upa.org', phone: '(504) 555-0505', avatar: '', status: 'pending', territories: ['Orleans Parish'], specialties: ['Flood Claims', 'Mold Remediation'], bio: 'New Orleans advocate focused on flood recovery and mold-related claims for underserved communities.', metrics: { referrals_generated: 8, community_events: 2, homeowners_helped: 23, satisfaction_score: 4.5, active_campaigns: 1 }, created_at: '2025-01-15', updated_at: '2025-02-28' },
  { id: 'adv-6', name: 'Thomas Chen', email: 'thomas@upa.org', phone: '(310) 555-0606', avatar: '', status: 'inactive', territories: ['Los Angeles County'], specialties: ['Earthquake Damage', 'Wildfire Claims'], bio: 'Experienced public adjuster in Southern California specializing in earthquake and wildfire damage.', metrics: { referrals_generated: 15, community_events: 3, homeowners_helped: 45, satisfaction_score: 4.4, active_campaigns: 0 }, created_at: '2024-07-01', updated_at: '2024-12-10' },
];

const MOCK_SEGMENTS: AudienceSegment[] = [
  { id: 'seg-1', name: 'South Florida Homeowners', description: 'Homeowners in hurricane-prone South Florida counties', filters: [{ field: 'state', operator: 'equals', value: 'FL' }, { field: 'county', operator: 'in', value: ['Miami-Dade', 'Broward', 'Palm Beach'] }], estimated_reach: 12500, created_at: '2024-10-01' },
  { id: 'seg-2', name: 'Texas Storm Belt', description: 'Property owners in hail and wind-prone Texas regions', filters: [{ field: 'state', operator: 'equals', value: 'TX' }, { field: 'property_type', operator: 'equals', value: 'single_family' }], estimated_reach: 8700, created_at: '2024-11-15' },
  { id: 'seg-3', name: 'Recent Claim Filers', description: 'Homeowners who filed claims in the last 12 months', filters: [{ field: 'claim_history', operator: 'greater_than', value: 0 }], estimated_reach: 3200, created_at: '2025-01-10' },
];

const MOCK_TERRITORIES: TerritoryOverlayData[] = [
  { id: 'ter-1', territory_name: 'Miami-Dade County', advocate_id: 'adv-1', advocate_name: 'Maria Santos', center: { lat: 25.7617, lng: -80.1918 }, radius_miles: 25, saturation: 0.72, homeowner_count: 4500, active_campaigns: 3 },
  { id: 'ter-2', territory_name: 'Harris County', advocate_id: 'adv-2', advocate_name: 'James Blackwell', center: { lat: 29.7604, lng: -95.3698 }, radius_miles: 30, saturation: 0.58, homeowner_count: 6200, active_campaigns: 2 },
  { id: 'ter-3', territory_name: 'Orange County', advocate_id: 'adv-3', advocate_name: 'Linda Park', center: { lat: 28.5383, lng: -81.3792 }, radius_miles: 20, saturation: 0.65, homeowner_count: 3800, active_campaigns: 2 },
  { id: 'ter-4', territory_name: 'Dallas County', advocate_id: 'adv-4', advocate_name: 'Carlos Rivera', center: { lat: 32.7767, lng: -96.7970 }, radius_miles: 22, saturation: 0.41, homeowner_count: 5100, active_campaigns: 1 },
];

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: 'cmp-1', name: 'Hurricane Season Prep', status: 'active', audience_segment_id: 'seg-1', audience_segment_name: 'South Florida Homeowners', steps: [{ id: 's1', order: 1, channel: 'email', template_id: 'tpl-1', template_name: 'Hurricane Prep Intro', delay_days: 0, subject: 'Is Your Home Ready for Hurricane Season?' }, { id: 's2', order: 2, channel: 'sms', template_id: 'tpl-5', template_name: 'Hurricane Checklist SMS', delay_days: 3 }, { id: 's3', order: 3, channel: 'email', template_id: 'tpl-2', template_name: 'Free Home Assessment Offer', delay_days: 7, subject: 'Free Home Assessment — Limited Spots' }], created_at: '2025-01-15', updated_at: '2025-03-01', metrics: { sent: 4200, delivered: 4050, opened: 1890, clicked: 620, converted: 85 } },
  { id: 'cmp-2', name: 'Hail Season Awareness', status: 'active', audience_segment_id: 'seg-2', audience_segment_name: 'Texas Storm Belt', steps: [{ id: 's4', order: 1, channel: 'email', template_id: 'tpl-3', template_name: 'Hail Damage Guide', delay_days: 0, subject: 'Hail Season Is Here — Know Your Rights' }, { id: 's5', order: 2, channel: 'direct_mail', template_id: 'tpl-6', template_name: 'Hail Postcard', delay_days: 5 }], created_at: '2025-02-01', updated_at: '2025-02-28', metrics: { sent: 2800, delivered: 2650, opened: 1100, clicked: 340, converted: 42 } },
  { id: 'cmp-3', name: 'Claims Follow-up Nurture', status: 'paused', audience_segment_id: 'seg-3', audience_segment_name: 'Recent Claim Filers', steps: [{ id: 's6', order: 1, channel: 'email', template_id: 'tpl-4', template_name: 'Claim Status Check', delay_days: 0, subject: 'How Is Your Claim Going?' }], created_at: '2025-01-20', updated_at: '2025-02-15', metrics: { sent: 1200, delivered: 1150, opened: 580, clicked: 195, converted: 28 } },
  { id: 'cmp-4', name: 'Community Workshop Series', status: 'draft', audience_segment_id: 'seg-1', audience_segment_name: 'South Florida Homeowners', steps: [], created_at: '2025-03-01', updated_at: '2025-03-01', metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 } },
];

const MOCK_TEMPLATES: OutreachTemplate[] = [
  { id: 'tpl-1', name: 'Hurricane Prep Intro', channel: 'email', subject: 'Is Your Home Ready for Hurricane Season?', body: 'Dear {{name}},\n\nHurricane season is approaching. As your local UPA community advocate, I want to make sure you and your family are prepared...', category: 'seasonal', is_active: true, created_at: '2024-12-01' },
  { id: 'tpl-2', name: 'Free Home Assessment Offer', channel: 'email', subject: 'Free Home Assessment — Limited Spots', body: 'Hi {{name}},\n\nWe\'re offering complimentary home assessments to homeowners in {{territory}}. This no-obligation review helps identify...', category: 'offer', is_active: true, created_at: '2024-12-15' },
  { id: 'tpl-3', name: 'Hail Damage Guide', channel: 'email', subject: 'Hail Season Is Here — Know Your Rights', body: 'Dear {{name}},\n\nHail season brings unique challenges for homeowners. Here\'s what you need to know about documenting damage and filing claims...', category: 'education', is_active: true, created_at: '2025-01-10' },
  { id: 'tpl-4', name: 'Claim Status Check', channel: 'email', subject: 'How Is Your Claim Going?', body: 'Hi {{name}},\n\nWe noticed you recently filed a claim. As a nonprofit-backed advocate, we\'re here to ensure you receive fair treatment...', category: 'followup', is_active: true, created_at: '2025-01-20' },
  { id: 'tpl-5', name: 'Hurricane Checklist SMS', channel: 'sms', body: 'Hi {{name}}! Your UPA advocate here. Hurricane season starts June 1. Get your free preparedness checklist: {{link}}', category: 'seasonal', is_active: true, created_at: '2025-01-15' },
  { id: 'tpl-6', name: 'Hail Postcard', channel: 'direct_mail', body: 'HAIL DAMAGE? You have rights.\nDon\'t let your insurance company underpay your claim.\nContact your local UPA advocate: {{advocate_phone}}', category: 'awareness', is_active: true, created_at: '2025-02-01' },
  { id: 'tpl-7', name: 'Welcome New Referral', channel: 'email', subject: 'Welcome — Your Neighbor Recommended Us', body: 'Hi {{name}},\n\n{{referrer_name}} recommended that we reach out. As a UPA community advocate, I help homeowners like you...', category: 'referral', is_active: true, created_at: '2025-02-10' },
  { id: 'tpl-8', name: 'Event Invite SMS', channel: 'sms', body: 'You\'re invited! Free homeowner workshop: "{{event_title}}" on {{event_date}} at {{event_location}}. RSVP: {{link}}', category: 'event', is_active: true, created_at: '2025-02-20' },
];

const MOCK_CHANNELS: ChannelConfig[] = [
  { id: 'ch-1', channel: 'email', label: 'Email', icon: 'email', is_enabled: true, daily_limit: 500, templates_count: 5, description: 'Personalized email outreach with merge fields and tracking' },
  { id: 'ch-2', channel: 'sms', label: 'SMS', icon: 'sms', is_enabled: true, daily_limit: 200, templates_count: 2, description: 'Short text messages for timely alerts and reminders' },
  { id: 'ch-3', channel: 'social', label: 'Social Media', icon: 'share', is_enabled: true, daily_limit: 20, templates_count: 0, description: 'Organic social posts across Facebook, Instagram, and LinkedIn' },
  { id: 'ch-4', channel: 'direct_mail', label: 'Direct Mail', icon: 'local_post_office', is_enabled: true, daily_limit: 100, templates_count: 1, description: 'Physical postcards and letters for high-impact touchpoints' },
  { id: 'ch-5', channel: 'phone', label: 'Phone', icon: 'phone', is_enabled: false, daily_limit: 50, templates_count: 0, description: 'Personal phone calls with call scripts and logging' },
  { id: 'ch-6', channel: 'in_person', label: 'In Person', icon: 'people', is_enabled: false, daily_limit: 10, templates_count: 0, description: 'Door-to-door visits and community event interactions' },
];

const MOCK_COMMUNITY_PAGES: CommunityPage[] = [
  { id: 'cp-1', title: 'Maria Santos — Your South Florida Advocate', slug: 'maria-santos-south-florida', advocate_id: 'adv-1', advocate_name: 'Maria Santos', content: '<h2>Welcome</h2><p>I help South Florida homeowners navigate insurance claims with confidence...</p>', is_published: true, views: 1240, leads_generated: 18, created_at: '2024-11-01', updated_at: '2025-02-15' },
  { id: 'cp-2', title: 'James Blackwell — Houston Area Claims Expert', slug: 'james-blackwell-houston', advocate_id: 'adv-2', advocate_name: 'James Blackwell', content: '<h2>About Me</h2><p>With 15 years of construction experience, I understand what it takes to properly assess storm damage...</p>', is_published: true, views: 890, leads_generated: 12, created_at: '2024-12-01', updated_at: '2025-01-20' },
  { id: 'cp-3', title: 'Linda Park — Central Florida Community Advocate', slug: 'linda-park-central-florida', advocate_id: 'adv-3', advocate_name: 'Linda Park', content: '<h2>Hello Neighbor</h2><p>I believe every homeowner deserves fair treatment from their insurance company...</p>', is_published: false, views: 320, leads_generated: 4, created_at: '2025-01-15', updated_at: '2025-03-01' },
];

const MOCK_PARTNER_OFFERS: PartnerOffer[] = [
  { id: 'po-1', partner_name: 'RoofRight Pro', category: 'home_services', title: '15% Off Roof Inspections', description: 'Get a professional roof inspection at a discount when referred by your UPA advocate.', discount_value: '15%', expiry_date: '2025-06-30', is_active: true, redemptions: 34 },
  { id: 'po-2', partner_name: 'CleanAir Restoration', category: 'restoration', title: 'Free Mold Assessment', description: 'Complimentary mold testing and assessment for UPA community members.', discount_value: 'Free', expiry_date: '2025-12-31', is_active: true, redemptions: 21 },
  { id: 'po-3', partner_name: 'HomeGuard Legal', category: 'legal', title: 'Free 30-Min Consultation', description: 'Talk to an insurance claims attorney at no cost — understand your legal options.', discount_value: 'Free', expiry_date: '2025-09-30', is_active: true, redemptions: 45 },
  { id: 'po-4', partner_name: 'SafeHaven Insurance', category: 'insurance', title: 'Policy Review + Quote', description: 'Free comprehensive policy review to ensure you have adequate coverage.', discount_value: 'Free', expiry_date: '2025-08-31', is_active: true, redemptions: 18 },
  { id: 'po-5', partner_name: 'BrightStar Financial', category: 'financial', title: '$200 Off Emergency Repairs', description: 'Up to $200 credit for emergency home repairs while your claim is processed.', discount_value: '$200', expiry_date: '2025-07-31', is_active: false, redemptions: 12 },
];

const MOCK_EDUCATION: EducationContent[] = [
  { id: 'ed-1', title: 'Understanding Your Homeowner\'s Insurance Policy', category: 'article', topic: 'Insurance Basics', summary: 'A comprehensive guide to reading and understanding your homeowner\'s insurance policy.', content: 'Your homeowner\'s insurance policy is a contract...', thumbnail: '', views: 2340, shares: 156, is_published: true, created_at: '2024-10-01' },
  { id: 'ed-2', title: 'What to Do After Storm Damage', category: 'checklist', topic: 'Storm Damage', summary: 'Step-by-step checklist for homeowners after experiencing storm damage.', content: '1. Ensure safety first\n2. Document all damage with photos...', thumbnail: '', views: 3120, shares: 289, is_published: true, created_at: '2024-10-15' },
  { id: 'ed-3', title: 'How Public Adjusters Help You', category: 'video', topic: 'Public Adjusters', summary: 'Learn how a licensed public adjuster advocates for your best interests.', content: 'https://example.com/video-embed', thumbnail: '', views: 1890, shares: 112, is_published: true, created_at: '2024-11-01' },
  { id: 'ed-4', title: 'Hurricane Preparedness Infographic', category: 'infographic', topic: 'Hurricane Prep', summary: 'Visual guide to preparing your home and family for hurricane season.', content: '', thumbnail: '', views: 4500, shares: 678, is_published: true, created_at: '2024-11-15' },
  { id: 'ed-5', title: 'Common Insurance Claim Mistakes', category: 'article', topic: 'Claims Tips', summary: 'Avoid these 10 common mistakes when filing an insurance claim.', content: 'Filing an insurance claim can be overwhelming...', thumbnail: '', views: 2780, shares: 203, is_published: true, created_at: '2024-12-01' },
  { id: 'ed-6', title: 'Water Damage: Act Fast', category: 'article', topic: 'Water Damage', summary: 'Why quick action matters when dealing with water damage in your home.', content: 'Water damage is one of the most common claims...', thumbnail: '', views: 1560, shares: 89, is_published: true, created_at: '2025-01-10' },
  { id: 'ed-7', title: 'Documenting Damage Like a Pro', category: 'video', topic: 'Documentation', summary: 'Video tutorial on properly documenting property damage for your claim.', content: 'https://example.com/doc-video', thumbnail: '', views: 920, shares: 45, is_published: true, created_at: '2025-02-01' },
  { id: 'ed-8', title: 'Fire Damage Recovery Timeline', category: 'checklist', topic: 'Fire Damage', summary: 'What to expect and do week by week after a house fire.', content: 'Week 1: Safety and immediate needs...', thumbnail: '', views: 680, shares: 34, is_published: false, created_at: '2025-02-20' },
];

const MOCK_SOCIAL_POSTS: SocialPost[] = [
  { id: 'sp-1', platform: 'facebook', content: 'Did you know that 60% of homeowners are underinsured? Our free policy review can help you understand your coverage. Contact your local UPA advocate today!', status: 'published', published_at: '2025-02-15', engagement: { likes: 45, comments: 12, shares: 8, reach: 1200 } },
  { id: 'sp-2', platform: 'instagram', content: 'Storm season is coming. Are you prepared? Swipe for our 5-step preparedness checklist. #HomeownerTips #StormPrep #UPAAdvocate', image_url: '', status: 'published', published_at: '2025-02-20', engagement: { likes: 89, comments: 5, shares: 23, reach: 2100 } },
  { id: 'sp-3', platform: 'linkedin', content: 'Proud to announce that UPA advocates helped 500+ homeowners recover over $2.3M in underpaid claims last quarter. The power of nonprofit-backed advocacy.', status: 'published', published_at: '2025-03-01', engagement: { likes: 120, comments: 18, shares: 34, reach: 3400 } },
  { id: 'sp-4', platform: 'facebook', content: 'Join us this Saturday for a FREE Homeowner Workshop at the Miami Community Center. Learn about your insurance rights and how to protect your home.', status: 'scheduled', scheduled_at: '2025-03-15', engagement: { likes: 0, comments: 0, shares: 0, reach: 0 } },
  { id: 'sp-5', platform: 'twitter', content: 'Your insurance company works for their shareholders. We work for YOU. That\'s the UPA difference. #HomeownerAdvocacy #FairClaims', status: 'draft', engagement: { likes: 0, comments: 0, shares: 0, reach: 0 } },
];

const MOCK_AD_CREATIVES: AdCreative[] = [
  { id: 'ac-1', name: 'Hurricane Season CTA', platform: 'facebook', headline: 'Hurricane Season Is Coming', body: 'Don\'t wait until it\'s too late. Get a free home assessment from your local UPA advocate.', cta: 'Get Free Assessment', image_url: '', status: 'active', budget_daily: 25, impressions: 15000, clicks: 420, conversions: 32 },
  { id: 'ac-2', name: 'Roof Damage Search Ad', platform: 'google', headline: 'Roof Damage? Get Help Now', body: 'Licensed public adjusters helping homeowners get fair settlements. Free consultation.', cta: 'Call Now', image_url: '', status: 'active', budget_daily: 35, impressions: 22000, clicks: 680, conversions: 48 },
  { id: 'ac-3', name: 'Community Trust IG Ad', platform: 'instagram', headline: 'Your Neighbor\'s Trusted Advocate', body: 'Nonprofit-backed. Community-focused. Here to help you navigate your insurance claim.', cta: 'Learn More', image_url: '', status: 'paused', budget_daily: 15, impressions: 8000, clicks: 190, conversions: 12 },
];

const MOCK_AUTOMATION_RULES: AutomationRule[] = [
  { id: 'aut-1', name: 'Welcome New Lead', trigger: 'new_lead', trigger_label: 'New Lead Created', actions: [{ type: 'send_email', label: 'Send Welcome Email', config: { template_id: 'tpl-7' } }, { type: 'assign_advocate', label: 'Auto-Assign Advocate', config: { assignment_rule: 'territory' } }], is_active: true, executions: 234, last_executed_at: '2025-03-10', created_at: '2024-11-01' },
  { id: 'aut-2', name: 'Event Follow-up', trigger: 'event_signup', trigger_label: 'Event Sign-up', actions: [{ type: 'send_sms', label: 'Send Confirmation SMS', config: { template_id: 'tpl-8' } }, { type: 'create_task', label: 'Create Follow-up Task', config: { task_title: 'Follow up after event' } }], is_active: true, executions: 89, last_executed_at: '2025-03-08', created_at: '2024-12-01' },
  { id: 'aut-3', name: 'Referral Thank-You', trigger: 'referral_received', trigger_label: 'Referral Received', actions: [{ type: 'send_email', label: 'Send Thank-You Email', config: { template_id: 'tpl-7' } }], is_active: true, executions: 56, last_executed_at: '2025-03-05', created_at: '2025-01-15' },
  { id: 'aut-4', name: 'Claim Filed Nurture', trigger: 'claim_filed', trigger_label: 'Claim Filed', actions: [{ type: 'add_to_segment', label: 'Add to Recent Filers', config: { segment_id: 'seg-3' } }, { type: 'send_email', label: 'Send Claims Guide', config: { template_id: 'tpl-4' } }], is_active: false, executions: 12, last_executed_at: '2025-02-20', created_at: '2025-02-01' },
];

const MOCK_DISCLAIMERS: ComplianceDisclaimer[] = [
  { id: 'dis-1', title: 'General Email Footer', content: 'This message is sent on behalf of United Policyholders Advocate, a nonprofit-backed organization. You are receiving this because...', category: 'email', is_required: true, is_approved: true, approved_by: 'Admin', approved_at: '2024-10-01', created_at: '2024-09-15' },
  { id: 'dis-2', title: 'SMS Opt-Out Notice', content: 'Reply STOP to unsubscribe. Msg & data rates may apply. Visit {{link}} for help.', category: 'sms', is_required: true, is_approved: true, approved_by: 'Admin', approved_at: '2024-10-01', created_at: '2024-09-15' },
  { id: 'dis-3', title: 'Advertising Disclosure', content: 'UPA advocates are licensed public adjusters. Results may vary. Free consultations do not guarantee claim outcomes.', category: 'advertising', is_required: true, is_approved: true, approved_by: 'Admin', approved_at: '2024-11-01', created_at: '2024-10-15' },
  { id: 'dis-4', title: 'Social Media Disclaimer', content: 'Posts reflect the views of individual UPA advocates. Not legal or financial advice. Consult a professional.', category: 'social', is_required: false, is_approved: true, approved_by: 'Admin', approved_at: '2024-12-01', created_at: '2024-11-15' },
  { id: 'dis-5', title: 'Direct Mail CAN-SPAM Compliance', content: 'You may opt out of future mailings by contacting us at {{address}} or calling {{phone}}.', category: 'general', is_required: true, is_approved: false, created_at: '2025-02-01' },
];

const MOCK_CHECKLIST: ComplianceChecklist = {
  id: 'cl-1',
  name: 'Community Advocate Compliance Checklist',
  items: [
    { id: 'cli-1', label: 'Email templates include required opt-out footer', is_completed: true, completed_at: '2025-01-15', completed_by: 'Admin' },
    { id: 'cli-2', label: 'SMS messages include STOP instructions', is_completed: true, completed_at: '2025-01-15', completed_by: 'Admin' },
    { id: 'cli-3', label: 'Advertising materials reviewed by legal', is_completed: true, completed_at: '2025-02-01', completed_by: 'Legal Team' },
    { id: 'cli-4', label: 'Social media disclaimers posted on all profiles', is_completed: false },
    { id: 'cli-5', label: 'Direct mail includes return address and opt-out', is_completed: false },
    { id: 'cli-6', label: 'All advocate profiles verified and licensed', is_completed: true, completed_at: '2025-02-15', completed_by: 'Admin' },
    { id: 'cli-7', label: 'Data privacy policy updated for outreach', is_completed: false },
    { id: 'cli-8', label: 'CAN-SPAM compliance audit completed', is_completed: false },
  ],
  completion_percentage: 50,
  last_reviewed_at: '2025-02-15',
};

const MOCK_KPI_SUMMARY: AdvocacyKpiSummary = {
  total_advocates: 6,
  active_campaigns: 5,
  total_referrals: 147,
  homeowners_reached: 28400,
  community_events: 34,
  avg_satisfaction: 4.65,
  referral_trend: [
    { name: 'Oct', value: 12 },
    { name: 'Nov', value: 18 },
    { name: 'Dec', value: 15 },
    { name: 'Jan', value: 24 },
    { name: 'Feb', value: 32 },
    { name: 'Mar', value: 46 },
  ],
};

const MOCK_CHANNEL_PERFORMANCE: ChannelPerformance[] = [
  { channel: 'Email', sent: 8200, delivered: 7850, opened: 3570, clicked: 1155, converted: 155, conversion_rate: 1.89 },
  { channel: 'SMS', sent: 2400, delivered: 2350, opened: 2100, clicked: 680, converted: 92, conversion_rate: 3.83 },
  { channel: 'Direct Mail', sent: 1500, delivered: 1480, opened: 0, clicked: 0, converted: 45, conversion_rate: 3.00 },
  { channel: 'Social', sent: 85, delivered: 85, opened: 0, clicked: 420, converted: 32, conversion_rate: 37.65 },
];

@Injectable({ providedIn: 'root' })
export class CommunityAdvocateService {

  constructor(private http: HttpClient) {}

  // ── Advocates ──

  getAdvocates(): Observable<AdvocateProfile[]> {
    return this.http.get<AdvocateProfile[]>('community-advocate/advocates').pipe(
      catchError(() => of(MOCK_ADVOCATES))
    );
  }

  getAdvocate(id: string): Observable<AdvocateProfile> {
    return this.http.get<AdvocateProfile>(`community-advocate/advocates/${id}`).pipe(
      catchError(() => of(MOCK_ADVOCATES.find(a => a.id === id) || MOCK_ADVOCATES[0]))
    );
  }

  createAdvocate(advocate: Partial<AdvocateProfile>): Observable<AdvocateProfile> {
    return this.http.post<AdvocateProfile>('community-advocate/advocates', advocate).pipe(
      catchError(() => of({ ...MOCK_ADVOCATES[0], ...advocate, id: 'adv-new-' + Date.now() } as AdvocateProfile))
    );
  }

  updateAdvocate(id: string, advocate: Partial<AdvocateProfile>): Observable<AdvocateProfile> {
    return this.http.put<AdvocateProfile>(`community-advocate/advocates/${id}`, advocate).pipe(
      catchError(() => of({ ...MOCK_ADVOCATES[0], ...advocate, id } as AdvocateProfile))
    );
  }

  // ── Audience Segments ──

  getAudienceSegments(): Observable<AudienceSegment[]> {
    return this.http.get<AudienceSegment[]>('community-advocate/segments').pipe(
      catchError(() => of(MOCK_SEGMENTS))
    );
  }

  createSegment(segment: Partial<AudienceSegment>): Observable<AudienceSegment> {
    return this.http.post<AudienceSegment>('community-advocate/segments', segment).pipe(
      catchError(() => of({ ...MOCK_SEGMENTS[0], ...segment, id: 'seg-new-' + Date.now() } as AudienceSegment))
    );
  }

  // ── Territories ──

  getTerritoryOverlays(): Observable<TerritoryOverlayData[]> {
    return this.http.get<TerritoryOverlayData[]>('community-advocate/territories').pipe(
      catchError(() => of(MOCK_TERRITORIES))
    );
  }

  // ── Campaigns ──

  getCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>('community-advocate/campaigns').pipe(
      catchError(() => of(MOCK_CAMPAIGNS))
    );
  }

  getCampaign(id: string): Observable<Campaign> {
    return this.http.get<Campaign>(`community-advocate/campaigns/${id}`).pipe(
      catchError(() => of(MOCK_CAMPAIGNS.find(c => c.id === id) || MOCK_CAMPAIGNS[0]))
    );
  }

  createCampaign(campaign: Partial<Campaign>): Observable<Campaign> {
    return this.http.post<Campaign>('community-advocate/campaigns', campaign).pipe(
      catchError(() => of({ ...MOCK_CAMPAIGNS[3], ...campaign, id: 'cmp-new-' + Date.now() } as Campaign))
    );
  }

  updateCampaign(id: string, campaign: Partial<Campaign>): Observable<Campaign> {
    return this.http.put<Campaign>(`community-advocate/campaigns/${id}`, campaign).pipe(
      catchError(() => of({ ...MOCK_CAMPAIGNS[0], ...campaign, id } as Campaign))
    );
  }

  // ── Templates ──

  getTemplates(): Observable<OutreachTemplate[]> {
    return this.http.get<OutreachTemplate[]>('community-advocate/templates').pipe(
      catchError(() => of(MOCK_TEMPLATES))
    );
  }

  getTemplatesByChannel(channel: string): Observable<OutreachTemplate[]> {
    return this.http.get<OutreachTemplate[]>(`community-advocate/templates?channel=${channel}`).pipe(
      catchError(() => of(MOCK_TEMPLATES.filter(t => t.channel === channel)))
    );
  }

  createTemplate(template: Partial<OutreachTemplate>): Observable<OutreachTemplate> {
    return this.http.post<OutreachTemplate>('community-advocate/templates', template).pipe(
      catchError(() => of({ ...MOCK_TEMPLATES[0], ...template, id: 'tpl-new-' + Date.now() } as OutreachTemplate))
    );
  }

  updateTemplate(id: string, template: Partial<OutreachTemplate>): Observable<OutreachTemplate> {
    return this.http.put<OutreachTemplate>(`community-advocate/templates/${id}`, template).pipe(
      catchError(() => of({ ...MOCK_TEMPLATES[0], ...template, id } as OutreachTemplate))
    );
  }

  // ── Channel Configs ──

  getChannelConfigs(): Observable<ChannelConfig[]> {
    return this.http.get<ChannelConfig[]>('community-advocate/channels').pipe(
      catchError(() => of(MOCK_CHANNELS))
    );
  }

  updateChannelConfig(id: string, config: Partial<ChannelConfig>): Observable<ChannelConfig> {
    return this.http.put<ChannelConfig>(`community-advocate/channels/${id}`, config).pipe(
      catchError(() => of({ ...MOCK_CHANNELS[0], ...config, id } as ChannelConfig))
    );
  }

  // ── Community Pages ──

  getCommunityPages(): Observable<CommunityPage[]> {
    return this.http.get<CommunityPage[]>('community-advocate/pages').pipe(
      catchError(() => of(MOCK_COMMUNITY_PAGES))
    );
  }

  createCommunityPage(page: Partial<CommunityPage>): Observable<CommunityPage> {
    return this.http.post<CommunityPage>('community-advocate/pages', page).pipe(
      catchError(() => of({ ...MOCK_COMMUNITY_PAGES[0], ...page, id: 'cp-new-' + Date.now() } as CommunityPage))
    );
  }

  updateCommunityPage(id: string, page: Partial<CommunityPage>): Observable<CommunityPage> {
    return this.http.put<CommunityPage>(`community-advocate/pages/${id}`, page).pipe(
      catchError(() => of({ ...MOCK_COMMUNITY_PAGES[0], ...page, id } as CommunityPage))
    );
  }

  // ── Partner Offers ──

  getPartnerOffers(): Observable<PartnerOffer[]> {
    return this.http.get<PartnerOffer[]>('community-advocate/partner-offers').pipe(
      catchError(() => of(MOCK_PARTNER_OFFERS))
    );
  }

  createPartnerOffer(offer: Partial<PartnerOffer>): Observable<PartnerOffer> {
    return this.http.post<PartnerOffer>('community-advocate/partner-offers', offer).pipe(
      catchError(() => of({ ...MOCK_PARTNER_OFFERS[0], ...offer, id: 'po-new-' + Date.now() } as PartnerOffer))
    );
  }

  updatePartnerOffer(id: string, offer: Partial<PartnerOffer>): Observable<PartnerOffer> {
    return this.http.put<PartnerOffer>(`community-advocate/partner-offers/${id}`, offer).pipe(
      catchError(() => of({ ...MOCK_PARTNER_OFFERS[0], ...offer, id } as PartnerOffer))
    );
  }

  // ── Education Content ──

  getEducationContent(): Observable<EducationContent[]> {
    return this.http.get<EducationContent[]>('community-advocate/education').pipe(
      catchError(() => of(MOCK_EDUCATION))
    );
  }

  createEducationContent(content: Partial<EducationContent>): Observable<EducationContent> {
    return this.http.post<EducationContent>('community-advocate/education', content).pipe(
      catchError(() => of({ ...MOCK_EDUCATION[0], ...content, id: 'ed-new-' + Date.now() } as EducationContent))
    );
  }

  updateEducationContent(id: string, content: Partial<EducationContent>): Observable<EducationContent> {
    return this.http.put<EducationContent>(`community-advocate/education/${id}`, content).pipe(
      catchError(() => of({ ...MOCK_EDUCATION[0], ...content, id } as EducationContent))
    );
  }

  // ── Social Posts ──

  getSocialPosts(): Observable<SocialPost[]> {
    return this.http.get<SocialPost[]>('community-advocate/social-posts').pipe(
      catchError(() => of(MOCK_SOCIAL_POSTS))
    );
  }

  createSocialPost(post: Partial<SocialPost>): Observable<SocialPost> {
    return this.http.post<SocialPost>('community-advocate/social-posts', post).pipe(
      catchError(() => of({ ...MOCK_SOCIAL_POSTS[0], ...post, id: 'sp-new-' + Date.now() } as SocialPost))
    );
  }

  updateSocialPost(id: string, post: Partial<SocialPost>): Observable<SocialPost> {
    return this.http.put<SocialPost>(`community-advocate/social-posts/${id}`, post).pipe(
      catchError(() => of({ ...MOCK_SOCIAL_POSTS[0], ...post, id } as SocialPost))
    );
  }

  // ── Ad Creatives ──

  getAdCreatives(): Observable<AdCreative[]> {
    return this.http.get<AdCreative[]>('community-advocate/ad-creatives').pipe(
      catchError(() => of(MOCK_AD_CREATIVES))
    );
  }

  createAdCreative(creative: Partial<AdCreative>): Observable<AdCreative> {
    return this.http.post<AdCreative>('community-advocate/ad-creatives', creative).pipe(
      catchError(() => of({ ...MOCK_AD_CREATIVES[0], ...creative, id: 'ac-new-' + Date.now() } as AdCreative))
    );
  }

  updateAdCreative(id: string, creative: Partial<AdCreative>): Observable<AdCreative> {
    return this.http.put<AdCreative>(`community-advocate/ad-creatives/${id}`, creative).pipe(
      catchError(() => of({ ...MOCK_AD_CREATIVES[0], ...creative, id } as AdCreative))
    );
  }

  // ── Automation Rules ──

  getAutomationRules(): Observable<AutomationRule[]> {
    return this.http.get<AutomationRule[]>('community-advocate/automations').pipe(
      catchError(() => of(MOCK_AUTOMATION_RULES))
    );
  }

  createAutomationRule(rule: Partial<AutomationRule>): Observable<AutomationRule> {
    return this.http.post<AutomationRule>('community-advocate/automations', rule).pipe(
      catchError(() => of({ ...MOCK_AUTOMATION_RULES[0], ...rule, id: 'aut-new-' + Date.now() } as AutomationRule))
    );
  }

  updateAutomationRule(id: string, rule: Partial<AutomationRule>): Observable<AutomationRule> {
    return this.http.put<AutomationRule>(`community-advocate/automations/${id}`, rule).pipe(
      catchError(() => of({ ...MOCK_AUTOMATION_RULES[0], ...rule, id } as AutomationRule))
    );
  }

  toggleAutomationRule(id: string, is_active: boolean): Observable<AutomationRule> {
    return this.http.patch<AutomationRule>(`community-advocate/automations/${id}`, { is_active }).pipe(
      catchError(() => {
        const rule = MOCK_AUTOMATION_RULES.find(r => r.id === id);
        return of({ ...(rule || MOCK_AUTOMATION_RULES[0]), is_active } as AutomationRule);
      })
    );
  }

  // ── Analytics ──

  getKpiSummary(): Observable<AdvocacyKpiSummary> {
    return this.http.get<AdvocacyKpiSummary>('community-advocate/analytics/kpi').pipe(
      catchError(() => of(MOCK_KPI_SUMMARY))
    );
  }

  getChannelPerformance(): Observable<ChannelPerformance[]> {
    return this.http.get<ChannelPerformance[]>('community-advocate/analytics/channels').pipe(
      catchError(() => of(MOCK_CHANNEL_PERFORMANCE))
    );
  }

  getReferralTrend(dateFrom?: string, dateTo?: string): Observable<AdvocacyChartData[]> {
    const params: any = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    return this.http.get<AdvocacyChartData[]>('community-advocate/analytics/referral-trend', { params }).pipe(
      catchError(() => of(MOCK_KPI_SUMMARY.referral_trend))
    );
  }

  // ── Compliance ──

  getDisclaimers(): Observable<ComplianceDisclaimer[]> {
    return this.http.get<ComplianceDisclaimer[]>('community-advocate/compliance/disclaimers').pipe(
      catchError(() => of(MOCK_DISCLAIMERS))
    );
  }

  createDisclaimer(disclaimer: Partial<ComplianceDisclaimer>): Observable<ComplianceDisclaimer> {
    return this.http.post<ComplianceDisclaimer>('community-advocate/compliance/disclaimers', disclaimer).pipe(
      catchError(() => of({ ...MOCK_DISCLAIMERS[0], ...disclaimer, id: 'dis-new-' + Date.now() } as ComplianceDisclaimer))
    );
  }

  updateDisclaimer(id: string, disclaimer: Partial<ComplianceDisclaimer>): Observable<ComplianceDisclaimer> {
    return this.http.put<ComplianceDisclaimer>(`community-advocate/compliance/disclaimers/${id}`, disclaimer).pipe(
      catchError(() => of({ ...MOCK_DISCLAIMERS[0], ...disclaimer, id } as ComplianceDisclaimer))
    );
  }

  getComplianceChecklist(): Observable<ComplianceChecklist> {
    return this.http.get<ComplianceChecklist>('community-advocate/compliance/checklist').pipe(
      catchError(() => of(MOCK_CHECKLIST))
    );
  }

  updateChecklistItem(checklistId: string, itemId: string, completed: boolean): Observable<ComplianceChecklist> {
    return this.http.patch<ComplianceChecklist>(`community-advocate/compliance/checklist/${checklistId}/items/${itemId}`, { is_completed: completed }).pipe(
      catchError(() => {
        const updated = { ...MOCK_CHECKLIST };
        const item = updated.items.find(i => i.id === itemId);
        if (item) {
          item.is_completed = completed;
          item.completed_at = completed ? new Date().toISOString() : undefined;
        }
        updated.completion_percentage = Math.round((updated.items.filter(i => i.is_completed).length / updated.items.length) * 100);
        return of(updated);
      })
    );
  }

  // ── Role-Based Filtered Methods ──

  getMyAdvocateProfile(): Observable<AdvocateProfile> {
    return this.http.get<AdvocateProfile>('community-advocate/advocates/me').pipe(
      catchError(() => of(MOCK_ADVOCATES[0]))
    );
  }

  getMyKpiSummary(advocateId: string): Observable<AdvocacyKpiSummary> {
    return this.http.get<AdvocacyKpiSummary>(`community-advocate/analytics/kpi/${advocateId}`).pipe(
      catchError(() => {
        const adv = MOCK_ADVOCATES.find(a => a.id === advocateId) || MOCK_ADVOCATES[0];
        return of({
          total_advocates: 1,
          active_campaigns: adv.metrics.active_campaigns,
          total_referrals: adv.metrics.referrals_generated,
          homeowners_reached: adv.metrics.homeowners_helped,
          community_events: adv.metrics.community_events,
          avg_satisfaction: adv.metrics.satisfaction_score,
          referral_trend: [
            { name: 'Oct', value: 3 },
            { name: 'Nov', value: 5 },
            { name: 'Dec', value: 4 },
            { name: 'Jan', value: 7 },
            { name: 'Feb', value: 9 },
            { name: 'Mar', value: 14 },
          ],
        });
      })
    );
  }

  getMyCampaigns(advocateId: string): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`community-advocate/campaigns?advocate_id=${advocateId}`).pipe(
      catchError(() => of(MOCK_CAMPAIGNS.filter((_, i) => i < 2)))
    );
  }

  getMyCommunityPages(advocateId: string): Observable<CommunityPage[]> {
    return this.http.get<CommunityPage[]>(`community-advocate/pages?advocate_id=${advocateId}`).pipe(
      catchError(() => of(MOCK_COMMUNITY_PAGES.filter(p => p.advocate_id === advocateId)))
    );
  }

  getChapterAdvocates(chapterPresidentId: string): Observable<AdvocateProfile[]> {
    return this.http.get<AdvocateProfile[]>(`community-advocate/advocates?chapter_president=${chapterPresidentId}`).pipe(
      catchError(() => of(MOCK_ADVOCATES.filter((_, i) => i < 3)))
    );
  }

  getRegionalAdvocates(regionId: string): Observable<AdvocateProfile[]> {
    return this.http.get<AdvocateProfile[]>(`community-advocate/advocates?region=${regionId}`).pipe(
      catchError(() => of(MOCK_ADVOCATES.filter(a => a.status === 'active')))
    );
  }
}
