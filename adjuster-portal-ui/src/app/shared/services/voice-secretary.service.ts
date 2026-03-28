import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VoiceSecretary, ResolvedVoiceProfile } from '../models/voice-secretary.model';

/**
 * Voice Secretary Configuration Service
 *
 * Manages per-agent AI secretary settings and resolves voice profiles
 * before calls are placed. Provider-agnostic — supports VAPI, Retell,
 * Bland, Twilio, ElevenLabs, and future providers.
 */
@Injectable({ providedIn: 'root' })
export class VoiceSecretaryService {

  constructor(private http: HttpClient) {}

  // ── Secretary CRUD ─────────────────────────────────────────────

  createOrUpdate(data: Partial<VoiceSecretary>): Observable<VoiceSecretary> {
    return this.http.post<VoiceSecretary>('voice-secretary/secretary', data);
  }

  getByAgent(agentId: string): Observable<VoiceSecretary> {
    return this.http.get<VoiceSecretary>(`voice-secretary/secretary/${agentId}`);
  }

  update(secretaryId: string, updates: Partial<VoiceSecretary>): Observable<VoiceSecretary> {
    return this.http.patch<VoiceSecretary>(`voice-secretary/secretary/${secretaryId}`, updates);
  }

  delete(secretaryId: string): Observable<void> {
    return this.http.delete<void>(`voice-secretary/secretary/${secretaryId}`);
  }

  listAll(limit = 100): Observable<VoiceSecretary[]> {
    return this.http.get<VoiceSecretary[]>('voice-secretary/secretaries', { params: { limit: limit.toString() } });
  }

  // ── Voice Profile Resolution ───────────────────────────────────

  /**
   * Resolve the full voice profile for a call.
   * Call this before initiating any voice interaction.
   *
   * Returns the selected provider, voice agent, gender, style, script, greeting.
   * Falls back to platform default if no custom config exists.
   */
  resolveVoiceProfile(agentId?: string, leadId?: string): Observable<ResolvedVoiceProfile> {
    const params: any = {};
    if (agentId) params.agent_id = agentId;
    if (leadId) params.lead_id = leadId;
    return this.http.get<ResolvedVoiceProfile>('voice-secretary/resolve-profile', { params });
  }
}
