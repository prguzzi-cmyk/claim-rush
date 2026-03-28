import { Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { VoiceOutreachEngineService } from '../../../../shared/services/voice-outreach-engine.service';
import {
  VoiceCallOutcome,
  CALL_OUTCOME_META,
} from '../../../../shared/models/voice-outreach.model';

export interface RecordOutcomeDialogData {
  callId: string;
}

@Component({
  selector: 'app-record-outcome-dialog',
  templateUrl: './record-outcome-dialog.component.html',
  styleUrls: ['./record-outcome-dialog.component.scss'],
  standalone: false,
})
export class RecordOutcomeDialogComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  outcomes = Object.keys(CALL_OUTCOME_META) as VoiceCallOutcome[];
  outcomeMeta = CALL_OUTCOME_META;
  selectedOutcome: VoiceCallOutcome | null = null;
  notes = '';
  saving = false;

  constructor(
    private dialogRef: MatDialogRef<RecordOutcomeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RecordOutcomeDialogData,
    private voiceService: VoiceOutreachEngineService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  save(): void {
    if (!this.selectedOutcome) return;
    this.saving = true;

    this.voiceService.recordCallOutcome(
      this.data.callId,
      this.selectedOutcome,
      null,
      this.notes || null,
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (record) => {
          this.saving = false;
          this.snackBar.open('Outcome recorded', '', { duration: 3000 });
          this.dialogRef.close(record);
        },
        error: () => {
          this.saving = false;
          this.snackBar.open('Failed to record outcome', '', { duration: 3000 });
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
