import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadDocumentsDialogComponent } from './lead-documents-dialog.component';

describe('LeadDocumentsDialogComponent', () => {
  let component: LeadDocumentsDialogComponent;
  let fixture: ComponentFixture<LeadDocumentsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LeadDocumentsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadDocumentsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
