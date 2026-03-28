import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollaboratorsDialogComponent } from './collaborators-dialog.component';

describe('CollaboratorsDialogComponent', () => {
  let component: CollaboratorsDialogComponent;
  let fixture: ComponentFixture<CollaboratorsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CollaboratorsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CollaboratorsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
