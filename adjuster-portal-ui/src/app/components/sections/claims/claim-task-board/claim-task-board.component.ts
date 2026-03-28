import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ClaimTask } from 'src/app/models/tasks-claim.model';
import { ClaimService } from 'src/app/services/claim.service';
import { MatSnackBar } from '@angular/material/snack-bar';

interface BoardColumn {
  status: string;
  label: string;
  color: string;
  tasks: ClaimTask[];
}

@Component({
    selector: 'app-claim-task-board',
    templateUrl: './claim-task-board.component.html',
    styleUrls: ['./claim-task-board.component.scss'],
    standalone: false
})
export class ClaimTaskBoardComponent implements OnChanges {

  @Input() tasks: ClaimTask[] = [];
  @Output() taskUpdated = new EventEmitter<void>();

  columns: BoardColumn[] = [
    { status: 'pending',            label: 'Pending',            color: '#1565c0', tasks: [] },
    { status: 'in-progress',        label: 'In Progress',        color: '#f57c00', tasks: [] },
    { status: 'waiting-on-carrier', label: 'Waiting on Carrier',  color: '#7b1fa2', tasks: [] },
    { status: 'waiting-on-client',  label: 'Waiting on Client',   color: '#00838f', tasks: [] },
    { status: 'completed',          label: 'Completed',          color: '#2e7d32', tasks: [] },
  ];

  connectedLists: string[] = [];

  constructor(
    private claimService: ClaimService,
    private snackBar: MatSnackBar,
  ) {
    this.connectedLists = this.columns.map((_, i) => 'board-col-' + i);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks']) {
      this.distributeTasks();
    }
  }

  distributeTasks(): void {
    for (const col of this.columns) {
      col.tasks = [];
    }
    if (!this.tasks) return;

    for (const task of this.tasks) {
      const col = this.columns.find(c => c.status === task.status);
      if (col) {
        col.tasks.push(task);
      } else {
        // fallback: put unknown statuses in pending
        this.columns[0].tasks.push(task);
      }
    }
  }

  drop(event: CdkDragDrop<ClaimTask[]>, targetColumn: BoardColumn): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    const task = event.container.data[event.currentIndex];
    const updatedTask = new ClaimTask();
    updatedTask.id = task.id;
    updatedTask.status = targetColumn.status;

    this.claimService.updateClaimTask(updatedTask).subscribe({
      next: () => {
        task.status = targetColumn.status;
        this.snackBar.open(`Task moved to ${targetColumn.label}`, 'Close', {
          duration: 3000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
        this.taskUpdated.emit();
      },
      error: () => {
        // Revert on error
        transferArrayItem(
          event.container.data,
          event.previousContainer.data,
          event.currentIndex,
          event.previousIndex,
        );
        this.snackBar.open('Failed to update task status', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      },
    });
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#d32f2f';
      case 'medium': return '#f57c00';
      case 'low': return '#388e3c';
      default: return '#757575';
    }
  }
}
