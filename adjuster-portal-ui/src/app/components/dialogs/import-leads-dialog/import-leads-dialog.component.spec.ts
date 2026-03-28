import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportLeadsDialogComponent } from './import-leads-dialog.component';

describe('ImportLeadsDialogComponent', () => {
  let component: ImportLeadsDialogComponent;
  let fixture: ComponentFixture<ImportLeadsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ImportLeadsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportLeadsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
