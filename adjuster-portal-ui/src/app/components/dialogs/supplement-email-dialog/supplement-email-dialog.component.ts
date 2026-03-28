import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

export interface SupplementEmailDialogData {
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  carrierName: string;
  claimNumber: string;
  insuredName: string;
  propertyAddress: string;
  policyNumber: string;
  projectName: string;
  carrierTotal: number;
  aciTotal: number;
  supplementTotal: number;
  detectedEmail: string;
  emailSource: string;
}

export interface SupplementEmailDialogResult {
  action: "send" | "copy";
  to: string;
  subject: string;
  body: string;
}

@Component({
  selector: "app-supplement-email-dialog",
  templateUrl: "./supplement-email-dialog.component.html",
  styleUrls: ["./supplement-email-dialog.component.scss"],
  standalone: false,
})
export class SupplementEmailDialogComponent {
  to = "";
  subject = "";
  body = "";
  emailDetected = false;
  emailSource = "";

  constructor(
    private dialogRef: MatDialogRef<SupplementEmailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SupplementEmailDialogData
  ) {
    // Auto-populate To field if a carrier adjuster email was detected
    if (data.detectedEmail) {
      this.to = data.detectedEmail;
      this.emailDetected = true;
      this.emailSource = data.emailSource || "claim record";
    }

    this.subject = `Supplement Request – Claim #${data.claimNumber || "N/A"}`;
    this.body = this.buildDefaultBody();
  }

  private buildDefaultBody(): string {
    const adjusterName = this.data.carrierName
      ? `${this.data.carrierName} Claims Team`
      : "Claims Team";
    const senderName = this.data.senderName || "Adjuster";
    const companyName = "ACI Adjuster Intelligence\u2122";
    const phone = this.data.senderPhone || "";
    const email = this.data.senderEmail || "";

    return `Dear ${adjusterName},

Please find attached a supplement request based on our scope and pricing analysis.

After reviewing the carrier estimate and comparing it to our detailed scope, we identified several items that were either underpaid or omitted.

The attached supplement report outlines the differences and the additional amounts required to properly indemnify the insured under the policy.

Please review and advise regarding next steps.

Thank you,

${senderName}
${companyName}${phone ? '\n' + phone : ''}${email ? '\n' + email : ''}`;
  }

  cancel() {
    this.dialogRef.close(null);
  }

  copyEmail() {
    const result: SupplementEmailDialogResult = {
      action: "copy",
      to: this.to,
      subject: this.subject,
      body: this.body,
    };
    this.dialogRef.close(result);
  }

  sendEmail() {
    const result: SupplementEmailDialogResult = {
      action: "send",
      to: this.to,
      subject: this.subject,
      body: this.body,
    };
    this.dialogRef.close(result);
  }
}
