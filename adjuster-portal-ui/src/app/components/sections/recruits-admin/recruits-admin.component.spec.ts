import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecruitsAdminComponent } from './recruits-admin.component';

describe('MlmHierarchyAdminComponent', () => {
  let component: RecruitsAdminComponent;
  let fixture: ComponentFixture<RecruitsAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RecruitsAdminComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecruitsAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
