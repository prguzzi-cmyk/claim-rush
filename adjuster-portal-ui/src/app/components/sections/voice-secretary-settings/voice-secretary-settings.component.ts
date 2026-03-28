import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of } from 'rxjs';
import { VoiceSecretaryService } from 'src/app/shared/services/voice-secretary.service';
import { UserService } from 'src/app/services/user.service';
import {
  VoiceSecretary,
  VoiceGender,
  VoiceStyle,
  PersonalityPreset,
  VOICE_GENDER_OPTIONS,
  VOICE_STYLE_OPTIONS,
  PERSONALITY_OPTIONS,
} from 'src/app/shared/models/voice-secretary.model';

@Component({
  selector: 'app-voice-secretary-settings',
  templateUrl: './voice-secretary-settings.component.html',
  styleUrls: ['./voice-secretary-settings.component.scss'],
  standalone: false,
})
export class VoiceSecretarySettingsComponent implements OnInit {

  // Options
  genderOptions = VOICE_GENDER_OPTIONS;
  styleOptions = VOICE_STYLE_OPTIONS;
  personalityOptions = PERSONALITY_OPTIONS;

  // State
  loading = true;
  saving = false;
  previewing = false;
  hasExisting = false;

  // Config
  secretaryId: string | null = null;
  agentId = '';
  secretaryName = 'AI Assistant';
  voiceGender: VoiceGender = 'default';
  voiceStyle: VoiceStyle = 'professional';
  personalityPreset: PersonalityPreset = 'standard';
  brandedGreeting = '';
  brandedClosing = '';
  language = 'en-US';
  isPremium = false;
  isActive = true;

  constructor(
    private voiceSecretaryService: VoiceSecretaryService,
    private userService: UserService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.userService.currentUser.subscribe(user => {
      if (user?.id) {
        this.agentId = user.id;
        this.loadConfig();
      } else {
        this.loading = false;
      }
    });
  }

  private loadConfig(): void {
    this.voiceSecretaryService.getByAgent(this.agentId).pipe(
      catchError(() => of(null)),
    ).subscribe(sec => {
      this.loading = false;
      if (sec) {
        this.hasExisting = true;
        this.secretaryId = sec.id;
        this.secretaryName = sec.secretary_name;
        this.voiceGender = sec.voice_gender;
        this.voiceStyle = sec.voice_style;
        this.personalityPreset = sec.personality_preset;
        this.brandedGreeting = sec.branded_greeting || '';
        this.brandedClosing = sec.branded_closing || '';
        this.language = sec.language;
        this.isPremium = sec.is_premium_voice_enabled;
        this.isActive = sec.is_active;
      } else {
        // Defaults
        this.hasExisting = false;
        this.isPremium = false;
      }
    });
  }

  save(): void {
    this.saving = true;
    const data: Partial<VoiceSecretary> = {
      agent_id: this.agentId,
      secretary_name: this.secretaryName,
      voice_gender: this.isPremium ? this.voiceGender : 'default',
      voice_style: this.voiceStyle,
      personality_preset: this.personalityPreset,
      branded_greeting: this.brandedGreeting || null,
      branded_closing: this.brandedClosing || null,
      language: this.language,
      is_active: this.isActive,
    } as any;

    this.voiceSecretaryService.createOrUpdate(data).pipe(
      catchError(() => {
        this.snackBar.open('Failed to save settings', 'OK', { duration: 3000 });
        this.saving = false;
        return of(null);
      }),
    ).subscribe(result => {
      this.saving = false;
      if (result) {
        this.secretaryId = result.id;
        this.hasExisting = true;
        this.snackBar.open('Voice secretary settings saved', 'OK', { duration: 3000 });
      }
    });
  }

  previewVoice(): void {
    this.previewing = true;
    // Simulate preview — future: trigger actual audio playback or sample call
    setTimeout(() => {
      this.previewing = false;
      this.snackBar.open(
        `Preview: "${this.secretaryName}" — ${this.voiceGender} voice, ${this.voiceStyle} style, ${this.personalityPreset} personality`,
        'OK',
        { duration: 5000 },
      );
    }, 2000);
  }

  getGenderLabel(value: VoiceGender): string {
    return this.genderOptions.find(o => o.value === value)?.label || value;
  }

  getStyleLabel(value: VoiceStyle): string {
    return this.styleOptions.find(o => o.value === value)?.label || value;
  }

  getPersonalityDescription(value: PersonalityPreset): string {
    return this.personalityOptions.find(o => o.value === value)?.description || '';
  }
}
