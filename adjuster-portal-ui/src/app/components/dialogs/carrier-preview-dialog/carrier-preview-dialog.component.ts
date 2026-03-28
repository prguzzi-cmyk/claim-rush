import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { CarrierPreviewResult, CarrierPreviewLineItem } from "src/app/models/carrier-comparison.model";

export interface CarrierPreviewDialogData {
  preview: CarrierPreviewResult;
  carrierName: string;
  fileName?: string;
  uploadType: string;
  pastedText?: string;
}

export interface CarrierPreviewDialogResult {
  confirmed: boolean;
  items: CarrierPreviewLineItem[];
  carrierName: string;
  fileKey?: string;
  fileName?: string;
  uploadType: string;
  parserType?: string;
  parseConfidence?: string;
  pastedText?: string;
}

@Component({
  selector: "app-carrier-preview-dialog",
  templateUrl: "./carrier-preview-dialog.component.html",
  styleUrls: ["./carrier-preview-dialog.component.scss"],
  standalone: false,
})
export class CarrierPreviewDialogComponent {
  items: CarrierPreviewLineItem[];
  carrierName: string;
  editingIndex: number | null = null;

  readonly categories = [
    "walls", "ceiling", "floor", "trim", "doors",
    "windows", "cabinets", "fixtures", "misc_items",
  ];

  constructor(
    private dialogRef: MatDialogRef<CarrierPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CarrierPreviewDialogData
  ) {
    // Deep-copy items so edits don't mutate the original
    this.items = data.preview.items.map((i) => ({ ...i }));
    this.carrierName = data.carrierName;
  }

  get parserType(): string {
    return this.data.preview.parser_type || "generic";
  }

  get parserLabel(): string {
    switch (this.parserType) {
      case "xactimate": return "Xactimate";
      case "generic": return "Generic PDF";
      case "paste": return "Pasted";
      default: return this.parserType;
    }
  }

  get parseConfidence(): string {
    return this.data.preview.parse_confidence || "medium";
  }

  get totalCost(): number {
    return this.items.reduce((sum, i) => sum + (i.total_cost || 0), 0);
  }

  get highConfidenceCount(): number {
    return this.items.filter((i) => i.confidence === "high").length;
  }

  get mediumConfidenceCount(): number {
    return this.items.filter((i) => i.confidence === "medium").length;
  }

  get lowConfidenceCount(): number {
    return this.items.filter((i) => i.confidence === "low").length;
  }

  startEditing(index: number) {
    this.editingIndex = index;
  }

  stopEditing() {
    this.editingIndex = null;
  }

  recalcTotal(item: CarrierPreviewLineItem) {
    if (item.quantity && item.unit_cost) {
      item.total_cost = Math.round(item.quantity * item.unit_cost * 100) / 100;
    }
  }

  deleteItem(index: number) {
    this.items.splice(index, 1);
    if (this.editingIndex === index) this.editingIndex = null;
  }

  confirm() {
    const result: CarrierPreviewDialogResult = {
      confirmed: true,
      items: this.items,
      carrierName: this.carrierName,
      fileKey: this.data.preview.file_key,
      fileName: this.data.fileName,
      uploadType: this.data.uploadType,
      parserType: this.data.preview.parser_type,
      parseConfidence: this.data.preview.parse_confidence,
      pastedText: this.data.pastedText,
    };
    this.dialogRef.close(result);
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
