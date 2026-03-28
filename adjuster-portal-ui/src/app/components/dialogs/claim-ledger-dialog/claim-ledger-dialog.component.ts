import { DatePipe } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { ClaimPayment } from 'src/app/models/payment-claim.model';
import { ClaimService } from 'src/app/services/claim.service';
import { DialogService } from 'src/app/services/dialog.service';
import { NotificationService } from 'src/app/services/notification.service';
import { UserService } from 'src/app/services/user.service';
import { ViewDocumentDialogComponent } from '../view-document-dialog/view-document-dialog.component';

@Component({
    selector: 'app-claim-ledger-dialog',
    templateUrl: './claim-ledger-dialog.component.html',
    styleUrls: ['./claim-ledger-dialog.component.scss'],
    providers: [DatePipe],
    standalone: false
})
export class ClaimLedgerDialogComponent implements OnInit {

  claimPayment: any;

  FormDisabled: boolean = false;
  claim_id: string;
  claim_payment_id: string;
  fileUploadFormDisabled: boolean = false;

  chequeTypes: string[] = ["standard", "flagged"];

  paymentTypes: string[] = [
    'Initial Payment', 'ACV Payment', 'RCV Holdback', 'Supplement Payment',
    'Contents Payment', 'ALE Payment', 'Final Payment', 'Mortgage Endorsed Check', 'Other'
  ];

  issuedByOptions: string[] = [
    'Insurance Carrier', 'Mortgage Company', 'Insurance Carrier + Mortgage Company', 'Other'
  ];

  depositStatusOptions: string[] = [
    'Received', 'Sent for Endorsement', 'Endorsed', 'Deposited', 'Cleared', 'On Hold'
  ];

  relatedCoverageOptions: string[] = [
    'Dwelling', 'Other Structures', 'Contents', 'ALE',
    'Business Personal Property', 'Loss of Income', 'Other'
  ];

  filename: string | undefined;
  file: File | undefined;
  fileType: string | undefined;

  fileUploadForm = new FormGroup({
    fileName: new FormControl('', [
      Validators.required
    ]),
    description: new FormControl(''),
  });

  dataSourceFile: MatTableDataSource<any>;

  displayedColumnsFiles: string[] = [
    'sn',
    'name',
    'description',
    'download',
    'preview',
    'delete',
  ];


  paymentForm = new FormGroup({
    payment_date: new FormControl('', [Validators.required]),
    check_amount: new FormControl(0, [Validators.required]),
    ref_number: new FormControl(''),
    payment_type: new FormControl('', [Validators.required]),
    issued_by: new FormControl('', [Validators.required]),
    payee: new FormControl(''),
    deposit_status: new FormControl(''),
    related_coverage: new FormControl(''),
    note: new FormControl(''),
    contingency_fee_percentage: new FormControl(0),
    appraisal_fee: new FormControl(0),
    umpire_fee: new FormControl(0),
    mold_fee: new FormControl(0),
    misc_fee: new FormControl(0),
    check_type: new FormControl('standard'),
    is_ready_to_process: new FormControl(false),
  });

