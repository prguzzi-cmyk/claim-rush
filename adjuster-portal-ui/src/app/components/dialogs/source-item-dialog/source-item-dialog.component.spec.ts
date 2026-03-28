import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourceItemDialogComponent } from './source-item-dialog.component';

describe('SourceItemDialogComponent', () => {
  let component: SourceItemDialogComponent;
  let fixture: ComponentFixture<SourceItemDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SourceItemDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SourceItemDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
