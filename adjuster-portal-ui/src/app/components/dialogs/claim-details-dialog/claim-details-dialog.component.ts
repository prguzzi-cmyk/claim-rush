import { SelectionModel } from '@angular/cdk/collections';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { Claim } from 'src/app/models/claim.model';
import { User } from 'src/app/models/user.model';
import { ClaimService } from 'src/app/services/claim.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-claim-details-dialog',
    templateUrl: './claim-details-dialog.component.html',
    styleUrls: ['./claim-details-dialog.component.scss'],
    standalone: false
})
export class ClaimDetailsDialogComponent implements OnInit {
    selection : any;

    action: string = 'add';
    title: string = 'Edit multiple claims';
    claim: Claim;

    role: string;
    agent: User;
    agents: any[];
    user: User;
    createClaim: boolean = false;
    phases: any;

    FormDisabled: boolean = false;

    public claimForm = new FormGroup({
        belongs_to: new FormControl(''),
        currentPhase: new FormControl(''),
    });

    constructor(
        private userService: UserService,
        private dialogRef: MatDialogRef<ClaimDetailsDialogComponent>,
        private snackBar: MatSnackBar,
        private claimService: ClaimService,
        private spinner: NgxSpinnerService,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        this.selection = null;
        this.claimService.getClaimPhases().subscribe((claimPhases) => {
            this.phases = claimPhases;
        });

        this.role = localStorage.getItem('role-name');

        if (this.role == 'super-admin' || this.role == 'admin') {
            this.getUsers();
        }

        if (data) {
            this.action = data.type;
        }

        if (this.action == 'multiple' || this.action == 'multiple-delete') {
            this.selection = data?.selection;


            if (this.action == 'multiple-delete') {
                this.title = 'Delete multiple claims';
            }
        }
    }

    updateMultiple() {
        let belongsTo = this.claimForm.controls['belongs_to'].value;
        let currentPhase = this.claimForm.controls['currentPhase'].value;

        this.spinner.show();
        var promise = new Promise((resolve, reject) => {
            this.selection.selected.forEach(async (thisClaim, index) => {
                await this.bulkUpdateClaim(
                    thisClaim.id,
                    belongsTo,
                    currentPhase
                );
                if (index === this.selection.selected.length - 1) resolve(true);
            });
        });

        promise.then(() => {
            this.spinner.hide();
            this.dialogRef.close();
            this.snackBar.open('Claim records updated', 'Close', {
                duration: 5000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
            });
        });
    }

    async bulkUpdateClaim(
        claimId: string,
        assignedTo: string,
        currentPhase: string
    ) {
        let newClaim = new Claim();
        newClaim.id = claimId;
        if (assignedTo != '' && assignedTo != null) {
            newClaim.assigned_to = assignedTo;
        }

        if (currentPhase != '' && currentPhase != null) {
            newClaim.current_phase = currentPhase;
        }

        const promise = new Promise<void>((resolve, reject) => {
            this.claimService.updateClaim(newClaim).subscribe({
                next: (lead: any) => {
                    resolve();
                },
                error: (err: any) => {
                    reject(err);
                },
                complete: () => {
                },
            });
        });
        return promise;
    }

    ngOnInit(): void {
        this.getUser();
    }

    getUsers() {
        this.userService.getUsers(1,1000).subscribe((agents) => {
            this.agents = agents.items;
        });
    }

    getUser() {
        this.userService.currentUser.subscribe((user) => {
            if (user) {
                this.user = user;
            }
        });
    }

    deleteMultiple() {
        this.spinner.show();
        var promise = new Promise((resolve, reject) => {
            this.selection.selected.forEach(async (thisClaim, index) => {
                await this.bulkDeleteClaim(
                    thisClaim.id
                );
                if (index === this.selection.selected.length - 1) resolve(true);
            });
        });

        promise.then(() => {
            this.spinner.hide();
            this.dialogRef.close();
            this.snackBar.open('Claim records deleted.', 'Close', {
                duration: 5000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
            });
        });
    }

    async bulkDeleteClaim(
        claimId: string,
    ) {

        const promise = new Promise<void>((resolve, reject) => {
            this.claimService.deleteClaim(claimId).subscribe({
                next: (lead: any) => {
                    resolve();
                },
                error: (err: any) => {
                    reject(err);
                },
                complete: () => {
                },
            });
        });
        return promise;
    }
}