  constructor(
    private claimService: ClaimService,
    private dialogRef: MatDialogRef<ClaimLedgerDialogComponent>,
    private snackBar: MatSnackBar,
    private dialogService: DialogService,
    public userService: UserService,
    private datepipe: DatePipe,
    private notificationService: NotificationService,
    private spinner: NgxSpinnerService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {

    if (data && data.type == 'add') {
      this.claim_id = data.claim.id;
    } else if (data?.type == 'edit' || data?.type == 'view' || data?.type == 'delete') {
      this.claimPayment = data.claimPayment;
      this.claim_payment_id = data.claimPayment.id;
      this.paymentForm.patchValue(data.claimPayment);
      console.log(data.claimPayment.id);
      this.getPaymentFiles();
    }

  }

  ngOnInit(): void {

  }

  addPayment() {
    this.FormDisabled = true;
    let payment = new ClaimPayment;

    payment.payment_date = this.datepipe.transform(this.paymentForm.controls['payment_date'].value, 'yyyy-MM-dd');
    payment.check_amount = this.paymentForm.controls['check_amount'].value;
    payment.ref_number = this.paymentForm.controls['ref_number'].value;
    payment.payment_type = this.paymentForm.controls['payment_type'].value;
    payment.issued_by = this.paymentForm.controls['issued_by'].value;
    payment.payee = this.paymentForm.controls['payee'].value;
    payment.deposit_status = this.paymentForm.controls['deposit_status'].value;
    payment.related_coverage = this.paymentForm.controls['related_coverage'].value;
    payment.note = this.paymentForm.controls['note'].value;
    payment.contingency_fee_percentage = this.paymentForm.controls['contingency_fee_percentage'].value;
    payment.appraisal_fee = this.paymentForm.controls['appraisal_fee'].value;
    payment.umpire_fee = this.paymentForm.controls['umpire_fee'].value;
    payment.mold_fee = this.paymentForm.controls['mold_fee'].value;
    payment.misc_fee = this.paymentForm.controls['misc_fee'].value;
    payment.check_type = this.paymentForm.controls['check_type'].value || 'standard';
    payment.is_ready_to_process = this.paymentForm.controls['is_ready_to_process'].value;

    this.claimService.addClaimPayment(this.claim_id, payment)
      .subscribe((response) => {
        this.claimPayment  = response;
        console.log(response);
        this.claim_payment_id = this.claimPayment.id;

        this.uploadFile();

        this.FormDisabled = false;
        this.dialogRef.close(response);
        this.snackBar.open('Payment added', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      },
        error => {
          this.FormDisabled = false;
          console.log(error);
        });
  }

  updatePayment() {
    this.FormDisabled = true;
    let payment = new ClaimPayment;

    payment.id = this.claim_payment_id;
    payment.payment_date = this.datepipe.transform(this.paymentForm.controls['payment_date'].value, 'yyyy-MM-dd');
    payment.check_amount = this.paymentForm.controls['check_amount'].value;
    payment.ref_number = this.paymentForm.controls['ref_number'].value;
    payment.payment_type = this.paymentForm.controls['payment_type'].value;
    payment.issued_by = this.paymentForm.controls['issued_by'].value;
    payment.payee = this.paymentForm.controls['payee'].value;
    payment.deposit_status = this.paymentForm.controls['deposit_status'].value;
    payment.related_coverage = this.paymentForm.controls['related_coverage'].value;
    payment.note = this.paymentForm.controls['note'].value;
    payment.contingency_fee_percentage = this.paymentForm.controls['contingency_fee_percentage'].value;
    payment.appraisal_fee = this.paymentForm.controls['appraisal_fee'].value;
    payment.umpire_fee = this.paymentForm.controls['umpire_fee'].value;
    payment.mold_fee = this.paymentForm.controls['mold_fee'].value;
    payment.misc_fee = this.paymentForm.controls['misc_fee'].value;
    payment.check_type = this.paymentForm.controls['check_type'].value || 'standard';
    payment.is_ready_to_process = this.paymentForm.controls['is_ready_to_process'].value;

    this.claimService.updateClaimPayment(payment)
      .subscribe((response) => {
        this.FormDisabled = false;
        this.claimPayment  = response;
        this.claim_payment_id = this.claimPayment.id;
        this.uploadFile();
        this.dialogRef.close();
        this.snackBar.open('Payment record updated', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      },
        error => {
          this.FormDisabled = false;
          console.log(error);
        });
  }

  deletePayment(id: string) {

    this.FormDisabled = true;

    this.claimService.deleteClaimPayment(id)
      .subscribe((response) => {
        this.FormDisabled = false;
        this.dialogRef.close();
        this.snackBar.open('Payment deleted', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      },
        error => {
          this.FormDisabled = false;
          console.log(error);
        });

  }

  selectFile(event: any) {
    this.file = event.target.files[0];
    this.filename = this.file?.name;
    this.fileType = this.file?.type;

    if (this.fileUploadForm.get('fileName').value == '') {
      this.fileUploadForm.controls['fileName'].setValue(this.filename);
    }
  }

  uploadFile() {
    if(!this.file) {
      return;
    }

    this.fileUploadFormDisabled = true;

    let fileData = {
      file: this.file,
      file_name: this.fileUploadForm.get('fileName').value,
      description: this.fileUploadForm.get('description').value,
      can_be_removed: true
    }

    this.claimService.saveClaimPaymentFiles(fileData, this.claim_payment_id).subscribe(
      (result: any) => {
        if (result?.id != '') {

          this.fileUploadFormDisabled = false;
          this.getPaymentFiles();

        }
      }
    );
  }

  getPaymentFiles() {
    this.spinner.show();
    this.claimService
      .getClaimPaymentFiles(this.claim_payment_id, 1, 10)
      .subscribe((paymentFiles) => {
        this.spinner.hide();
        if (paymentFiles !== undefined) {
          if (paymentFiles) {

            // Remove delete followup
            this.dataSourceFile = new MatTableDataSource(
              paymentFiles.items
            );


          }
        }
      });
  }

  deletePaymentFile(file: any){
    this.fileUploadFormDisabled = true;
    this.claimService.deleteClaimPaymentFiles(file.id).subscribe(
      (result: any) => {
          this.fileUploadFormDisabled = false;
          this.getPaymentFiles();
          this.snackBar.open('File has been deleted', 'Close', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'bottom',
          });
        }
    );

  }

  openFile(file: any, type: any) {
    this.dialogService
      .openDialog(ViewDocumentDialogComponent, { type: type, file: file })
      .subscribe();
  }

}
