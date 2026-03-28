import {Component, Inject, inject, OnInit} from '@angular/core';
import {SelectionModel} from "@angular/cdk/collections";
import {User} from "../../../../models/user.model";
import {FormControl, FormGroup, ValidatorFn, Validators} from "@angular/forms";
import {Commission} from "../../../../models/commission.model";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {MatSelectChange} from "@angular/material/select";
import {CommissionAdjustModel} from "../../../../models/commission-adjust.model";
import {CommissionService} from "../../../../services/commission.service";
import {MatSnackBar} from "@angular/material/snack-bar";
import {UserService} from "../../../../services/user.service";


@Component({
    selector: 'app-commission-readjust-dialog',
    templateUrl: './commission-readjust-dialog.component.html',
    styleUrls: ['./commission-readjust-dialog.component.scss'],
    standalone: false
})
export class CommissionReadjustDialogComponent implements OnInit {
  ref_string: string = "";
  editing: boolean = false;

  role: string;
  // agent: User;
  agents: any[];
  user: User;
  users: [User];

  originalCommission: Commission;
  commission_items: Commission[]

  public isUpaOrgFieldsRequired: boolean = false;
  public readjustForm;

  constructor(public commissionService: CommissionService,
              public userService: UserService,
              private dialogRef: MatDialogRef<CommissionReadjustDialogComponent>,
              private snackBar: MatSnackBar,
              @Inject(MAT_DIALOG_DATA) public data: any) {
    if (data && data.targetCommission) {
        this.originalCommission = data.targetCommission;
        this.ref_string = this.originalCommission.payment_ref_string;
      const number = Number(this.originalCommission.contingency_fee_percentage)/100.00;
      this.readjustForm = new FormGroup({
          scope_type: new FormControl(2, [Validators.required]), // Only Payment based readjustment supported now
          scope_id: new FormControl(this.originalCommission.payment_id, [Validators.required]),
          contingency_fee_rate: new FormControl(number.toFixed(2), [Validators.required]),
          commissionable_fee_rate: new FormControl('0.5', [Validators.required]),
          sourcer_rate: new FormControl("", [Validators.required]),
          sourceUserId: new FormControl("", [Validators.required]),
          signer_rate: new FormControl("", [Validators.required]),
          signerUserId: new FormControl("", [Validators.required]),
          adjuster_rate: new FormControl("", [Validators.required]),
          adjusterUserId: new FormControl("", [Validators.required]),
          ssa_override_rate: new FormControl(''),
          ssaUserId: new FormControl(''),
          dm_override_rate: new FormControl(''),
          dmUserId: new FormControl(''),
          sdm_override_rate: new FormControl(''),
          sdmUserId: new FormControl(''),
          dvm_override_rate: new FormControl(''),
          dvmUserId: new FormControl(''),
          rvp_override_rate: new FormControl(''),
          rvpUserId: new FormControl(''),
          evp_override_rate: new FormControl(''),
          evpUserId: new FormControl(''),
          cp_override_rate: new FormControl(''),
          cpUserId: new FormControl(''),
          upaOrg_override_rate: new FormControl(''),
          upaOrgUserId: new FormControl(''),
        }, {validators: this.validateRateSum()});
    }
  }

  ngOnInit(): void {
    this.userService.getUsers(1, 500).subscribe((users) => {
      this.users = users.items;
    });

    this.commissionService.getCommissionsByPayment(this.originalCommission.payment_id).subscribe(response => {
        this.commission_items = response.items;
        this.setPerfFormValues();
        this.setMgrFormValues();
        this.markFormControlRequiredConstraints();
    });
  }

  getMgrOverridesRate(titleId: number) : string {
    const targetCommission = this.commission_items?.filter((item)=> item.commission_type == 3 && item.owner_title_id == titleId);
    return targetCommission.length ? targetCommission[0].fee_percentage : "";
  }

  getPerformanceRate(commissionType: number) : string {
    const targetCommission = this.commission_items?.filter((item)=> item.commission_type == commissionType);
    return targetCommission?.length ? targetCommission[0].fee_percentage : "";
  }

  setPerfFormValues() {
    this.readjustForm.controls.sourcer_rate.setValue(this.getPerformanceRate(1));
    this.readjustForm.controls.sourceUserId.setValue(this.getCommissionOwnerId(1));

    this.readjustForm.controls.signer_rate.setValue(this.getPerformanceRate(0));
    this.readjustForm.controls.signerUserId.setValue(this.getCommissionOwnerId(0));

    this.readjustForm.controls.adjuster_rate.setValue(this.getPerformanceRate(2));
    this.readjustForm.controls.adjusterUserId.setValue(this.getCommissionOwnerId(2));
  }

