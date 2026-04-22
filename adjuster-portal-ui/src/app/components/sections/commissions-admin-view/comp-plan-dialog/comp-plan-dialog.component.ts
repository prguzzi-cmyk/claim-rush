import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

interface FieldSplitRow {
  bucket: 'Writing Agent' | 'RVP Override' | 'CP Override';
  percent: number;
}

interface Scenario {
  id: 1 | 2 | 3 | 4;
  title: string;
  writer: string;
  condition: string;
  splits: FieldSplitRow[];
  example: { label: string; amount: number }[];
}

/**
 * Read-only reference view of the active compensation plan. Mirrors the
 * 4-scenario dispatch in commission_service._resolve_field_split. If the
 * comp plan changes, update BOTH sides (service + this view).
 */
@Component({
  selector: 'app-comp-plan-dialog',
  templateUrl: './comp-plan-dialog.component.html',
  styleUrls: ['./comp-plan-dialog.component.scss'],
  standalone: false,
})
export class CompPlanDialogComponent {
  readonly masterHouse = 50;
  readonly masterField = 50;

  readonly scenarios: Scenario[] = [
    {
      id: 1,
      title: 'CP writes solo',
      writer: 'CP',
      condition: 'Writing agent IS a CP. No separate CP override emitted.',
      splits: [{ bucket: 'Writing Agent', percent: 100 }],
      example: [
        { label: 'Gross fee', amount: 10_000 },
        { label: 'House (50%)', amount: 5_000 },
        { label: 'Writing Agent = CP (100% of field)', amount: 5_000 },
      ],
    },
    {
      id: 2,
      title: 'RVP writes',
      writer: 'RVP',
      condition: 'Writing agent IS an RVP; CP sits above.',
      splits: [
        { bucket: 'Writing Agent', percent: 80 },
        { bucket: 'CP Override', percent: 20 },
      ],
      example: [
        { label: 'Gross fee', amount: 10_000 },
        { label: 'House (50%)', amount: 5_000 },
        { label: 'Writing Agent = RVP (80% of field)', amount: 4_000 },
        { label: 'CP Override (20% of field)', amount: 1_000 },
      ],
    },
    {
      id: 3,
      title: 'Agent writes — full chain',
      writer: 'AGENT',
      condition: 'Writing agent is an AGENT with an RVP and a CP above.',
      splits: [
        { bucket: 'Writing Agent', percent: 70 },
        { bucket: 'RVP Override', percent: 10 },
        { bucket: 'CP Override', percent: 20 },
      ],
      example: [
        { label: 'Gross fee', amount: 10_000 },
        { label: 'House (50%)', amount: 5_000 },
        { label: 'Writing Agent (70% of field)', amount: 3_500 },
        { label: 'RVP Override (10% of field)', amount: 500 },
        { label: 'CP Override (20% of field)', amount: 1_000 },
      ],
    },
    {
      id: 4,
      title: 'Agent writes — direct CP',
      writer: 'AGENT',
      condition: 'Writing agent is an AGENT with a CP above but NO RVP. CP absorbs the missing 10%.',
      splits: [
        { bucket: 'Writing Agent', percent: 70 },
        { bucket: 'CP Override', percent: 30 },
      ],
      example: [
        { label: 'Gross fee', amount: 10_000 },
        { label: 'House (50%)', amount: 5_000 },
        { label: 'Writing Agent (70% of field)', amount: 3_500 },
        { label: 'CP Override (30% of field)', amount: 1_500 },
      ],
    },
  ];

  constructor(private readonly dialogRef: MatDialogRef<CompPlanDialogComponent>) {}

  close(): void {
    this.dialogRef.close();
  }
}
