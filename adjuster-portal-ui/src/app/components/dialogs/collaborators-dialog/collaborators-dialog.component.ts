import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { Claim } from 'src/app/models/claim.model';
import { ClaimService } from 'src/app/services/claim.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-collaborators-dialog',
    templateUrl: './collaborators-dialog.component.html',
    styleUrls: ['./collaborators-dialog.component.scss'],
    standalone: false
})
export class CollaboratorsDialogComponent implements OnInit {

  dataSource: any;
  assignedToControl = new FormControl('', [
    Validators.required,
  ]);

  action: string = 'view';
  agents: any;
  claim: any;
  selectedAgent: any;

  filteredAgents!: Observable<any[]>;


  displayedColumns: string[] = [
    'sn',
    'first_name',
    'last_name',
    'email',
    'delete'
  ];

  constructor(private dialogRef: MatDialogRef<CollaboratorsDialogComponent>,
    private snackBar: MatSnackBar,
    private claimService: ClaimService,
    private userService: UserService,
    private spinner: NgxSpinnerService,
    @Inject(MAT_DIALOG_DATA) public data: any) {

    this.claim = data?.claim;

    this.dataSource = data?.claim?.collaborators;

  }

  ngOnInit(): void {

    this.filteredAgents = this.assignedToControl.valueChanges.pipe(
      startWith(''),
      map((value) => this._filterAgents(value))
    );

  }

  addCollaborators() {
    this.action = 'add';
    this.getUsers();
  }

  onAssignedToSelected(event: any) {
    this.selectedAgent = event.option.value;
  }

  saveCollaborators() {
    this.spinner.show();
    const data = {
      collaborator_ids: [this.selectedAgent.id]
    };

    this.userService
      .appendCollaborators(this.claim.id, data)
      .subscribe(() => {
        // this.formDisabled = false;
        // this.dialogRef.close();
        this.spinner.hide();
        this.getClaim();
        this.action = 'view';
        this.snackBar.open('Collaborator added to claim', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });
  }

  getClaim() {
    this.spinner.show();
    this.claimService.getClaim(this.claim.id).subscribe((_claim) => {
      if (_claim !== undefined) {
        let collaborators = _claim?.collaborators;
        this.dataSource = collaborators;
      }
      this.spinner.hide();
    });
  }


  private _filterAgents(value: string): any[] {
    if (typeof value !== 'string') {
      return [];
    }

    const filterValue = value ? value : '';

    if (!filterValue) {
      return [];
    }

    return this.agents.filter(
      (agent) =>
        agent.first_name
          .toLowerCase()
          .startsWith(filterValue?.toLowerCase()) ||
        agent.last_name
          .toLowerCase()
          .startsWith(filterValue?.toLowerCase())
    );
  }

  displayAgent(agent: any): string {
    return agent ? `${agent.first_name} ${agent.last_name}` : '';
  }

  deleteCollaborator(id: string) {
    this.spinner.show();
    const data = {
      collaborator_ids: [id]
    };

    this.userService
      .removeCollaborators(this.claim.id, data)
      .subscribe(() => {
        // this.formDisabled = false;
        // this.dialogRef.close();
        this.getClaim();
        this.snackBar.open('Collaborator removed.', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      });

  }

  getUsers() {
    this.spinner.show();
    this.userService.getUsers(1, 1000).subscribe((agents) => {
      this.agents = agents.items;
      this.spinner.hide();
    });
  }

}