  setMgrFormValues() {

    const levels = [
      { rateControl: 'ssa_override_rate', userControl: 'ssaUserId', level: 2 },
      { rateControl: 'dm_override_rate', userControl: 'dmUserId', level: 3 },
      { rateControl: 'sdm_override_rate', userControl: 'sdmUserId', level: 4 },
      { rateControl: 'dvm_override_rate', userControl: 'dvmUserId', level: 5 },
      { rateControl: 'rvp_override_rate', userControl: 'rvpUserId', level: 6 },
      { rateControl: 'evp_override_rate', userControl: 'evpUserId', level: 7 },
      { rateControl: 'cp_override_rate', userControl: 'cpUserId', level: 8 },
    ];

    this.isUpaOrgFieldsRequired

    let mgrOverridesPercentage = 0;
    levels.forEach(({ rateControl, userControl, level }) => {
      if (this.isManagerOverridesFieldRequired(level)) {
        const overrideRate = this.getMgrOverridesRate(level);
        const overrideOwnerId = this.getMgrOverridesOwnerId(level);

        // Set initial values
        this.readjustForm.controls?.[rateControl].setValue(overrideRate);
        this.readjustForm.controls?.[userControl].setValue(overrideOwnerId);

        // Accumulate manager override percentage
        mgrOverridesPercentage += Number(overrideRate || 0);
      }
    });

    this.setResidualValue(mgrOverridesPercentage);
  }

  setResidualValue(mgrOverridesPercentage: number) {
    const PERFORMANCE_DEDUCTIONS = [0.20, 0.20, 0.30];
    const totalDeductions = PERFORMANCE_DEDUCTIONS.reduce((sum, value) => sum + value, 0);
    const residual = 1.0 - mgrOverridesPercentage - totalDeductions;

    if (this.isManagerOverridesFieldRequired(1)) {
      this.isUpaOrgFieldsRequired = true;
      this.readjustForm.controls?.upaOrg_override_rate.setValue(this.getMgrOverridesRate(1));
      this.readjustForm.controls?.upaOrgUserId.setValue(this.getMgrOverridesOwnerId(1));
    } else if (residual.toFixed(3) !== "0.000") {
      this.isUpaOrgFieldsRequired = true;
      this.readjustForm.controls?.upaOrg_override_rate.setValue(residual.toFixed(3));
    }
  }

  markFormControlRequiredConstraints() {
    if (this.isManagerOverridesFieldRequired(2)) {
      this.readjustForm.controls.ssa_override_rate.addValidators(Validators.required);
      this.readjustForm.controls.ssaUserId.addValidators(Validators.required);
    }

    if (this.isManagerOverridesFieldRequired(3)) {
      this.readjustForm.controls.dm_override_rate.addValidators(Validators.required);
      this.readjustForm.controls.dmUserId.addValidators(Validators.required);
    }

    if (this.isManagerOverridesFieldRequired(4)) {
      this.readjustForm.controls.sdm_override_rate.addValidators(Validators.required);
      this.readjustForm.controls.sdmUserId.addValidators(Validators.required);
    }

    if (this.isManagerOverridesFieldRequired(5)) {
      this.readjustForm.controls.dvm_override_rate.addValidators(Validators.required);
      this.readjustForm.controls.dvmUserId.addValidators(Validators.required);
    }

    if (this.isManagerOverridesFieldRequired(6)) {
      this.readjustForm.controls.rvp_override_rate.addValidators(Validators.required);
      this.readjustForm.controls.rvpUserId.addValidators(Validators.required);    }

    if (this.isManagerOverridesFieldRequired(7)) {
      this.readjustForm.controls.evp_override_rate.addValidators(Validators.required);
      this.readjustForm.controls.evpUserId.addValidators(Validators.required);    }

    if (this.isManagerOverridesFieldRequired(8)) {
      this.readjustForm.controls.cp_override_rate.addValidators(Validators.required);
      this.readjustForm.controls.cpUserId.addValidators(Validators.required);
    }

    if (this.isUpaOrgFieldsRequired){
      this.readjustForm.controls.upaOrg_override_rate.addValidators(Validators.required);
      this.readjustForm.controls.upaOrgUserId.addValidators(Validators.required);
    }
  }

  isManagerOverridesFieldRequired(titleId: number): boolean {
      return this.commission_items?.findIndex((item)=> item.commission_type == 3 && item.owner_title_id == titleId) > -1
  }

  getCommissionOwnerId(commissionType: number): string {
    const targetCommission = this.commission_items?.filter((item)=> item.commission_type == commissionType);
    return targetCommission.length ? targetCommission[0].owner_id : "";
  }

  getMgrOverridesOwnerId(titleId: number): string {
    const targetCommission = this.commission_items?.filter((item)=> item.commission_type == 3 && item.owner_title_id == titleId);
    return targetCommission.length ? targetCommission[0].owner_id : "";
  }

  compareUserObjects(u1: User, u2: User) {
    return u1 && u2 && u1.id == u2.id;
  }

