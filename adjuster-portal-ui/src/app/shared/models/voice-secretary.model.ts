/**
 * Voice Secretary Configuration Models
 *
 * Per-agent AI secretary assignment with premium voice configuration.
 * Supports multi-tenant voice with provider-agnostic settings.
 */

// ── Voice Providers ──────────────────────────────────────────────

export type VoiceProvider =
  | 'platform_default'
  | 'vapi'
  | 'retell'
  | 'bland'
  | 'twilio'
  | 'elevenlabs';

export type VoiceGender = 'default' | 'male' | 'female';

export type VoiceStyle =
  | 'professional'
  | 'friendly'
  | 'authoritative'
  | 'empathetic'
  | 'casual';

export type PersonalityPreset =
  | 'standard'
  | 'warm'
  | 'direct'
  | 'consultative';

export type SubscriptionTier = 'standard' | 'professional' | 'enterprise';

// ── Voice Secretary Config ───────────────────────────────────────

export interface VoiceSecretary {
  id: string;
  agent_id: string;

  // Identity
  secretary_name: string;
  greeting_name: string | null;

  // Provider configuration
  voice_provider: VoiceProvider;
  voice_agent_id: string | null;

  // Voice settings
  voice_gender: VoiceGender;
  voice_style: VoiceStyle;
  voice_id: string | null;
  language: string;

  // Premium
  is_premium_voice_enabled: boolean;
  subscription_tier: SubscriptionTier;

  // Script customization
  default_script_id: string | null;
  branded_greeting: string | null;
  branded_closing: string | null;

  // Personality
  personality_preset: PersonalityPreset;
  call_style: 'outbound' | 'inbound' | 'both';

  // Flags
  is_active: boolean;
  can_handle_inbound: boolean;
  can_transfer_to_agent: boolean;

  created_at: string;
  updated_at: string | null;
}

// ── Resolved Voice Profile ───────────────────────────────────────

export interface ResolvedVoiceProfile {
  agent_id: string;
  secretary_name: string;
  voice_provider: VoiceProvider;
  voice_agent_id: string | null;
  voice_gender: VoiceGender;
  voice_style: VoiceStyle;
  voice_id: string | null;
  language: string;
  script_style: string;
  branded_greeting: string | null;
  branded_closing: string | null;
  is_premium: boolean;
  subscription_tier: SubscriptionTier;
  can_transfer: boolean;
}

// ── Premium Voice Options ────────────────────────────────────────

export interface PremiumVoiceOption {
  id: string;
  name: string;
  gender: VoiceGender;
  style: VoiceStyle;
  provider: VoiceProvider;
  preview_url: string | null;
  tier_required: SubscriptionTier;
}

export const VOICE_GENDER_OPTIONS: { value: VoiceGender; label: string; premium: boolean }[] = [
  { value: 'default', label: 'Platform Standard', premium: false },
  { value: 'male', label: 'Male', premium: true },
  { value: 'female', label: 'Female', premium: true },
];

export const VOICE_STYLE_OPTIONS: { value: VoiceStyle; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'casual', label: 'Casual' },
];

export const PERSONALITY_OPTIONS: { value: PersonalityPreset; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard', description: 'Balanced, professional tone' },
  { value: 'warm', label: 'Warm', description: 'Friendly, empathetic approach' },
  { value: 'direct', label: 'Direct', description: 'Concise, results-focused' },
  { value: 'consultative', label: 'Consultative', description: 'Advisory, detail-oriented' },
];
