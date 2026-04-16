/**
 * Seed data for RIN / ClaimRush.
 *
 * This file provides the initial data set for:
 * - roles (defined in roles.js, not stored as a table — derived from user.role)
 * - feature flags
 * - sample territories
 * - sample users (for dev/testing)
 */

import { ROLES } from '../roles/roles.js';

// ── Feature Flags ────────────────────────────────────────
export const SEED_FEATURE_FLAGS = [
  { flag_key: 'fire_pipeline', flag_name: 'Fire Lead Pipeline', description: 'PulsePoint → skip trace → lead generation', enabled_global: true },
  { flag_key: 'storm_pipeline', flag_name: 'Storm Lead Pipeline', description: 'NWS storm events → lead generation', enabled_global: false },
  { flag_key: 'retell_provisioning', flag_name: 'Retell AI Voice Provisioning', description: 'Auto-provision Retell voice agents per subscriber', enabled_global: false },
  { flag_key: 'credit_wallet', flag_name: 'Credit Wallet System', description: 'Token-based credit/debit system', enabled_global: false },
  { flag_key: 'sms_outbound', flag_name: 'Outbound SMS', description: 'Send SMS to leads via Twilio', enabled_global: false },
  { flag_key: 'skip_trace_auto', flag_name: 'Auto Skip Trace', description: 'Automatically skip trace all fire leads', enabled_global: true },
  { flag_key: 'email_notifications', flag_name: 'Email Notifications', description: 'Send batched lead email notifications', enabled_global: true },
  { flag_key: 'eagleview_reports', flag_name: 'EagleView Reports', description: 'Request aerial imagery reports', enabled_global: false },
  { flag_key: 'esign_agreements', flag_name: 'E-Sign Agreements', description: 'Digital agreement signing flow', enabled_global: false },
  { flag_key: 'chapter_sites', flag_name: 'Chapter President Sites', description: 'Per-CP branded landing pages', enabled_global: true },
];

// ── Sample Territories ───────────────────────────────────
export const SEED_TERRITORIES = [
  { name: 'Pennsylvania', territory_type: 'state', state: 'PA' },
  { name: 'Bucks County, PA', territory_type: 'county', state: 'PA', county: 'Bucks' },
  { name: 'Montgomery County, PA', territory_type: 'county', state: 'PA', county: 'Montgomery' },
  { name: 'Delaware County, PA', territory_type: 'county', state: 'PA', county: 'Delaware' },
  { name: 'Philadelphia, PA', territory_type: 'county', state: 'PA', county: 'Philadelphia' },
  { name: 'New Jersey', territory_type: 'state', state: 'NJ' },
  { name: 'Florida', territory_type: 'state', state: 'FL' },
  { name: 'California', territory_type: 'state', state: 'CA' },
];

// ── Sample Users (dev/testing) ───────────────────────────
export const SEED_USERS = [
  {
    email: 'admin@upaclaim.org',
    first_name: 'System',
    last_name: 'Admin',
    role: ROLES.SUPER_ADMIN,
    phone: '8005550000',
  },
  {
    email: 'ops@upaclaim.org',
    first_name: 'Home',
    last_name: 'Office',
    role: ROLES.HOME_OFFICE,
    phone: '8005550001',
  },
  {
    email: 'peter@aciadjustment.com',
    first_name: 'Peter',
    last_name: 'Guzzi',
    role: ROLES.CP,
    phone: '8008094302',
    territory: 'Bucks County, PA',
  },
  {
    email: 'makmin@upaclaim.org',
    first_name: 'Makmin',
    last_name: 'Team',
    role: ROLES.RVP,
    phone: '8005550010',
    territory: 'Pennsylvania',
  },
  {
    email: 'agent1@aciadjustment.com',
    first_name: 'Field',
    last_name: 'Agent',
    role: ROLES.AGENT,
    phone: '8005550020',
    territory: 'Bucks County, PA',
  },
];

export default {
  featureFlags: SEED_FEATURE_FLAGS,
  territories: SEED_TERRITORIES,
  users: SEED_USERS,
};