  validateRateSum(): ValidatorFn {
    return (formGroup: FormGroup) => {

      const sourcerRate = formGroup.controls?.sourcer_rate?.value || "0";
      const signerRate = formGroup.controls?.signer_rate?.value || "0";
      const adjusterRate = formGroup.controls?.adjuster_rate?.value || "0";
      const ssaOverrideRate = formGroup.controls?.ssa_override_rate?.value || "0";
      const dmOverrideRate = formGroup.controls?.dm_override_rate?.value || "0";
      const sdmOverrideRate = formGroup.controls?.sdm_override_rate?.value || "0";
      const dvmOverrideRate = formGroup.controls?.dvm_override_rate?.value || "0";
      const rvpOverrideRate = formGroup.controls?.rvp_override_rate?.value || "0";
      const evpOverrideRate = formGroup.controls?.evp_override_rate?.value || "0";
      const cpOverrideRate = formGroup.controls?.cp_override_rate?.value || "0";
      let totalRate = Number(sourcerRate) + Number(signerRate) + Number(adjusterRate)
          + Number(ssaOverrideRate) + Number(dmOverrideRate) + Number(sdmOverrideRate)
          + Number(dvmOverrideRate) + Number(rvpOverrideRate) + Number(evpOverrideRate) +  Number(cpOverrideRate);

      if (this.isUpaOrgFieldsRequired) {
        const upaOrg_override_rate = formGroup.controls?.upaOrg_override_rate?.value || "0";
        totalRate += Number(upaOrg_override_rate)
      }

      const sumOfRate = totalRate.toFixed(3);
      if (sumOfRate === '1.000') {
        const upaUserId = formGroup.controls?.upaOrgUserId?.value;
        if (this.isUpaOrgFieldsRequired && upaUserId === '') {
          return {
            rateSumError: true,
            errMsg: "Invalid user for UPA org"
          }
        } else {
          return null;
        }
      } else {
        return {
          rateSumError: true,
          errMsg: "Invalid sum of required types of commission rate: " + sumOfRate
        }
      }
    };
  }

  doReadjust() {
    this.editing = true;
    let adjustModel = new CommissionAdjustModel();
    adjustModel.contingency_fee_rate = String(this.readjustForm.controls.contingency_fee_rate?.value || "0");
    adjustModel.scope_id = this.readjustForm.controls?.scope_id?.value;
    adjustModel.sourcer_rate = String(this.readjustForm.controls?.sourcer_rate?.value|| '0');
    adjustModel.sourcer_uid = String(this.readjustForm.controls?.sourceUserId?.value || '');
    adjustModel.signer_rate = String(this.readjustForm.controls?.signer_rate?.value  || '0');
    adjustModel.signer_uid = String(this.readjustForm.controls?.signerUserId?.value  || '');
    adjustModel.adjuster_rate = String(this.readjustForm.controls?.adjuster_rate?.value|| '0') ;
    adjustModel.adjuster_uid = String(this.readjustForm.controls?.adjusterUserId?.value|| '') ;
    adjustModel.ssa_override_rate = String(this.readjustForm.controls?.ssa_override_rate?.value || '0');
    adjustModel.ssa_uid = String(this.readjustForm.controls?.ssaUserId?.value || '');
    adjustModel.dm_override_rate = String(this.readjustForm.controls?.dm_override_rate?.value || '0') ;
    adjustModel.dm_uid = String(this.readjustForm.controls?.dmUserId?.value || '') ;
    adjustModel.sdm_override_rate = String(this.readjustForm.controls?.sdm_override_rate?.value  || '0');
    adjustModel.sdm_uid = String(this.readjustForm.controls?.sdmUserId?.value  || '');
    adjustModel.dvm_override_rate = String(this.readjustForm.controls?.dvm_override_rate?.value  || '0');
    adjustModel.dvm_uid = String(this.readjustForm.controls?.dvmUserId?.value  || '');
    adjustModel.rvp_override_rate = String(this.readjustForm.controls?.rvp_override_rate?.value  || '0');
    adjustModel.rvp_uid = String(this.readjustForm.controls?.rvpUserId?.value  || '');
    adjustModel.evp_override_rate = String(this.readjustForm.controls?.evp_override_rate?.value|| '0');
    adjustModel.evp_uid = String(this.readjustForm.controls?.evpUserId?.value|| '');
    adjustModel.cp_override_rate = String(this.readjustForm.controls?.cp_override_rate?.value|| '0');
    adjustModel.cp_uid = String(this.readjustForm.controls?.cpUserId?.value|| '');
    adjustModel.upa_override_rate = String(this.readjustForm.controls?.upaOrg_override_rate?.value || '0');
    adjustModel.upa_uid = String(this.readjustForm.controls?.upaOrgUserId?.value || '');

    this.commissionService.readjustCommission(adjustModel).subscribe(commission => {
      if (commission) {
        console.log(commission);
        this.editing = false;
        this.snackBar.open("Commission readjustment successful", "Close", {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        })
        this.dialogRef.close();
      } else {
        this.snackBar.open("Commission readjustment failure, please try agian later...", "Close", {
          duration: 10000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
          panelClass: ['snackbar-error']
        })
      }
    })

  }

  getCommisssionableFee() {
    const number = Number(this.originalCommission.check_amount) * Number(this.readjustForm.controls?.contingency_fee_rate?.value || '0');
    return (0.5 * number).toFixed(3);
  }

  showUpaOrgFields() {
    return this.isUpaOrgFieldsRequired;
  }
}
