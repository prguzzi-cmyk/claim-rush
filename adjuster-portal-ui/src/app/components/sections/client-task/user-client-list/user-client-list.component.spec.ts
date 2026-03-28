import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserClientListComponent } from './user-client-list.component';

describe('UserClientListComponent', () => {
  let component: UserClientListComponent;
  let fixture: ComponentFixture<UserClientListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserClientListComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserClientListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
