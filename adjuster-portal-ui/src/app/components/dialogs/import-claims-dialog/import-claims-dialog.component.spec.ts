import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportClaimsDialogComponent } from './import-claims-dialog.component';

describe('ImportClaimsDialogComponent', () => {
  let component: ImportClaimsDialogComponent;
  let fixture: ComponentFixture<ImportClaimsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ImportClaimsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportClaimsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
