import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimBulkfilesDialogComponent } from './claim-bulkfiles-dialog.component';

describe('ClaimBulkfilesDialogComponent', () => {
  let component: ClaimBulkfilesDialogComponent;
  let fixture: ComponentFixture<ClaimBulkfilesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimBulkfilesDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimBulkfilesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
