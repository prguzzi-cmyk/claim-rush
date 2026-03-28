import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimFilesDialogComponent } from './claim-files-dialog.component';

describe('ClaimFilesDialogComponent', () => {
  let component: ClaimFilesDialogComponent;
  let fixture: ComponentFixture<ClaimFilesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimFilesDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimFilesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
