import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientTasksDialogComponent } from './client-tasks-dialog.component';

describe('ClientTasksDialogComponent', () => {
  let component: ClientTasksDialogComponent;
  let fixture: ComponentFixture<ClientTasksDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClientTasksDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientTasksDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
