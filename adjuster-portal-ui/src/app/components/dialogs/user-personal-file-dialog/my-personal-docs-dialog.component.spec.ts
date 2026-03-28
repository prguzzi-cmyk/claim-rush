import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyPersonalDocsDialogComponent } from './my-personal-docs-dialog.component';

describe('LicenseAndBondDocsDialogComponent', () => {
  let component: MyPersonalDocsDialogComponent;
  let fixture: ComponentFixture<MyPersonalDocsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MyPersonalDocsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyPersonalDocsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
