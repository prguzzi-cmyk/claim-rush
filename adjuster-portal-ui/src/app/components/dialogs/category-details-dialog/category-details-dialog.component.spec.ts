import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryDetailsDialogComponent } from './category-details-dialog.component';

describe('CategoryDetailsDialogComponent', () => {
  let component: CategoryDetailsDialogComponent;
  let fixture: ComponentFixture<CategoryDetailsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CategoryDetailsDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
