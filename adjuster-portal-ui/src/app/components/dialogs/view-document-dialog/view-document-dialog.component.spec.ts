import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewDocumentDialogComponent } from './view-document-dialog.component';

describe('ViewDocumentDialogComponent', () => {
  let component: ViewDocumentDialogComponent;
  let fixture: ComponentFixture<ViewDocumentDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ViewDocumentDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewDocumentDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
