import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimFilesShareDialogComponent } from './claim-files-share-dialog.component';

describe('ClaimFilesShareDialogComponent', () => {
  let component: ClaimFilesShareDialogComponent;
  let fixture: ComponentFixture<ClaimFilesShareDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaimFilesShareDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimFilesShareDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
