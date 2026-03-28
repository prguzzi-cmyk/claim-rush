import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplateDetailsDialogComponent } from './template-details-dialog.component';

describe('TemplateDetailsDialogComponent', () => {
  let component: TemplateDetailsDialogComponent;
  let fixture: ComponentFixture<TemplateDetailsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TemplateDetailsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemplateDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
