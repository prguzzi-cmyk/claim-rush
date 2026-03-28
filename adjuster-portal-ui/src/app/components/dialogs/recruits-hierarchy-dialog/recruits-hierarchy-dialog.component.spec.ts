import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecruitsHierarchyDialogComponent } from './recruits-hierarchy-dialog.component';

describe('MLMHierarchyDialogComponent', () => {
  let component: RecruitsHierarchyDialogComponent;
  let fixture: ComponentFixture<RecruitsHierarchyDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RecruitsHierarchyDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecruitsHierarchyDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
